import Link from "next/link";
import { z } from "zod";
import { Cabecalho, Cartao, cls } from "@/components/ui";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import { carregarIndicadores } from "@/lib/indicadores/servico";
import { ROTULO_TIPO } from "@/lib/rnc/rotulos";
import { Barras, GraficoMensal } from "./graficos";

const dataUrl = z
  .preprocess((v) => (Array.isArray(v) ? v[0] : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional())
  .catch(undefined)
  .transform((v) => v ?? "");

const esquema = z.object({
  inicio: dataUrl,
  fim: dataUrl,
  obra: uuidUrl,
  tipo: enumUrl(["QUALIDADE", "MEIO_AMBIENTE", "SSO"]),
  setor: uuidUrl,
});

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const f = esquema.parse(await searchParams);
  const a = await getAtor();
  const [{ indicadores: ind, periodo }, obras, setores] = await Promise.all([
    carregarIndicadores(a, {
      inicio: f.inicio, fim: f.fim, obraId: f.obra || undefined, tipo: f.tipo || undefined, setorId: f.setor || undefined,
    }),
    a.db.obraUnidade.findMany({
      where: { ativo: true, ...(a.obrasPermitidas === null ? {} : { id: { in: [...a.obrasPermitidas] } }) },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    a.db.setor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  const k = ind.kpis;

  return (
    <div className="space-y-6">
      <Cabecalho titulo="Dashboard" subtitulo={`Indicadores de ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`} />

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4" method="get">
        <div>
          <label className={cls.label} htmlFor="inicio">De</label>
          <input id="inicio" name="inicio" type="date" defaultValue={periodo.inicio} className={cls.input} />
        </div>
        <div>
          <label className={cls.label} htmlFor="fim">Até</label>
          <input id="fim" name="fim" type="date" defaultValue={periodo.fim} className={cls.input} />
        </div>
        <div>
          <label className={cls.label} htmlFor="obra">Obra</label>
          <select id="obra" name="obra" defaultValue={f.obra} className={cls.input}>
            <option value="">Todas</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={cls.label} htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={f.tipo} className={cls.input}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={cls.label} htmlFor="setor">Setor</label>
          <select id="setor" name="setor" defaultValue={f.setor} className={cls.input}>
            <option value="">Todos</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <button type="submit" className={cls.btn}>Aplicar</button>
        <Link href="/dashboard" className={cls.btnSec}>Limpar</Link>
      </form>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="RNCs em aberto" valor={k.abertas} dica="Situação atual" />
        <Kpi titulo="Encerradas" valor={k.encerradasPeriodo} dica="No período" />
        <Kpi titulo="Canceladas" valor={k.canceladasPeriodo} dica="No período" />
        <Kpi titulo="Itens atrasados" valor={k.itensAtrasados} dica="Situação atual" alerta={k.itensAtrasados > 0} />
        <Kpi
          titulo="Tempo médio de fechamento"
          valor={k.tempoMedioFechamentoDias === null ? "—" : `${k.tempoMedioFechamentoDias.toLocaleString("pt-BR")} d`}
          dica="Encerradas no período"
        />
        <Kpi
          titulo="Eficácia na 1ª verificação"
          valor={k.eficaciaPrimeiraVerificacaoPct === null ? "—" : `${k.eficaciaPrimeiraVerificacaoPct.toLocaleString("pt-BR")}%`}
          dica="Verificações no período"
        />
      </div>

      <Cartao titulo="RNCs abertas x encerradas por mês">
        <GraficoMensal dados={ind.porMes} />
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Por tipo (abertas no período)"><Barras dados={ind.porTipo} /></Cartao>
        <Cartao titulo="Por gravidade (abertas no período)"><Barras dados={ind.porGravidade} paleta="gravidade" /></Cartao>
        <Cartao titulo="Por obra (abertas no período)"><Barras dados={ind.porObra.slice(0, 10)} /></Cartao>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Itens de ação por status">
          <Barras dados={ind.itensPorStatus} paleta="status" vazio="Nenhum item de ação." />
        </Cartao>
        <Cartao titulo="Responsáveis com mais itens atrasados">
          <Barras dados={ind.topAtrasados} paleta="alerta" vazio="Nenhum item atrasado. Bom trabalho!" />
        </Cartao>
      </div>
    </div>
  );
}

function Kpi({ titulo, valor, dica, alerta }: { titulo: string; valor: number | string; dica: string; alerta?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold ${alerta ? "text-orange-700" : "text-slate-900"}`}>{valor}</p>
      <p className="text-xs text-slate-500">{dica}</p>
    </div>
  );
}
