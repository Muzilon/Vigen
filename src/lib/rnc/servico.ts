import { Prisma, type Gravidade, type MetodoCausaRaiz, type OrigemRnc, type StatusRnc, type TipoRnc } from "@prisma/client";
import { atorTem, fusoDaEmpresa, type Ator, type Tx } from "@/lib/ator";
import { anoNoFuso } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { avaliarTransicao, cicloAtual, STATUS_FINAIS, type AcaoRnc } from "@/lib/rnc/estados";
import { formatarCodigoRnc, proximaSequenciaRnc } from "@/lib/rnc/numeracao";

// ---------------------------------------------------------------- visibilidade

function condicoesEnvolvido(a: Ator): Prisma.RncWhereInput[] {
  return [
    { abertoPorId: a.usuarioId },
    { responsavelId: a.usuarioId },
    { planoAcao: { is: { itens: { some: { quemId: a.usuarioId } } } } },
  ];
}

/** Restrição de RNCs restritas (sem filtro de obra). */
export function filtroRestricaoRnc(a: Ator): Prisma.RncWhereInput {
  if (atorTem(a, "RNC_VER_RESTRITAS")) return {};
  return { OR: [{ restrita: false }, ...condicoesEnvolvido(a)] };
}

/** Acesso a uma RNC específica: (obra permitida OU envolvido) E regra de restrita. */
export function filtroAcessoRnc(a: Ator): Prisma.RncWhereInput {
  const and: Prisma.RncWhereInput[] = [filtroRestricaoRnc(a)];
  if (a.obrasPermitidas !== null) {
    and.push({ OR: [{ obraId: { in: [...a.obrasPermitidas] } }, ...condicoesEnvolvido(a)] });
  }
  return { AND: and };
}

type RncEnvolvimento = {
  abertoPorId: string;
  responsavelId: string | null;
  planoAcao?: { itens: { quemId: string }[] } | null;
};

export function ehEnvolvido(a: Ator, rnc: RncEnvolvimento) {
  return (
    rnc.abertoPorId === a.usuarioId ||
    rnc.responsavelId === a.usuarioId ||
    !!rnc.planoAcao?.itens.some((i) => i.quemId === a.usuarioId)
  );
}

export function podeVerDadosSensiveis(a: Ator, rnc: RncEnvolvimento) {
  return atorTem(a, "RNC_VER_RESTRITAS") || ehEnvolvido(a, rnc);
}

/** Pode tratar (causa raiz, plano, transições de execução): responsável da RNC ou PLANO_GERENCIAR. */
export function podeGerenciarPlanoRnc(a: Ator, rnc: { responsavelId: string | null }) {
  return atorTem(a, "PLANO_GERENCIAR") || rnc.responsavelId === a.usuarioId;
}

// ---------------------------------------------------------------- leitura

const incluirParaRegra = {
  planoAcao: { include: { itens: true } },
  verificacoes: { orderBy: { tentativa: "asc" } },
} satisfies Prisma.RncInclude;

async function carregar(db: Tx, a: Ator, id: string) {
  const rnc = await db.rnc.findFirst({ where: { AND: [{ id }, filtroAcessoRnc(a)] }, include: incluirParaRegra });
  if (!rnc) throw new ErroNegocio("RNC não encontrada ou sem acesso.");
  return rnc;
}

function exigirVersao(rnc: { versao: number }, versao: number | undefined) {
  if (versao !== undefined && rnc.versao !== versao) throw new ErroConflito();
}

export function itensDoCiclo<T extends { ciclo: number }>(itens: readonly T[], ciclo: number) {
  return itens.filter((i) => i.ciclo === ciclo);
}

// ---------------------------------------------------------------- transição genérica

async function transicionar(
  tx: Tx,
  a: Ator,
  rnc: { id: string; versao: number; status: StatusRnc },
  para: StatusRnc,
  extra: Prisma.RncUncheckedUpdateManyInput = {},
  motivo?: string | null,
  metadados?: Prisma.InputJsonValue,
) {
  const r = await tx.rnc.updateMany({
    where: { id: rnc.id, versao: rnc.versao, status: rnc.status },
    data: { ...extra, status: para, versao: { increment: 1 } },
  });
  if (r.count === 0) throw new ErroConflito();
  await tx.historicoStatusRnc.create({
    data: {
      empresaId: a.empresaId,
      rncId: rnc.id,
      statusAnterior: rnc.status,
      statusNovo: para,
      usuarioId: a.usuarioId,
      motivo: motivo ?? null,
      metadados,
    },
  });
}

type RncCarregada = Awaited<ReturnType<typeof carregar>>;

function snapshot(rnc: RncCarregada) {
  const ciclo = cicloAtual(rnc.verificacoes);
  return {
    status: rnc.status,
    causaRaiz: rnc.causaRaiz,
    itensCicloAtual: itensDoCiclo(rnc.planoAcao?.itens ?? [], ciclo).map((i) => i.status),
  };
}

function checar(rnc: RncCarregada, acao: AcaoRnc) {
  const r = avaliarTransicao(snapshot(rnc), acao);
  if (!r.ok) throw new ErroNegocio(r.erro);
  return r.para;
}

// ---------------------------------------------------------------- criação

export interface DadosNovaRnc {
  titulo: string;
  descricao: string;
  tipo: TipoRnc;
  origem: OrigemRnc;
  gravidade: Gravidade;
  obraId: string;
  setorId?: string | null;
  processoArea?: string | null;
  responsavelId?: string | null;
  restrita?: boolean;
  contemDadosPessoais?: boolean;
  sensiveis?: {
    nomeEnvolvido?: string | null;
    documentoEnvolvido?: string | null;
    funcaoEnvolvido?: string | null;
    relato?: string | null;
    lesaoDescricao?: string | null;
  } | null;
}

export async function criarRnc(a: Ator, d: DadosNovaRnc) {
  if (!atorTem(a, "RNC_ABRIR")) throw new ErroNegocio("Sem permissão para abrir RNC.");
  if (a.obrasPermitidas !== null && !a.obrasPermitidas.includes(d.obraId)) {
    throw new ErroNegocio("Obra/unidade não permitida.");
  }
  const obra = await a.db.obraUnidade.findFirst({ where: { id: d.obraId, ativo: true } });
  if (!obra) throw new ErroNegocio("Obra/unidade inválida.");
  if (d.responsavelId) {
    const u = await a.db.usuario.findFirst({ where: { id: d.responsavelId, ativo: true } });
    if (!u) throw new ErroNegocio("Responsável inválido.");
  }
  const ano = anoNoFuso(await fusoDaEmpresa(a));
  const contemDadosPessoais = !!d.contemDadosPessoais;
  const restrita = !!d.restrita || (d.tipo === "SSO" && contemDadosPessoais);

  return a.db.$transaction(async (tx) => {
    const sequencia = await proximaSequenciaRnc(tx, a.empresaId, ano);
    const rnc = await tx.rnc.create({
      data: {
        empresaId: a.empresaId,
        ano,
        sequencia,
        codigo: formatarCodigoRnc(sequencia, ano),
        tipo: d.tipo,
        origem: d.origem,
        gravidade: d.gravidade,
        titulo: d.titulo,
        descricao: d.descricao,
        obraId: d.obraId,
        setorId: d.setorId || null,
        processoArea: d.processoArea || null,
        abertoPorId: a.usuarioId,
        responsavelId: d.responsavelId || null,
        restrita,
        contemDadosPessoais,
      },
    });
    await tx.historicoStatusRnc.create({
      data: { empresaId: a.empresaId, rncId: rnc.id, statusAnterior: null, statusNovo: "ABERTO", usuarioId: a.usuarioId },
    });
    if (contemDadosPessoais && d.sensiveis) {
      await tx.rncDadosSensiveis.create({
        data: {
          empresaId: a.empresaId,
          rncId: rnc.id,
          nomeEnvolvido: d.sensiveis.nomeEnvolvido || null,
          documentoEnvolvido: d.sensiveis.documentoEnvolvido || null,
          funcaoEnvolvido: d.sensiveis.funcaoEnvolvido || null,
          relato: d.sensiveis.relato || null,
          lesaoDescricao: d.sensiveis.lesaoDescricao || null,
        },
      });
    }
    return rnc;
  });
}

// ---------------------------------------------------------------- tratativa

/** ABERTO/REABERTO -> EM_ANALISE: o usuário assume como responsável. */
export async function assumirAnalise(a: Ator, id: string, versao?: number) {
  if (!atorTem(a, "RNC_TRATAR")) throw new ErroNegocio("Sem permissão para tratar RNC.");
  return a.db.$transaction(async (tx) => {
    const rnc = await carregar(tx, a, id);
    exigirVersao(rnc, versao);
    if (rnc.responsavelId && rnc.responsavelId !== a.usuarioId && !atorTem(a, "PLANO_GERENCIAR")) {
      throw new ErroNegocio("Somente o responsável designado pode assumir esta RNC.");
    }
    const para = checar(rnc, "ASSUMIR");
    await transicionar(tx, a, rnc, para, { responsavelId: a.usuarioId });
  });
}

export interface DadosCausa {
  metodo: MetodoCausaRaiz;
  analise: Prisma.InputJsonValue;
  causaRaiz: string;
}

export async function salvarCausaRaiz(a: Ator, id: string, d: DadosCausa, versao?: number) {
  const rnc = await carregar(a.db, a, id);
  exigirVersao(rnc, versao);
  if (!podeGerenciarPlanoRnc(a, rnc)) {
    throw new ErroNegocio("Somente o responsável ou gestor do plano pode registrar a causa raiz.");
  }
  if (rnc.status !== "EM_ANALISE") throw new ErroNegocio("A causa raiz só pode ser registrada em análise.");
  if (!d.causaRaiz.trim()) throw new ErroNegocio("Informe a causa raiz.");
  const r = await a.db.rnc.updateMany({
    where: { id, versao: rnc.versao, status: "EM_ANALISE" },
    data: { metodoCausaRaiz: d.metodo, analiseCausa: d.analise, causaRaiz: d.causaRaiz.trim(), versao: { increment: 1 } },
  });
  if (r.count === 0) throw new ErroConflito();
}

export async function iniciarExecucao(a: Ator, id: string, versao?: number) {
  return a.db.$transaction(async (tx) => {
    const rnc = await carregar(tx, a, id);
    exigirVersao(rnc, versao);
    if (!podeGerenciarPlanoRnc(a, rnc)) throw new ErroNegocio("Sem permissão para executar o plano.");
    await transicionar(tx, a, rnc, checar(rnc, "INICIAR_EXECUCAO"));
  });
}

export async function enviarParaVerificacao(a: Ator, id: string, versao?: number) {
  return a.db.$transaction(async (tx) => {
    const rnc = await carregar(tx, a, id);
    exigirVersao(rnc, versao);
    if (!podeGerenciarPlanoRnc(a, rnc)) throw new ErroNegocio("Sem permissão para enviar à verificação.");
    await transicionar(tx, a, rnc, checar(rnc, "ENVIAR_VERIFICACAO"));
  });
}

// ---------------------------------------------------------------- verificação

/** Verdadeiro se o usuário executou itens do ciclo atual (conflito de interesse: só aviso). */
export function verificadorExecutouItens(
  usuarioId: string,
  itens: readonly { quemId: string; ciclo: number }[],
  ciclo: number,
) {
  return itensDoCiclo(itens, ciclo).some((i) => i.quemId === usuarioId);
}

export async function verificarEficacia(
  a: Ator,
  id: string,
  d: { eficaz: boolean; comentario: string },
  versao?: number,
): Promise<{ aviso: string | null }> {
  if (!atorTem(a, "RNC_VERIFICAR_EFICACIA")) throw new ErroNegocio("Sem permissão para verificar eficácia.");
  const comentario = d.comentario.trim();
  if (!comentario) throw new ErroNegocio("Comentário da verificação é obrigatório.");
  return a.db.$transaction(async (tx) => {
    const rnc = await carregar(tx, a, id);
    exigirVersao(rnc, versao);
    const ciclo = cicloAtual(rnc.verificacoes);
    const aviso = verificadorExecutouItens(a.usuarioId, rnc.planoAcao?.itens ?? [], ciclo)
      ? "Atenção: você executou itens deste plano e também verificou a eficácia."
      : null;
    const para = checar(rnc, d.eficaz ? "VERIFICAR_EFICAZ" : "VERIFICAR_INEFICAZ");
    const tentativa = rnc.verificacoes.length + 1;
    const resultado = d.eficaz ? "EFICAZ" : "INEFICAZ";
    await tx.verificacaoEficacia.create({
      data: { empresaId: a.empresaId, rncId: id, tentativa, resultado, comentario, verificadorId: a.usuarioId },
    });
    const agora = new Date();
    await transicionar(
      tx,
      a,
      rnc,
      para,
      d.eficaz
        ? { eficaz: true, dataVerificacaoEficacia: agora, encerradoEm: agora }
        : { eficaz: false, dataVerificacaoEficacia: agora },
      comentario,
      { tentativa, resultado, verificadorExecutouItens: !!aviso },
    );
    return { aviso };
  });
}

// ---------------------------------------------------------------- cancelamento

export async function solicitarCancelamento(a: Ator, id: string, motivo: string) {
  if (!atorTem(a, "RNC_SOLICITAR_CANCELAMENTO")) throw new ErroNegocio("Sem permissão para solicitar cancelamento.");
  const m = motivo.trim();
  if (!m) throw new ErroNegocio("Motivo obrigatório.");
  try {
    return await a.db.$transaction(async (tx) => {
      const rnc = await carregar(tx, a, id);
      if (STATUS_FINAIS.includes(rnc.status)) throw new ErroNegocio("RNC já finalizada.");
      const s = await tx.solicitacaoCancelamento.create({
        data: { empresaId: a.empresaId, rncId: id, solicitanteId: a.usuarioId, motivo: m, statusRncNaSolicitacao: rnc.status },
      });
      await tx.historicoStatusRnc.create({
        data: {
          empresaId: a.empresaId,
          rncId: id,
          statusAnterior: rnc.status,
          statusNovo: rnc.status,
          usuarioId: a.usuarioId,
          motivo: m,
          metadados: { evento: "CANCELAMENTO_SOLICITADO", solicitacaoId: s.id },
        },
      });
      return s;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ErroNegocio("Já existe uma solicitação de cancelamento pendente.");
    }
    throw e;
  }
}

export async function decidirCancelamento(a: Ator, solicitacaoId: string, aprovar: boolean, comentario?: string | null) {
  if (!atorTem(a, "RNC_APROVAR_CANCELAMENTO")) throw new ErroNegocio("Sem permissão para decidir cancelamentos.");
  const c = comentario?.trim() || null;
  return a.db.$transaction(async (tx) => {
    const sol = await tx.solicitacaoCancelamento.findFirst({ where: { id: solicitacaoId } });
    if (!sol) throw new ErroNegocio("Solicitação não encontrada.");
    const rnc = await carregar(tx, a, sol.rncId);
    const r = await tx.solicitacaoCancelamento.updateMany({
      where: { id: solicitacaoId, status: "PENDENTE" },
      data: { status: aprovar ? "APROVADA" : "REJEITADA", aprovadorId: a.usuarioId, decididoEm: new Date(), comentarioDecisao: c },
    });
    if (r.count === 0) throw new ErroNegocio("Solicitação já decidida.");
    if (aprovar) {
      await transicionar(tx, a, rnc, checar(rnc, "CANCELAR"), { canceladoEm: new Date() }, sol.motivo, {
        evento: "CANCELAMENTO_APROVADO",
        solicitacaoId,
        comentario: c,
      });
    } else {
      await tx.historicoStatusRnc.create({
        data: {
          empresaId: a.empresaId,
          rncId: rnc.id,
          statusAnterior: rnc.status,
          statusNovo: rnc.status,
          usuarioId: a.usuarioId,
          motivo: c,
          metadados: { evento: "CANCELAMENTO_REJEITADO", solicitacaoId },
        },
      });
    }
  });
}
