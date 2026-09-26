import type { Anexo, TipoEntidadeAnexo } from "@prisma/client";
import { atorTem, type Ator } from "@/lib/ator";
import { getArmazenamento, montarChave } from "@/lib/armazenamento";
import { ErroNegocio } from "@/lib/erros";
import { STATUS_FINAIS } from "@/lib/rnc/estados";
import { filtroAcessoItem, filtroAcessoRnc, podeGerenciarPlanoRnc, podeTratarRnc, podeVerDadosSensiveis } from "@/lib/rnc/servico";
import { limiteBytes, MAX_ARQUIVOS_POR_ENVIO, validarArquivo } from "./validacao";

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
}

const NEGADO: AcessoEntidade = { podeLer: false, podeEnviar: false, podeGerir: false, rncId: null };

function gestorRnc(a: Ator, rnc: { responsavelId: string | null }) {
  return atorTem(a, "PLANO_GERENCIAR") || podeTratarRnc(a, rnc);
}

/** Regras de acesso por tipo de entidade (sempre dentro da empresa do ator, via DbTenant). */
async function acessoEntidade(a: Ator, alvo: Alvo): Promise<AcessoEntidade> {
  const rncVisivel = (id: string) =>
    a.db.rnc.findFirst({ where: { AND: [{ id }, filtroAcessoRnc(a)] }, select: { id: true, status: true, responsavelId: true } });

  switch (alvo.tipo) {
    case "RNC":
    case "RNC_DADOS_SENSIVEIS": {
      if (alvo.tipo === "RNC_DADOS_SENSIVEIS" && !podeVerDadosSensiveis(a)) return NEGADO;
      const rnc = await rncVisivel(alvo.entidadeId);
      if (!rnc) return NEGADO;
      return { podeLer: true, podeEnviar: !STATUS_FINAIS.includes(rnc.status), podeGerir: gestorRnc(a, rnc), rncId: rnc.id };
    }
    case "VERIFICACAO_EFICACIA": {
      const v = await a.db.verificacaoEficacia.findFirst({
        where: { id: alvo.entidadeId },
        select: { verificadorId: true, rncId: true },
      });
      if (!v) return NEGADO;
      const rnc = await rncVisivel(v.rncId);
      if (!rnc) return NEGADO;
      return { podeLer: true, podeEnviar: v.verificadorId === a.usuarioId, podeGerir: atorTem(a, "PLANO_GERENCIAR"), rncId: rnc.id };
    }
    case "ITEM_ACAO": {
      const item = await a.db.itemAcao.findFirst({
        where: { AND: [{ id: alvo.entidadeId }, filtroAcessoItem(a)] },
        select: { quemId: true, status: true, planoAcao: { select: { rnc: { select: { id: true, responsavelId: true } } } } },
      });
      if (!item) return NEGADO;
      const rnc = item.planoAcao.rnc;
      const gerencia = rnc ? !!(await rncVisivel(rnc.id)) && podeGerenciarPlanoRnc(a, rnc) : atorTem(a, "PLANO_GERENCIAR");
      return {
        podeLer: true,
        podeEnviar: item.status !== "CANCELADO" && (item.quemId === a.usuarioId || gerencia),
        podeGerir: gerencia,
        rncId: null,
      };
    }
    case "PLANO_ACAO": {
      const plano = await a.db.planoAcao.findFirst({
        where: { id: alvo.entidadeId },
        select: { criadoPorId: true, rnc: { select: { id: true, responsavelId: true } } },
      });
      if (!plano) return NEGADO;
      if (plano.rnc) {
        if (!(await rncVisivel(plano.rnc.id))) return NEGADO;
        const g = podeGerenciarPlanoRnc(a, plano.rnc);
        return { podeLer: true, podeEnviar: g, podeGerir: g, rncId: null };
      }
      const g = atorTem(a, "PLANO_GERENCIAR");
      const ler = g || plano.criadoPorId === a.usuarioId;
      return { podeLer: ler, podeEnviar: ler, podeGerir: g, rncId: null };
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
  const validados = await validarArquivos(a, arquivos);
  const acesso = await acessoEntidade(a, alvo);
  if (!acesso.podeLer) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
  if (!acesso.podeEnviar) throw new ErroNegocio("Sem permissão para anexar arquivos neste registro.");
  const armazenamento = getArmazenamento();
  const sensivel = alvo.tipo === "RNC_DADOS_SENSIVEIS";
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
      ...(podeVerDadosSensiveis(a) ? {} : { sensivel: false }),
    },
    select: selecao,
    orderBy: { criadoEm: "asc" },
  });
  return rs.map((r) => ({ ...r, podeExcluir: r.enviadoPorId === a.usuarioId || acesso.podeGerir }));
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
  if (anexo.sensivel && !podeVerDadosSensiveis(a)) return null;
  const acesso = await acessoEntidade(a, { tipo: anexo.entidadeTipo, entidadeId: anexo.entidadeId });
  if (!acesso.podeLer) return null;
  const stream = await getArmazenamento().ler(anexo.chaveArmazenamento);
  if (!stream) return null;
  return { anexo, stream };
}

/** Soft delete: somente o autor ou um gestor. Anexos de RNC registram evento no histórico. */
export async function excluirAnexo(a: Ator, anexoId: string) {
  const anexo = await a.db.anexo.findFirst({ where: { id: anexoId, excluidoEm: null } });
  if (!anexo || (anexo.sensivel && !podeVerDadosSensiveis(a))) throw new ErroNegocio("Anexo não encontrado.");
  const acesso = await acessoEntidade(a, { tipo: anexo.entidadeTipo, entidadeId: anexo.entidadeId });
  if (!acesso.podeLer) throw new ErroNegocio("Anexo não encontrado.");
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
