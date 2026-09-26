import type { Prisma, TipoRnc } from "@prisma/client";
import { fusoDaEmpresa, type Ator } from "@/lib/ator";
import { hojeNoFuso } from "@/lib/datas";
import { filtroAcessoRnc } from "@/lib/rnc/servico";
import { ROTULO_GRAVIDADE, ROTULO_STATUS_ITEM, ROTULO_TIPO } from "@/lib/rnc/rotulos";
import { calcularIndicadores, limitesUtc, periodoPadrao, type Indicadores, type Periodo } from "./calculos";

export interface FiltrosDashboard {
  inicio?: string;
  fim?: string;
  obraId?: string;
  tipo?: TipoRnc;
  setorId?: string;
}

/** Carrega os indicadores respeitando isolamento (db do tenant) e visibilidade (filtroAcessoRnc). */
export async function carregarIndicadores(a: Ator, f: FiltrosDashboard): Promise<{ indicadores: Indicadores; periodo: Periodo; fuso: string }> {
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  const padrao = periodoPadrao(hoje);
  let periodo: Periodo = { inicio: f.inicio || padrao.inicio, fim: f.fim || padrao.fim };
  if (periodo.inicio > periodo.fim) periodo = { inicio: periodo.fim, fim: periodo.inicio };
  const { desde, ate } = limitesUtc(periodo);

  const filtroRnc: Prisma.RncWhereInput = {
    AND: [
      filtroAcessoRnc(a),
      f.obraId ? { obraId: f.obraId } : {},
      f.tipo ? { tipo: f.tipo } : {},
      f.setorId ? { setorId: f.setorId } : {},
    ],
  };
  const janela = { gte: desde, lt: ate };

  const [rncs, itens] = await Promise.all([
    a.db.rnc.findMany({
      where: {
        AND: [
          filtroRnc,
          {
            OR: [
              { status: { notIn: ["ENCERRADO", "CANCELADO"] } },
              { dataAbertura: janela },
              { encerradoEm: janela },
              { canceladoEm: janela },
              { verificacoes: { some: { tentativa: 1, verificadoEm: janela } } },
            ],
          },
        ],
      },
      select: {
        id: true, tipo: true, gravidade: true, status: true, obraId: true, dataAbertura: true,
        encerradoEm: true, canceladoEm: true,
        obra: { select: { nome: true } },
        verificacoes: { where: { tentativa: 1 }, select: { resultado: true, verificadoEm: true } },
      },
    }),
    a.db.itemAcao.findMany({
      where: { planoAcao: { rnc: { is: filtroRnc } } },
      select: { status: true, quando: true, quemId: true, quem: { select: { nome: true } } },
    }),
  ]);

  const indicadores = calcularIndicadores({
    rncs: rncs.map((r) => ({
      id: r.id, tipo: r.tipo, gravidade: r.gravidade, status: r.status, obraId: r.obraId, obraNome: r.obra.nome,
      dataAbertura: r.dataAbertura, encerradoEm: r.encerradoEm, canceladoEm: r.canceladoEm,
      primeiraVerificacao: r.verificacoes[0]
        ? { eficaz: r.verificacoes[0].resultado === "EFICAZ", verificadoEm: r.verificacoes[0].verificadoEm }
        : null,
    })),
    itens: itens.map((i) => ({ status: i.status, quando: i.quando, quemId: i.quemId, quemNome: i.quem.nome })),
    periodo, fuso, hoje,
    rotulos: { tipo: ROTULO_TIPO, gravidade: ROTULO_GRAVIDADE, statusItem: ROTULO_STATUS_ITEM },
  });
  return { indicadores, periodo, fuso };
}
