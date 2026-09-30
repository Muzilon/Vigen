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
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Mapa de Processos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "MAPA_PROCESSOS");
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Qual aba está aberta: "mapa" (diagrama) ou, por padrão, "planilha".
  const aba = sp.aba === "mapa" ? "mapa" : "planilha";
  // Se o usuário pediu para mostrar também os processos inativos (?inativos=1).
  const inativos = sp.inativos === "1";
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca em paralelo: os processos, as interações entre eles (setas do mapa) e os usuários ativos (donos).
  const [processos, interacoes, usuarios] = await Promise.all([
    listarProcessos(a, { incluirInativos: inativos }),
    listarInteracoes(a),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  // Se o usuário pode editar a planilha (senão ela é só de leitura).
  const podeGerenciar = podeGerenciarProcessos(a);
  // Somente os processos ativos (usados no contador e no mapa).
  const ativos = processos.filter((p) => p.ativo);

  // Converte cada processo do banco no formato simples que a planilha espera (texto vazio no lugar de nulo).
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

  // Monta o endereço da própria página mantendo a aba e o filtro atuais e trocando só o que for passado em `extra`.
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
