/**
 * Incidentes e acidentes (P6, ISO 45001 10.2) — serviço de domínio.
 * Registro (INC-NNN-AA) com dados pessoais protegidos (LGPD, mesmo padrão da RNC restrita/RncDadosSensiveis), ciclo
 * ABERTO → EM_INVESTIGACAO → CONCLUIDO, análise de causa raiz (mesmo formato da RNC: metodoCausaRaiz + analiseCausa),
 * plano de ação de investigação (origem INCIDENTE) e histórico append-only.
 */
import type { GravidadeIncidente, MetodoCausaRaiz, Prisma, StatusIncidente, TipoIncidente } from "@prisma/client";
import { fusoDaEmpresa, type Ator, type Tx } from "@/lib/ator";
import { anoNoFuso } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { obraNoEscopo } from "@/lib/escopo-obras";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { notificarItensAtribuidos } from "@/lib/notificacoes/gatilhos";
import { comSeguranca, criarNotificacoes, type NovaNotificacao } from "@/lib/notificacoes/servico";
import { criarPlanoNaTransacao, type DadosItem } from "@/lib/plano-acao/servico";
import { MAX_CAUSA_RAIZ, validarAnalise } from "@/lib/rnc/analise";
import { formatarCodigoAnual, proximaSequencia } from "@/lib/rnc/numeracao";
import {
  exigirModuloIncidentes,
  filtroAcessoIncidente,
  linkIncidente,
  moduloIncidentesAtivo,
  podeGerenciarIncidentes,
  podeTratarIncidente,
  podeVerRestritosIncidente,
} from "./acesso";
import {
  classificarPrivacidade,
  contarPorGravidade,
  contarPorTipo,
  exigirStatus,
  GRAVIDADES_INCIDENTE,
  ROTULO_GRAVIDADE_INCIDENTE,
  ROTULO_TIPO_INCIDENTE,
  taxaMensal,
  temSensiveis,
  TIPOS_INCIDENTE,
  tituloPlanoIncidente,
  type SensiveisIncidente,
} from "./regras";

export * from "./acesso";

const texto = (s: string | null | undefined, nome: string, min: number, max: number) => {
  const t = (s ?? "").trim();
  if (t.length < min) throw new ErroNegocio(`Informe ${nome}.`);
  if (t.length > max) throw new ErroNegocio(`${nome[0].toUpperCase()}${nome.slice(1)} excede ${max} caracteres.`);
  return t;
};
const opcional = (s: string | null | undefined, nome: string, max: number) => {
  const t = s?.trim() || null;
  if (t && t.length > max) throw new ErroNegocio(`${nome} excede ${max} caracteres.`);
  return t;
};

/** "YYYY-MM-DDTHH:mm" no fuso da empresa → instante UTC. Date é aceito como está. */
export function dataHoraNoFuso(v: string | Date, fuso: string): Date {
  if (v instanceof Date) return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) throw new ErroNegocio("Data/hora inválida.");
  const [a, mes, d, h, mi] = m.slice(1).map(Number);
  const palpite = Date.UTC(a, mes - 1, d, h, mi);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(palpite))
      .map((x) => [x.type, x.value]),
  );
  const exibido = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return new Date(palpite - (exibido - palpite));
}

/** Instante → "YYYY-MM-DDTHH:mm" no fuso (valor de input datetime-local). */
export function dataHoraLocal(d: Date, fuso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// ---------------------------------------------------------------- leitura

export interface FiltrosIncidente {
  obra?: string;
  tipo?: TipoIncidente;
  gravidade?: GravidadeIncidente;
  status?: StatusIncidente;
}

export async function opcoesIncidentes(a: Ator) {
  const [obras, setores, usuarios] = await Promise.all([
    a.db.obraUnidade.findMany({ where: { ativo: true, ...(a.obrasPermitidas === null ? {} : { id: { in: [...a.obrasPermitidas] } }) }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.setor.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return { obras, setores, usuarios };
}

export async function listarIncidentes(a: Ator, f: FiltrosIncidente = {}) {
  await exigirModuloIncidentes(a);
  return a.db.incidente.findMany({
    where: {
      AND: [
        filtroAcessoIncidente(a),
        f.obra ? { obraId: f.obra } : {},
        f.tipo ? { tipo: f.tipo } : {},
        f.gravidade ? { gravidade: f.gravidade } : {},
        f.status ? { status: f.status } : {},
      ],
    },
    select: {
      id: true,
      codigo: true,
      tipo: true,
      gravidade: true,
      dataHora: true,
      status: true,
      restrita: true,
      local: true,
      diasPerdidos: true,
      geraCat: true,
      planoAcaoId: true,
      obra: { select: { id: true, nome: true } },
      setor: { select: { nome: true } },
      responsavel: { select: { nome: true } },
    },
    orderBy: [{ dataHora: "desc" }],
    take: 300,
  });
}

/**
 * Detalhe do incidente. Sem INCIDENTE_VER_RESTRITOS, envolvido/terceiro/testemunhas e dados sensíveis saem como null
 * (e o objeto não indica que existam).
 */
export async function obterIncidente(a: Ator, id: string) {
  await exigirModuloIncidentes(a);
  const ver = podeVerRestritosIncidente(a);
  const i = await a.db.incidente.findFirst({
    where: { AND: [{ id }, filtroAcessoIncidente(a)] },
    include: {
      obra: { select: { id: true, nome: true } },
      setor: { select: { id: true, nome: true } },
      envolvido: { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      registradoPor: { select: { id: true, nome: true } },
      dadosSensiveis: ver,
      planoAcao: {
        select: {
          id: true,
          titulo: true,
          itens: { orderBy: { ordem: "asc" }, select: { id: true, oQue: true, status: true, quando: true, dataConclusao: true, semEvidencia: true, quem: { select: { nome: true } } } },
        },
      },
    },
  });
  if (!i) return null;
  if (ver) return i;
  return { ...i, envolvidoId: null, envolvido: null, terceiroNome: null, terceiroFuncao: null, testemunhas: null, contemDadosPessoais: false, dadosSensiveis: null };
}

export async function listarHistoricoIncidente(a: Ator, incidenteId: string) {
  await exigirModuloIncidentes(a);
  const i = await a.db.incidente.findFirst({ where: { AND: [{ id: incidenteId }, filtroAcessoIncidente(a)] }, select: { id: true } });
  if (!i) return [];
  return a.db.historicoIncidente.findMany({ where: { incidenteId }, include: { usuario: { select: { nome: true } } }, orderBy: { criadoEm: "desc" } });
}

/** Dashboard: últimos 12 meses, incidentes visíveis ao ator. null sem o módulo. */
export async function resumoIncidentes(a: Ator, agora = new Date()) {
  if (!(await moduloIncidentesAtivo(a))) return null;
  const desde = new Date(agora);
  desde.setUTCMonth(desde.getUTCMonth() - 12);
  const xs = await a.db.incidente.findMany({
    where: { AND: [filtroAcessoIncidente(a), { dataHora: { gte: desde, lte: agora } }] },
    select: { gravidade: true, tipo: true, status: true, diasPerdidos: true },
  });
  return {
    total: xs.length,
    porGravidade: contarPorGravidade(xs),
    porTipo: contarPorTipo(xs),
    abertos: xs.filter((x) => x.status !== "CONCLUIDO").length,
    diasPerdidos: xs.reduce((s, x) => s + (x.diasPerdidos ?? 0), 0),
    taxaMensal: taxaMensal(xs.length, 12),
  };
}

// ---------------------------------------------------------------- escrita

export interface DadosIncidente {
  tipo: TipoIncidente;
  gravidade: GravidadeIncidente;
  /** "YYYY-MM-DDTHH:mm" no fuso da empresa (ou Date). */
  dataHora: string | Date;
  obraId: string;
  setorId?: string | null;
  local?: string | null;
  descricaoFatos: string;
  diasPerdidos?: number | null;
  geraCat?: boolean;
  numeroCat?: string | null;
}

export interface DadosRegistroIncidente extends DadosIncidente {
  envolvidoId?: string | null;
  terceiroNome?: string | null;
  terceiroFuncao?: string | null;
  testemunhas?: string | null;
  restrita?: boolean;
  sensiveis?: SensiveisIncidente | null;
}

async function dadosPrincipais(tx: Tx, a: Ator, d: DadosIncidente, fuso: string) {
  if (!TIPOS_INCIDENTE.includes(d.tipo)) throw new ErroNegocio("Tipo inválido.");
  if (!GRAVIDADES_INCIDENTE.includes(d.gravidade)) throw new ErroNegocio("Gravidade inválida.");
  const dataHora = dataHoraNoFuso(d.dataHora, fuso);
  if (Number.isNaN(dataHora.getTime())) throw new ErroNegocio("Data/hora inválida.");
  if (dataHora.getTime() > Date.now() + 5 * 60_000) throw new ErroNegocio("A data/hora do incidente não pode ser futura.");
  if (!obraNoEscopo(a, d.obraId) || !(await tx.obraUnidade.findFirst({ where: { id: d.obraId, ativo: true }, select: { id: true } }))) {
    throw new ErroNegocio("Unidade inválida ou sem acesso.");
  }
  if (d.setorId && !(await tx.setor.findFirst({ where: { id: d.setorId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Setor inválido.");
  const diasPerdidos = d.diasPerdidos ?? null;
  if (diasPerdidos !== null && (!Number.isInteger(diasPerdidos) || diasPerdidos < 0 || diasPerdidos > 10_000)) throw new ErroNegocio("Dias perdidos inválidos.");
  if (diasPerdidos && d.gravidade === "SEM_AFASTAMENTO") throw new ErroNegocio("Incidente sem afastamento não tem dias perdidos.");
  return {
    tipo: d.tipo,
    gravidade: d.gravidade,
    dataHora,
    obraId: d.obraId,
    setorId: d.setorId || null,
    local: opcional(d.local, "Local", 300),
    descricaoFatos: texto(d.descricaoFatos, "a descrição dos fatos", 5, 8000),
    diasPerdidos,
    geraCat: !!d.geraCat,
    numeroCat: d.geraCat ? opcional(d.numeroCat, "Número da CAT", 60) : null,
  };
}

async function historico(
  tx: Tx,
  a: Pick<Ator, "empresaId" | "usuarioId">,
  incidenteId: string,
  acao: "REGISTRO" | "ALTERACAO" | "INVESTIGACAO" | "STATUS" | "PLANO" | "RESPONSAVEL",
  statusAnterior: StatusIncidente | null,
  statusNovo: StatusIncidente,
  observacao?: string | null,
) {
  await tx.historicoIncidente.create({
    data: { empresaId: a.empresaId, incidenteId, acao, statusAnterior, statusNovo, observacao: observacao?.slice(0, 1000) || null, usuarioId: a.usuarioId },
  });
}

async function carregar(tx: Tx, a: Ator, id: string) {
  const i = await tx.incidente.findFirst({ where: { AND: [{ id }, filtroAcessoIncidente(a)] } });
  if (!i) throw new ErroNegocio("Incidente não encontrado ou sem acesso.");
  return i;
}
type Registro = Awaited<ReturnType<typeof carregar>>;

async function carregarTratavel(tx: Tx, a: Ator, id: string, versao?: number) {
  const i = await carregar(tx, a, id);
  if (!podeTratarIncidente(a, i)) throw new ErroNegocio("Somente quem gerencia incidentes (INCIDENTE_GERENCIAR) ou o responsável pela investigação pode alterar este incidente.");
  if (versao !== undefined && versao !== i.versao) throw new ErroConflito();
  return i;
}

async function travar(tx: Tx, i: { id: string; versao: number; status: StatusIncidente }, data: Prisma.IncidenteUncheckedUpdateManyInput = {}) {
  const r = await tx.incidente.updateMany({ where: { id: i.id, versao: i.versao, status: i.status }, data: { ...data, versao: { increment: 1 } } });
  if (r.count === 0) throw new ErroConflito();
}

/** Responsável pela investigação: ativo, com acesso à obra e, se o incidente for restrito, INCIDENTE_VER_RESTRITOS. */
async function validarResponsavel(tx: Tx, responsavelId: string, i: { obraId: string; restrita: boolean }) {
  const u = (await usuariosAtivos(tx)).find((x) => x.id === responsavelId);
  if (!u) throw new ErroNegocio("Responsável inválido.");
  if (u.obras !== null && !u.obras.includes(i.obraId)) throw new ErroNegocio("O responsável não tem acesso à unidade deste incidente.");
  if (i.restrita && !u.permissoes.includes("INCIDENTE_VER_RESTRITOS")) {
    throw new ErroNegocio("Incidente restrito: o responsável precisa da permissão de ver incidentes restritos.");
  }
}

/**
 * Registra o incidente (qualquer usuário com o módulo e a obra no escopo). Com envolvido/terceiro/testemunhas/dados
 * sensíveis o registro fica restrito (LGPD). Notifica quem gerencia incidentes e pode vê-lo (sem dados pessoais).
 */
export async function registrarIncidente(a: Ator, d: DadosRegistroIncidente) {
  await exigirModuloIncidentes(a);
  const fuso = await fusoDaEmpresa(a);
  const ano = anoNoFuso(fuso);
  const terceiroNome = opcional(d.terceiroNome, "Nome do terceiro", 200);
  if (d.envolvidoId && terceiroNome) throw new ErroNegocio("Informe o envolvido (usuário) ou o terceiro, não os dois.");
  const terceiroFuncao = terceiroNome ? opcional(d.terceiroFuncao, "Função do terceiro", 200) : null;
  const testemunhas = opcional(d.testemunhas, "Testemunhas", 2000);
  const sensiveis = d.sensiveis
    ? {
        nomeEnvolvido: opcional(d.sensiveis.nomeEnvolvido, "Nome do envolvido", 200),
        documentoEnvolvido: opcional(d.sensiveis.documentoEnvolvido, "Documento", 60),
        funcaoEnvolvido: opcional(d.sensiveis.funcaoEnvolvido, "Função", 200),
        relato: opcional(d.sensiveis.relato, "Relato", 8000),
        lesaoDescricao: opcional(d.sensiveis.lesaoDescricao, "Lesão", 4000),
        testemunhasRelato: opcional(d.sensiveis.testemunhasRelato, "Relato das testemunhas", 8000),
      }
    : null;
  const priv = classificarPrivacidade({ envolvidoId: d.envolvidoId, terceiroNome, testemunhas, sensiveis, restrita: d.restrita });
  const criado = await a.db.$transaction(async (tx) => {
    const dados = await dadosPrincipais(tx, a, d, fuso);
    if (d.envolvidoId && !(await tx.usuario.findFirst({ where: { id: d.envolvidoId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Envolvido inválido.");
    const sequencia = await proximaSequencia(tx, a.empresaId, "INCIDENTE", ano);
    const inc = await tx.incidente.create({
      data: {
        ...dados,
        empresaId: a.empresaId,
        ano,
        sequencia,
        codigo: formatarCodigoAnual("INC", sequencia, ano),
        envolvidoId: d.envolvidoId || null,
        terceiroNome,
        terceiroFuncao,
        testemunhas,
        restrita: priv.restrita,
        contemDadosPessoais: priv.contemDadosPessoais,
        registradoPorId: a.usuarioId,
      },
    });
    if (sensiveis && temSensiveis(sensiveis)) await tx.incidenteDadosSensiveis.create({ data: { ...sensiveis, empresaId: a.empresaId, incidenteId: inc.id } });
    await historico(tx, a, inc.id, "REGISTRO", null, "ABERTO", priv.restrita ? "Registro restrito (dados pessoais protegidos)." : null);
    return inc;
  });
  await notificarRegistro(a, criado);
  return criado;
}

async function notificarRegistro(a: Ator, i: Pick<Registro, "id" | "codigo" | "tipo" | "gravidade" | "obraId" | "restrita">) {
  await comSeguranca("incidente-registrado", async () => {
    const obra = await a.db.obraUnidade.findFirst({ where: { id: i.obraId }, select: { nome: true } });
    const us = (await usuariosAtivos(a.db)).filter(
      (u) =>
        u.id !== a.usuarioId &&
        u.permissoes.includes("INCIDENTE_GERENCIAR") &&
        (u.obras === null || u.obras.includes(i.obraId)) &&
        (!i.restrita || u.permissoes.includes("INCIDENTE_VER_RESTRITOS")),
    );
    const lista: NovaNotificacao[] = us.map((u) => ({
      usuarioId: u.id,
      tipo: "INCIDENTE_REGISTRADO",
      entidadeTipo: "INCIDENTE",
      entidadeId: i.id,
      titulo: `Incidente ${i.codigo} registrado`,
      corpo: `${ROTULO_TIPO_INCIDENTE[i.tipo]} (${ROTULO_GRAVIDADE_INCIDENTE[i.gravidade].toLowerCase()}) em ${obra?.nome ?? "unidade"}.`,
      link: linkIncidente(i.id),
      chave: `incidente-registrado:${i.id}:${u.id}`,
    }));
    await criarNotificacoes(a.db, a.empresaId, lista);
  });
}

async function notificarResponsavel(a: Ator, i: { id: string; codigo: string; responsavelId: string | null }) {
  if (!i.responsavelId || i.responsavelId === a.usuarioId) return;
  const uid = i.responsavelId;
  await comSeguranca("incidente-atribuido", async () => {
    await criarNotificacoes(a.db, a.empresaId, [
      {
        usuarioId: uid,
        tipo: "INCIDENTE_ATRIBUIDO",
        entidadeTipo: "INCIDENTE",
        entidadeId: i.id,
        titulo: `Investigação do incidente ${i.codigo}`,
        corpo: `Você é o responsável pela investigação do incidente ${i.codigo}.`,
        link: linkIncidente(i.id),
        chave: `incidente-responsavel:${i.id}:${uid}`,
      },
    ]);
  });
}

/** Edita os dados do registro (não os dados pessoais) — INCIDENTE_GERENCIAR ou responsável, antes da conclusão. */
export async function editarIncidente(a: Ator, id: string, d: DadosIncidente, versao?: number) {
  await exigirModuloIncidentes(a);
  const fuso = await fusoDaEmpresa(a);
  await a.db.$transaction(async (tx) => {
    const i = await carregarTratavel(tx, a, id, versao);
    exigirStatus(i.status, "EDITAR");
    const dados = await dadosPrincipais(tx, a, d, fuso);
    await travar(tx, i, dados);
    await historico(tx, a, id, "ALTERACAO", i.status, i.status, "Dados do registro alterados.");
  });
}

/** Define/troca o responsável pela investigação (INCIDENTE_GERENCIAR). */
export async function definirResponsavel(a: Ator, id: string, responsavelId: string, versao?: number) {
  await exigirModuloIncidentes(a);
  if (!podeGerenciarIncidentes(a)) throw new ErroNegocio("Sem permissão para designar o responsável (INCIDENTE_GERENCIAR).");
  const r = await a.db.$transaction(async (tx) => {
    const i = await carregar(tx, a, id);
    if (versao !== undefined && versao !== i.versao) throw new ErroConflito();
    exigirStatus(i.status, "EDITAR");
    if (i.responsavelId === responsavelId) throw new ErroNegocio("Este usuário já é o responsável.");
    await validarResponsavel(tx, responsavelId, i);
    await travar(tx, i, { responsavelId });
    await historico(tx, a, id, "RESPONSAVEL", i.status, i.status);
    return { id, codigo: i.codigo, responsavelId };
  });
  await notificarResponsavel(a, r);
}

/** ABERTO → EM_INVESTIGACAO. Sem responsável, quem inicia assume (precisa poder ver restritos se o incidente for restrito). */
export async function iniciarInvestigacao(a: Ator, id: string, versao?: number) {
  await exigirModuloIncidentes(a);
  await a.db.$transaction(async (tx) => {
    const i = await carregarTratavel(tx, a, id, versao);
    exigirStatus(i.status, "INICIAR_INVESTIGACAO");
    const responsavelId = i.responsavelId ?? a.usuarioId;
    if (!i.responsavelId) await validarResponsavel(tx, responsavelId, i);
    await travar(tx, i, { status: "EM_INVESTIGACAO", responsavelId });
    await historico(tx, a, id, "STATUS", i.status, "EM_INVESTIGACAO");
  });
}

export interface DadosInvestigacao {
  metodo: MetodoCausaRaiz;
  analise: unknown;
  causaRaiz: string;
}

/** Registra a análise de causa raiz (mesmo formato validado da RNC: 5 porquês / Ishikawa 6M / texto). */
export async function salvarInvestigacao(a: Ator, id: string, d: DadosInvestigacao, versao?: number) {
  await exigirModuloIncidentes(a);
  const analise = validarAnalise(d.metodo, d.analise);
  const causaRaiz = texto(d.causaRaiz, "a causa raiz", 3, MAX_CAUSA_RAIZ);
  await a.db.$transaction(async (tx) => {
    const i = await carregarTratavel(tx, a, id, versao);
    exigirStatus(i.status, "INVESTIGAR");
    await travar(tx, i, { metodoCausaRaiz: d.metodo, analiseCausa: analise as Prisma.InputJsonValue, causaRaiz, status: "EM_INVESTIGACAO", responsavelId: i.responsavelId ?? a.usuarioId });
    await historico(tx, a, id, "INVESTIGACAO", i.status, "EM_INVESTIGACAO", "Análise de causa raiz registrada.");
  });
}

/** Plano de ação de investigação (origem INCIDENTE). Título neutro quando restrito. */
export async function gerarPlanoIncidente(a: Ator, id: string, d: { titulo?: string | null; itens: DadosItem[] }) {
  await exigirModuloIncidentes(a);
  const r = await a.db.$transaction(async (tx) => {
    const i = await carregarTratavel(tx, a, id);
    exigirStatus(i.status, "GERAR_PLANO");
    if (i.planoAcaoId) throw new ErroNegocio("Este incidente já tem plano de ação vinculado.");
    const plano = await criarPlanoNaTransacao(
      tx,
      a,
      { titulo: tituloPlanoIncidente(i, d.titulo), descricao: `Plano de ação da investigação do incidente ${i.codigo}.`, obraId: i.obraId, itens: d.itens },
      { tipo: "INCIDENTE", id: i.id },
    );
    await travar(tx, i, { planoAcaoId: plano.id });
    await historico(tx, a, id, "PLANO", i.status, i.status, "Plano de ação gerado.");
    return plano;
  });
  await notificarItensAtribuidos(a, r.itemIds, "criado");
  return { id: r.id };
}

/** EM_INVESTIGACAO → CONCLUIDO: exige causa raiz registrada. */
export async function concluirIncidente(a: Ator, id: string, d: { conclusao: string; diasPerdidos?: number | null }, versao?: number) {
  await exigirModuloIncidentes(a);
  const conclusao = texto(d.conclusao, "a conclusão da investigação", 3, 8000);
  await a.db.$transaction(async (tx) => {
    const i = await carregarTratavel(tx, a, id, versao);
    exigirStatus(i.status, "CONCLUIR");
    if (!i.causaRaiz) throw new ErroNegocio("Registre a análise de causa raiz antes de concluir.");
    const dias = d.diasPerdidos === undefined ? i.diasPerdidos : d.diasPerdidos;
    if (dias != null && (!Number.isInteger(dias) || dias < 0)) throw new ErroNegocio("Dias perdidos inválidos.");
    if (dias && i.gravidade === "SEM_AFASTAMENTO") throw new ErroNegocio("Incidente sem afastamento não tem dias perdidos.");
    await travar(tx, i, { status: "CONCLUIDO", conclusao, diasPerdidos: dias ?? null, concluidoEm: new Date() });
    await historico(tx, a, id, "STATUS", i.status, "CONCLUIDO", "Investigação concluída.");
  });
}
