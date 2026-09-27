/**
 * Fonte de alerta do módulo TREINAMENTOS (cron diário, via src/lib/reavaliacao): treinamento a vencer em até 30 dias
 * (ou vencido) → TREINAMENTO_VENCENDO para o participante e para quem cadastrou o treinamento. Considera só a última
 * realização (presente) de cada pessoa em cada treinamento ativo — reciclagem feita encerra o alerta.
 * Registrada por efeito colateral: src/lib/notificacoes/cron.ts importa este arquivo.
 */
import { dataIso, paraDataDb, somarDias } from "@/lib/datas";
import { registrarFonteReavaliacao, type ItemReavaliacao } from "@/lib/reavaliacao/fontes";
import { linkTreinamento } from "./acesso";
import { DIAS_A_VENCER, ultimasRealizacoes } from "./regras";

registrarFonteReavaliacao({
  modulo: "TREINAMENTOS",
  tipoNotificacao: "TREINAMENTO_VENCENDO",
  diasAntecedencia: DIAS_A_VENCER,
  mensagem: (i, vencida, data) => ({
    titulo: `${vencida ? "Treinamento vencido" : "Treinamento a vencer"}: ${i.titulo}`,
    corpo: `A validade do treinamento ${vencida ? "venceu em" : "vence em"} ${data}. Programe a reciclagem.`,
  }),
  async listarVencendo(db, _empresa, hoje, dias) {
    const ps = await db.participacaoTreinamento.findMany({
      where: { presente: true, usuario: { ativo: true }, sessao: { treinamento: { ativo: true } } },
      select: {
        id: true,
        usuarioId: true,
        dataValidade: true,
        usuario: { select: { nome: true } },
        sessao: { select: { dataRealizacao: true, treinamentoId: true, treinamento: { select: { nome: true, criadoPorId: true } } } },
      },
    });
    const ultimas = ultimasRealizacoes(
      ps.map((p) => ({ usuarioId: p.usuarioId, treinamentoId: p.sessao.treinamentoId, presente: true, dataRealizacao: dataIso(p.sessao.dataRealizacao), dataValidade: p.dataValidade ? dataIso(p.dataValidade) : null, id: p.id })),
    );
    const limite = paraDataDb(somarDias(hoje, dias));
    const out: ItemReavaliacao[] = [];
    for (const u of ultimas.values()) {
      if (!u.dataValidade || paraDataDb(u.dataValidade) > limite) continue;
      const p = ps.find((x) => x.usuarioId === u.usuarioId && x.sessao.treinamentoId === u.treinamentoId && dataIso(x.sessao.dataRealizacao) === u.dataRealizacao)!;
      out.push({
        entidadeId: p.id,
        modo: "ITEM",
        dataReavaliacao: u.dataValidade,
        titulo: `${p.sessao.treinamento.nome} — ${p.usuario.nome}`,
        link: linkTreinamento(u.treinamentoId),
        usuarioIds: [u.usuarioId, p.sessao.treinamento.criadoPorId],
      });
    }
    return out;
  },
});
