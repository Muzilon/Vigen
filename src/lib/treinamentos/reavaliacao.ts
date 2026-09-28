/**
 * Alertas escalados do módulo TREINAMENTOS (cron diário, via src/lib/reavaliacao). Sobre a última realização (presente)
 * de cada pessoa em cada treinamento ativo — reciclagem feita encerra os alertas:
 *   - 60 dias antes: TREINAMENTO_VENCENDO ao colaborador;
 *   - 30 dias antes: aos gestores (quem cadastrou + quem tem TREINAMENTO_GERENCIAR);
 *   - vencido: ao colaborador e aos gestores ("inapto" se o treinamento é crítico).
 * Cada degrau tem chave idempotente própria (sufixo no entidadeId). Registrada por efeito colateral: src/lib/notificacoes/cron.ts importa este arquivo.
 */
import type { DbTenant } from "@/lib/db-tenant";
import { dataIso, paraDataDb, somarDias } from "@/lib/datas";
import { permissoesEfetivas } from "@/lib/permissoes";
import { registrarFonteReavaliacao, type ItemReavaliacao } from "@/lib/reavaliacao/fontes";
import { linkTreinamento } from "./acesso";
import { ultimasRealizacoes } from "./regras";

export const DIAS_ALERTA_COLABORADOR = 60;
export const DIAS_ALERTA_GESTAO = 30;

interface Vencendo {
  participacaoId: string;
  usuarioId: string;
  treinamentoId: string;
  dataValidade: string;
  titulo: string;
  critico: boolean;
  criadoPorId: string;
}

async function vencendo(db: DbTenant, limite: string): Promise<Vencendo[]> {
  const ps = await db.participacaoTreinamento.findMany({
    where: { presente: true, usuario: { ativo: true }, sessao: { treinamento: { ativo: true } } },
    select: {
      id: true,
      usuarioId: true,
      dataValidade: true,
      usuario: { select: { nome: true } },
      sessao: { select: { dataRealizacao: true, treinamentoId: true, treinamento: { select: { nome: true, criadoPorId: true, critico: true } } } },
    },
  });
  const porChave = new Map(ps.map((p) => [`${p.usuarioId}:${p.sessao.treinamentoId}:${dataIso(p.sessao.dataRealizacao)}`, p]));
  const ultimas = ultimasRealizacoes(
    ps.map((p) => ({ usuarioId: p.usuarioId, treinamentoId: p.sessao.treinamentoId, presente: true, dataRealizacao: dataIso(p.sessao.dataRealizacao), dataValidade: p.dataValidade ? dataIso(p.dataValidade) : null })),
  );
  const out: Vencendo[] = [];
  for (const u of ultimas.values()) {
    if (!u.dataValidade || paraDataDb(u.dataValidade) > paraDataDb(limite)) continue;
    const p = porChave.get(`${u.usuarioId}:${u.treinamentoId}:${u.dataRealizacao}`)!;
    out.push({
      participacaoId: p.id,
      usuarioId: u.usuarioId,
      treinamentoId: u.treinamentoId,
      dataValidade: u.dataValidade,
      titulo: `${p.sessao.treinamento.nome} — ${p.usuario.nome}`,
      critico: p.sessao.treinamento.critico,
      criadoPorId: p.sessao.treinamento.criadoPorId,
    });
  }
  return out;
}

async function gestores(db: DbTenant): Promise<string[]> {
  const us = await db.usuario.findMany({ where: { ativo: true }, select: { id: true, papel: true, perfil: { select: { permissoes: true } } } });
  return us.filter((u) => permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []).includes("TREINAMENTO_GERENCIAR")).map((u) => u.id);
}

const item = (v: Vencendo, sufixo: string, usuarioIds: string[]): ItemReavaliacao => ({
  entidadeId: `${v.participacaoId}${sufixo}`,
  modo: "ITEM",
  dataReavaliacao: v.dataValidade,
  titulo: v.titulo,
  link: linkTreinamento(v.treinamentoId),
  usuarioIds,
});

registrarFonteReavaliacao({
  modulo: "TREINAMENTOS",
  tipoNotificacao: "TREINAMENTO_VENCENDO",
  diasAntecedencia: DIAS_ALERTA_COLABORADOR,
  mensagem: (i, vencida, data) => ({
    titulo: `${vencida ? "Seu treinamento venceu" : "Seu treinamento vai vencer"}: ${i.titulo}`,
    corpo: `A validade ${vencida ? "venceu em" : "vence em"} ${data}. Procure a área de treinamentos para programar a reciclagem.`,
  }),
  async listarVencendo(db, _empresa, hoje, dias) {
    return (await vencendo(db, somarDias(hoje, dias))).filter((v) => v.dataValidade >= hoje).map((v) => item(v, "", [v.usuarioId]));
  },
});

registrarFonteReavaliacao(
  {
    modulo: "TREINAMENTOS",
    tipoNotificacao: "TREINAMENTO_VENCENDO",
    diasAntecedencia: DIAS_ALERTA_GESTAO,
    mensagem: (i, _vencida, data) => ({
      titulo: `Treinamento a vencer na equipe: ${i.titulo}`,
      corpo: `A validade vence em ${data}. Programe a reciclagem antes do vencimento.`,
    }),
    async listarVencendo(db, _empresa, hoje, dias) {
      const vs = (await vencendo(db, somarDias(hoje, dias))).filter((v) => v.dataValidade >= hoje);
      const gs = vs.length ? await gestores(db) : [];
      return vs.map((v) => item(v, ":gestao", [v.criadoPorId, ...gs]));
    },
  },
  "TREINAMENTOS:gestao",
);

registrarFonteReavaliacao(
  {
    modulo: "TREINAMENTOS",
    tipoNotificacao: "TREINAMENTO_VENCENDO",
    diasAntecedencia: 0,
    mensagem: (i, _vencida, data) => ({
      titulo: `Treinamento vencido: ${i.titulo}`,
      corpo: `A validade venceu em ${data}. Até a reciclagem, a pessoa não está em dia${i.entidadeId.endsWith(":critico") ? " e fica INAPTA (treinamento crítico)" : ""}.`,
    }),
    async listarVencendo(db, _empresa, hoje) {
      const vs = (await vencendo(db, somarDias(hoje, -1))).filter((v) => v.dataValidade < hoje);
      const gs = vs.length ? await gestores(db) : [];
      return vs.map((v) => item(v, v.critico ? ":vencido:critico" : ":vencido", [v.usuarioId, v.criadoPorId, ...gs]));
    },
  },
  "TREINAMENTOS:vencido",
);
