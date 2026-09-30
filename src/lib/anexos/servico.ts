import type { Anexo, StatusRnc, TipoEntidadeAnexo } from "@prisma/client";
import { atorTem, type Ator } from "@/lib/ator";
import { getArmazenamento, montarChave } from "@/lib/armazenamento";
import { ErroNegocio } from "@/lib/erros";
import { STATUS_FINAIS } from "@/lib/rnc/estados";
import { podeGerenciarPlanoManual } from "@/lib/plano-acao/acesso";
import { moduloHiraAtivo, podeTratarHira } from "@/lib/hira/servico";
import { moduloLaiaAtivo, podeTratarLaia } from "@/lib/laia/servico";
import { podeLerVersao } from "@/lib/documentos/acesso";
import { filtroObras } from "@/lib/escopo-obras";
import { moduloInspecoesAtivo, podeExecutarInspecao } from "@/lib/inspecoes/acesso";
import { filtroObraAuditoria, moduloAuditoriasAtivo, podeExecutarAuditoria } from "@/lib/auditorias/acesso";
import { moduloProcessosAtivo } from "@/lib/processos/servico";
import { filtroAcessoIncidente, moduloIncidentesAtivo, podeTratarIncidente, podeVerRestritosIncidente } from "@/lib/incidentes/acesso";
import { moduloTreinamentosAtivo, podeGerenciarTreinamentos } from "@/lib/treinamentos/acesso";
import { filtroObraRisco, moduloRiscosAtivo, podeTratarRisco } from "@/lib/riscos/servico";
import { filtroAcessoItem, filtroAcessoRnc, podeGerenciarPlanoRnc, podeTratarRnc, podeVerDadosSensiveis } from "@/lib/rnc/servico";
import { limiteBytes, MAX_ARQUIVOS_POR_ENVIO, nomeExibicao, validarArquivo } from "./validacao";

export interface Alvo {
  tipo: TipoEntidadeAnexo;
  /** RNC_DADOS_SENSIVEIS usa o id da RNC. */
  entidadeId: string;
}

export interface ArquivoEnviado {
  nome: string;
  dados: Uint8Array;
}

interface AcessoEntidade {
  podeLer: boolean;
  podeEnviar: boolean;
  /** Gestor: pode excluir anexos de outros autores. */
  podeGerir: boolean;
  /** RNC a que a entidade pertence (para o histórico). */
  rncId: string | null;
  /** A entidade pertence a uma RNC encerrada/cancelada (anexos imutáveis). */
  rncFinal: boolean;
  /** Anexos imutáveis por outra regra (ex.: arquivo de revisão de documento): mensagem ao tentar excluir. */
  imutavel?: string;
}

const NEGADO: AcessoEntidade = { podeLer: false, podeEnviar: false, podeGerir: false, rncId: null, rncFinal: false };

/** Tipos de anexo marcados como sensíveis (LGPD). */
const TIPOS_SENSIVEIS: readonly TipoEntidadeAnexo[] = ["RNC_DADOS_SENSIVEIS", "INCIDENTE_DADOS_SENSIVEIS"];

/** Quem vê anexo sensível: RNC → RNC_VER_RESTRITAS; incidente → INCIDENTE_VER_RESTRITOS. */
function podeVerSensivel(a: Ator, tipo: TipoEntidadeAnexo) {
  return tipo === "INCIDENTE" || tipo === "INCIDENTE_DADOS_SENSIVEIS" ? podeVerRestritosIncidente(a) : podeVerDadosSensiveis(a);
}
const finalizada = (rnc: { status: StatusRnc } | null | undefined) => !!rnc && STATUS_FINAIS.includes(rnc.status);

function gestorRnc(a: Ator, rnc: { responsavelId: string | null }) {
  return atorTem(a, "PLANO_GERENCIAR") || podeTratarRnc(a, rnc);
}

/** Regras de acesso por tipo de entidade (sempre dentro da empresa do ator, via DbTenant). */
async function acessoEntidade(a: Ator, alvo: Alvo): Promise<AcessoEntidade> {
  const rncVisivel = (id: string) =>
    a.db.rnc.findFirst({
      where: { AND: [{ id }, filtroAcessoRnc(a)] },
      select: { id: true, status: true, responsavelId: true, contemDadosPessoais: true },
    });

  switch (alvo.tipo) {
    case "RNC":
    case "RNC_DADOS_SENSIVEIS": {
      const sensivel = alvo.tipo === "RNC_DADOS_SENSIVEIS";
      if (sensivel && !podeVerDadosSensiveis(a)) return NEGADO;
      const rnc = await rncVisivel(alvo.entidadeId);
      if (!rnc) return NEGADO;
      // B1: anexo de dados sensíveis só em RNC marcada com contemDadosPessoais.
      const podeEnviar = !finalizada(rnc) && (!sensivel || rnc.contemDadosPessoais);
      return { podeLer: true, podeEnviar, podeGerir: gestorRnc(a, rnc), rncId: rnc.id, rncFinal: finalizada(rnc) };
    }
    case "VERIFICACAO_EFICACIA": {
      const v = await a.db.verificacaoEficacia.findFirst({
        where: { id: alvo.entidadeId },
        select: { verificadorId: true, rncId: true },
      });
      if (!v) return NEGADO;
      const rnc = await rncVisivel(v.rncId);
      if (!rnc) return NEGADO;
      return { podeLer: true, podeEnviar: v.verificadorId === a.usuarioId, podeGerir: atorTem(a, "PLANO_GERENCIAR"), rncId: rnc.id, rncFinal: finalizada(rnc) };
    }
    case "ITEM_ACAO": {
      const item = await a.db.itemAcao.findFirst({
        where: { AND: [{ id: alvo.entidadeId }, filtroAcessoItem(a)] },
        select: { quemId: true, status: true, planoAcao: { select: { obraId: true, rnc: { select: { id: true, responsavelId: true, status: true } } } } },
      });
      if (!item) return NEGADO;
      const rnc = item.planoAcao.rnc;
      const gerencia = rnc ? !!(await rncVisivel(rnc.id)) && podeGerenciarPlanoRnc(a, rnc) : podeGerenciarPlanoManual(a, item.planoAcao);
      return {
        podeLer: true,
        podeEnviar: item.status !== "CANCELADO" && (item.quemId === a.usuarioId || gerencia),
        podeGerir: gerencia,
        rncId: null,
        rncFinal: finalizada(rnc),
      };
    }
    case "PROCESSO": {
      // Mapa de processos: leitura para a empresa com o módulo; envio/gestão com PROCESSO_GERENCIAR.
      if (!(await moduloProcessosAtivo(a))) return NEGADO;
      const p = await a.db.processo.findFirst({ where: { id: alvo.entidadeId }, select: { id: true } });
      if (!p) return NEGADO;
      const g = atorTem(a, "PROCESSO_GERENCIAR");
      return { podeLer: true, podeEnviar: g, podeGerir: g, rncId: null, rncFinal: false };
    }
    case "RISCO_OPORTUNIDADE": {
      // Riscos: leitura para a empresa com o módulo (escopo de obras); envio para quem trata.
      if (!(await moduloRiscosAtivo(a))) return NEGADO;
      const r = await a.db.riscoOportunidade.findFirst({ where: { AND: [{ id: alvo.entidadeId, ativo: true }, filtroObraRisco(a)] }, select: { responsavelId: true } });
      if (!r) return NEGADO;
      const g = podeTratarRisco(a, r);
      return { podeLer: true, podeEnviar: g, podeGerir: atorTem(a, "RISCO_GERENCIAR"), rncId: null, rncFinal: false };
    }
    case "HIRA": {
      // HIRA: leitura com o módulo e a obra no escopo; envio para quem gerencia ou é responsável.
      if (!(await moduloHiraAtivo(a))) return NEGADO;
      const l = await a.db.linhaHira.findFirst({ where: { AND: [{ id: alvo.entidadeId }, filtroObras(a)] }, select: { responsavelId: true } });
      if (!l) return NEGADO;
      return { podeLer: true, podeEnviar: podeTratarHira(a, l), podeGerir: atorTem(a, "HIRA_GERENCIAR"), rncId: null, rncFinal: false };
    }
    case "LAIA": {
      // LAIA: leitura com o módulo e a obra no escopo; envio para quem gerencia ou é responsável.
      if (!(await moduloLaiaAtivo(a))) return NEGADO;
      const l = await a.db.linhaLaia.findFirst({ where: { AND: [{ id: alvo.entidadeId }, filtroObras(a)] }, select: { responsavelId: true } });
      if (!l) return NEGADO;
      return { podeLer: true, podeEnviar: podeTratarLaia(a, l), podeGerir: atorTem(a, "LAIA_GERENCIAR"), rncId: null, rncFinal: false };
    }
    case "DOCUMENTO_VERSAO": {
      // Arquivo de revisão de documento: leitura conforme o acesso ao documento (público só a vigente).
      // Envio/troca só pelo serviço de documentos; nunca excluído pela tela de anexos (controle de versão).
      const v = await podeLerVersao(a, alvo.entidadeId);
      return { podeLer: v.ler, podeEnviar: false, podeGerir: false, rncId: null, rncFinal: false, imutavel: "O arquivo de uma revisão de documento não pode ser excluído (use nova revisão ou troque o arquivo do rascunho)." };
    }
    case "RESPOSTA_INSPECAO": {
      // Foto de resposta de inspeção: leitura com o módulo e a obra no escopo; envio pelo inspetor/gestor
      // com a inspeção em andamento; após concluída, as fotos ficam imutáveis (evidência).
      if (!(await moduloInspecoesAtivo(a))) return NEGADO;
      const r = await a.db.respostaInspecao.findFirst({
        where: { id: alvo.entidadeId, inspecao: filtroObras(a) },
        select: { inspecao: { select: { inspetorId: true, status: true } } },
      });
      if (!r) return NEGADO;
      const g = podeExecutarInspecao(a, r.inspecao);
      const aberta = r.inspecao.status === "EM_ANDAMENTO";
      return {
        podeLer: true,
        podeEnviar: g && aberta,
        podeGerir: g,
        rncId: null,
        rncFinal: false,
        imutavel: aberta ? undefined : "Fotos de inspeção concluída ou cancelada não podem ser excluídas.",
      };
    }
    case "CONSTATACAO_AUDITORIA": {
      // Evidência de constatação: leitura com o módulo e escopo; envio pelo auditor líder/gestor com a auditoria em execução.
      if (!(await moduloAuditoriasAtivo(a))) return NEGADO;
      const c = await a.db.constatacao.findFirst({
        where: { id: alvo.entidadeId, auditoria: filtroObraAuditoria(a) },
        select: { auditoria: { select: { auditorLiderId: true, status: true } } },
      });
      if (!c) return NEGADO;
      const g = podeExecutarAuditoria(a, c.auditoria);
      const aberta = c.auditoria.status === "EM_EXECUCAO";
      return {
        podeLer: true,
        podeEnviar: g && aberta,
        podeGerir: g,
        rncId: null,
        rncFinal: false,
        imutavel: aberta ? undefined : "Evidências de auditoria concluída ou cancelada não podem ser excluídas.",
      };
    }
    // Módulo Requisitos Legais descontinuado: o valor continua no enum do banco, mas ninguém tem acesso.
    case "REQUISITO_LEGAL":
      return NEGADO;
    case "INCIDENTE":
    case "INCIDENTE_DADOS_SENSIVEIS": {
      // Incidente: leitura = incidente visível (escopo + restrição LGPD). Fotos/evidências: quem registrou enquanto
      // aberto, ou quem trata (GERENCIAR/responsável) até a conclusão. Dados sensíveis: só INCIDENTE_VER_RESTRITOS.
      const sensivel = alvo.tipo === "INCIDENTE_DADOS_SENSIVEIS";
      if (sensivel && !podeVerRestritosIncidente(a)) return NEGADO;
      if (!(await moduloIncidentesAtivo(a))) return NEGADO;
      const i = await a.db.incidente.findFirst({
        where: { AND: [{ id: alvo.entidadeId }, filtroAcessoIncidente(a)] },
        select: { status: true, responsavelId: true, registradoPorId: true, contemDadosPessoais: true },
      });
      if (!i) return NEGADO;
      const trata = podeTratarIncidente(a, i);
      const aberto = i.status !== "CONCLUIDO";
      const podeEnviar = aberto && (trata || (i.registradoPorId === a.usuarioId && i.status === "ABERTO")) && (!sensivel || i.contemDadosPessoais);
      return { podeLer: true, podeEnviar, podeGerir: trata, rncId: null, rncFinal: false, imutavel: aberto ? undefined : "Evidências de incidente concluído não podem ser excluídas." };
    }
    case "CERTIFICADO_TREINAMENTO": {
      // Certificado de participação: quem gerencia treinamentos lê/envia/exclui; o próprio participante só lê.
      if (!(await moduloTreinamentosAtivo(a))) return NEGADO;
      const p = await a.db.participacaoTreinamento.findFirst({ where: { id: alvo.entidadeId }, select: { usuarioId: true } });
      if (!p) return NEGADO;
      const g = podeGerenciarTreinamentos(a);
      return { podeLer: g || p.usuarioId === a.usuarioId, podeEnviar: g, podeGerir: g, rncId: null, rncFinal: false };
    }
    case "PLANO_ACAO": {
      const plano = await a.db.planoAcao.findFirst({
        where: { id: alvo.entidadeId },
        select: { criadoPorId: true, obraId: true, rnc: { select: { id: true, responsavelId: true, status: true } } },
      });
      if (!plano) return NEGADO;
      if (plano.rnc) {
        if (!(await rncVisivel(plano.rnc.id))) return NEGADO;
        const g = podeGerenciarPlanoRnc(a, plano.rnc);
        return { podeLer: true, podeEnviar: g, podeGerir: g, rncId: null, rncFinal: finalizada(plano.rnc) };
      }
      const g = podeGerenciarPlanoManual(a, plano);
      const ler = g || plano.criadoPorId === a.usuarioId;
      return { podeLer: ler, podeEnviar: ler, podeGerir: g, rncId: null, rncFinal: false };
    }
  }
}

export async function podeEnviarAnexo(a: Ator, alvo: Alvo) {
  return (await acessoEntidade(a, alvo)).podeEnviar;
}

async function limiteDaEmpresa(a: Ator) {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { config: true } });
  return limiteBytes(e?.config);
}

/** Metadados de um arquivo recebido (antes de ler o conteúdo). */
export interface MetaArquivo {
  nome: string;
  tamanho: number;
}

/** Erros de quantidade/tamanho só com metadados (puro). */
export function errosMetadados(metas: readonly MetaArquivo[], limite: number): string[] {
  if (metas.length > MAX_ARQUIVOS_POR_ENVIO) return [`Envie no máximo ${MAX_ARQUIVOS_POR_ENVIO} arquivos por vez.`];
  const mb = Math.round(limite / 1024 / 1024);
  return metas.filter((m) => m.tamanho > limite).map((m) => `${nomeExibicao(m.nome)}: excede o limite de ${mb} MB.`);
}

/**
 * B3: valida quantidade e tamanho declarados ANTES de ler os arquivos em memória e, se
 * informado o alvo, a permissão de envio. Lança ErroNegocio.
 */
export async function prevalidarArquivos(a: Ator, metas: readonly MetaArquivo[], alvo?: Alvo) {
  if (metas.length === 0) return;
  const erros = errosMetadados(metas, await limiteDaEmpresa(a));
  if (erros.length) throw new ErroNegocio(erros.join(" "));
  if (alvo) {
    const acesso = await acessoEntidade(a, alvo);
    if (!acesso.podeLer) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    if (!acesso.podeEnviar) throw new ErroNegocio("Sem permissão para anexar arquivos neste registro.");
  }
}

/** Valida tipo/tamanho de todos os arquivos (sem gravar). Lança ErroNegocio com todos os problemas. */
export async function validarArquivos(a: Ator, arquivos: ArquivoEnviado[]) {
  if (arquivos.length > MAX_ARQUIVOS_POR_ENVIO) throw new ErroNegocio(`Envie no máximo ${MAX_ARQUIVOS_POR_ENVIO} arquivos por vez.`);
  const limite = await limiteDaEmpresa(a);
  const rs = arquivos.map((f) => ({ f, r: validarArquivo(f.nome, f.dados, limite) }));
  const erros = rs.flatMap(({ r }) => (r.ok ? [] : [r.erro]));
  if (erros.length) throw new ErroNegocio(erros.join(" "));
  return rs.map(({ f, r }) => ({ ...f, v: r as Extract<typeof r, { ok: true }> }));
}

/** Envia anexos para a entidade. Valida conteúdo (magic bytes), tamanho e permissão. */
export async function enviarAnexos(a: Ator, alvo: Alvo, arquivos: ArquivoEnviado[]): Promise<Anexo[]> {
  if (arquivos.length === 0) return [];
  const acesso = await acessoEntidade(a, alvo);
  if (!acesso.podeLer) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
  if (!acesso.podeEnviar) throw new ErroNegocio("Sem permissão para anexar arquivos neste registro.");
  const validados = await validarArquivos(a, arquivos);
  const armazenamento = getArmazenamento();
  const sensivel = TIPOS_SENSIVEIS.includes(alvo.tipo);
  const criados: Anexo[] = [];
  for (const { dados, v } of validados) {
    const chave = await armazenamento.salvar(montarChave(a.empresaId, alvo.tipo, v.nomeSanitizado), dados, v.mimeType);
    try {
      criados.push(
        await a.db.anexo.create({
          data: {
            empresaId: a.empresaId,
            entidadeTipo: alvo.tipo,
            entidadeId: alvo.entidadeId,
            nomeArquivo: v.nome,
            mimeType: v.mimeType,
            tamanhoBytes: dados.byteLength,
            chaveArmazenamento: chave,
            url: null, // nunca guardamos/expomos URL pública
            sensivel,
            enviadoPorId: a.usuarioId,
          },
        }),
      );
    } catch (e) {
      await armazenamento.excluir(chave).catch(() => undefined);
      throw e;
    }
  }
  return criados;
}

export type AnexoListado = Pick<
  Anexo,
  "id" | "entidadeTipo" | "entidadeId" | "nomeArquivo" | "mimeType" | "tamanhoBytes" | "sensivel" | "enviadoPorId" | "criadoEm"
> & {
  enviadoPor: { nome: string };
  podeExcluir: boolean;
};

const selecao = {
  id: true,
  entidadeTipo: true,
  entidadeId: true,
  nomeArquivo: true,
  mimeType: true,
  tamanhoBytes: true,
  sensivel: true,
  enviadoPorId: true,
  criadoEm: true,
  enviadoPor: { select: { nome: true } },
} as const;

/** Anexos ativos de uma entidade, com checagem de acesso. */
export async function listarAnexos(a: Ator, alvo: Alvo): Promise<AnexoListado[]> {
  const acesso = await acessoEntidade(a, alvo);
  if (!acesso.podeLer) return [];
  const rs = await a.db.anexo.findMany({
    where: {
      entidadeTipo: alvo.tipo,
      entidadeId: alvo.entidadeId,
      excluidoEm: null,
      ...(podeVerSensivel(a, alvo.tipo) ? {} : { sensivel: false }),
    },
    select: selecao,
    orderBy: { criadoEm: "asc" },
  });
  return rs.map((r) => ({ ...r, podeExcluir: !acesso.rncFinal && !acesso.imutavel && (r.enviadoPorId === a.usuarioId || acesso.podeGerir) }));
}

/** Anexos de várias entidades do mesmo tipo (ex.: itens de um plano), cada uma com checagem de acesso. */
export async function listarAnexosDe(a: Ator, tipo: TipoEntidadeAnexo, ids: string[]) {
  const mapa = new Map<string, AnexoListado[]>();
  await Promise.all([...new Set(ids)].map(async (id) => mapa.set(id, await listarAnexos(a, { tipo, entidadeId: id }))));
  return mapa;
}

/** Anexo + stream para download, revalidando empresa (DbTenant), entidade e sensibilidade. null = sem acesso/inexistente. */
export async function abrirAnexo(a: Ator, anexoId: string) {
  const anexo = await a.db.anexo.findFirst({ where: { id: anexoId, excluidoEm: null } });
  if (!anexo) return null;
  if (anexo.sensivel && !podeVerSensivel(a, anexo.entidadeTipo)) return null;
  const acesso = await acessoEntidade(a, { tipo: anexo.entidadeTipo, entidadeId: anexo.entidadeId });
  if (!acesso.podeLer) return null;
  const stream = await getArmazenamento().ler(anexo.chaveArmazenamento);
  if (!stream) return null;
  return { anexo, stream };
}

/** Soft delete: somente o autor ou um gestor. Anexos de RNC registram evento no histórico. */
export async function excluirAnexo(a: Ator, anexoId: string) {
  const anexo = await a.db.anexo.findFirst({ where: { id: anexoId, excluidoEm: null } });
  if (!anexo || (anexo.sensivel && !podeVerSensivel(a, anexo.entidadeTipo))) throw new ErroNegocio("Anexo não encontrado.");
  const acesso = await acessoEntidade(a, { tipo: anexo.entidadeTipo, entidadeId: anexo.entidadeId });
  if (!acesso.podeLer) throw new ErroNegocio("Anexo não encontrado.");
  if (acesso.rncFinal) throw new ErroNegocio("Anexos de RNC encerrada ou cancelada não podem ser excluídos.");
  if (acesso.imutavel) throw new ErroNegocio(acesso.imutavel);
  if (anexo.enviadoPorId !== a.usuarioId && !acesso.podeGerir) {
    throw new ErroNegocio("Somente quem enviou o anexo ou um gestor pode excluí-lo.");
  }
  await a.db.$transaction(async (tx) => {
    const r = await tx.anexo.updateMany({
      where: { id: anexoId, excluidoEm: null },
      data: { excluidoEm: new Date(), excluidoPorId: a.usuarioId },
    });
    if (r.count === 0) throw new ErroNegocio("Anexo já excluído.");
    if (acesso.rncId) {
      const rnc = await tx.rnc.findFirst({ where: { id: acesso.rncId }, select: { status: true } });
      if (!rnc) return;
      await tx.historicoStatusRnc.create({
        data: {
          empresaId: a.empresaId,
          rncId: acesso.rncId,
          statusAnterior: rnc.status,
          statusNovo: rnc.status,
          usuarioId: a.usuarioId,
          // Nome de anexo sensível não vai para o histórico (LGPD).
          motivo: anexo.sensivel ? "Anexo de dados sensíveis excluído." : `Anexo excluído: ${anexo.nomeArquivo}`,
          metadados: { evento: "ANEXO_EXCLUIDO", anexoId: anexo.id, entidadeTipo: anexo.entidadeTipo },
        },
      });
    }
  });
}
