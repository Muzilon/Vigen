import Link from "next/link";
import { getAtor } from "@/lib/ator-servidor";
import { exigirModulo } from "@/lib/modulos";
import { listarInteracoes, listarProcessos, podeGerenciarProcessos } from "@/lib/processos/servico";
import { getContexto } from "@/lib/tenant";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { MapaProcessos } from "@/paginas/html/processos-mapa";
import { PlanilhaProcessos, type LinhaProcesso } from "@/paginas/html/processos-planilha";
import styles from "@/paginas/css/processos-lista.module.css";

/**
 * Mapa de Processos (ISO 9001 4.4) — decisão 6 do dono: planilha montada automaticamente e
 * editável (aba "Planilha") + diagrama em 3 raias gerado da ordem (aba "Mapa").
 */
export default async function ProcessosLista({ searchParams }: PageProps<"/processos">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "MAPA_PROCESSOS");
  const sp = await searchParams;
  const aba = sp.aba === "mapa" ? "mapa" : "planilha";
  const inativos = sp.inativos === "1";
  const a = await getAtor();
  const [processos, interacoes, usuarios] = await Promise.all([
    listarProcessos(a, { incluirInativos: inativos }),
    listarInteracoes(a),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  const podeGerenciar = podeGerenciarProcessos(a);
  const ativos = processos.filter((p) => p.ativo);

  const linhas: LinhaProcesso[] = processos.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    tipo: p.tipo,
    ativo: p.ativo,
    revisao: p.revisao,
    versao: p.versao,
    donoId: p.donoId,
    donoNome: p.dono?.nome ?? null,
    entradas: p.entradas ?? "",
    saidas: p.saidas ?? "",
    fornecedores: p.fornecedores ?? "",
    clientes: p.clientes ?? "",
    indicadores: p.indicadores.map((i) => i.nome),
  }));

  const href = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ ...(aba === "mapa" ? { aba } : {}), ...(inativos ? { inativos: "1" } : {}), ...extra });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    const s = q.toString();
    return `/processos${s ? `?${s}` : ""}`;
  };

  return (
    <div className={styles.pagina}>
      <CabecalhoPagina
        titulo="Mapa de processos"
        contador={ativos.length}
        subtitulo="Processos de gestão, finalísticos e de apoio da organização (ISO 9001 4.4) — edite direto na planilha."
      />

      <nav className={styles.abas} aria-label="Visualização">
        <Link href={href({ aba: "" })} className={aba === "planilha" ? styles.abaAtiva : styles.aba} aria-current={aba === "planilha" ? "page" : undefined}>
          Planilha
        </Link>
        <Link href={href({ aba: "mapa" })} className={aba === "mapa" ? styles.abaAtiva : styles.aba} aria-current={aba === "mapa" ? "page" : undefined}>
          Mapa
        </Link>
        {aba === "planilha" && (
          <Link href={href({ inativos: inativos ? "" : "1" })} className={styles.linkInativos}>
            {inativos ? "Ocultar inativos" : "Mostrar inativos"}
          </Link>
        )}
      </nav>

      {aba === "planilha" ? (
        <PlanilhaProcessos linhas={linhas} usuarios={usuarios} podeGerenciar={podeGerenciar} />
      ) : (
        <MapaProcessos processos={ativos} interacoes={interacoes} />
      )}
    </div>
  );
}
