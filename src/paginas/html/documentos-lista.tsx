import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { dataIso, formatarData, hojeNoFuso } from "@/lib/datas";
import { podeElaborarDocumentos, veListaMestra } from "@/lib/documentos/acesso";
import { formatarRevisao, revisaoVencida, ROTULO_STATUS_DOCUMENTO, STATUS_DOCUMENTO } from "@/lib/documentos/regras";
import { listarMestra, opcoesDocumentos } from "@/lib/documentos/servico";
import { enumUrl, textoUrl, uuidUrl } from "@/lib/filtros-url";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { BadgeAtrasado, BadgeStatusDocumento } from "@/paginas/html/componentes/badge";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { CampoBusca, Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/documentos-lista.module.css";

// Regra de validação dos filtros da URL (busca, tipo, status, processo, responsável, vencidas, incluir obsoletos).
const esquema = z.object({
  busca: textoUrl,
  tipo: uuidUrl,
  status: enumUrl(["ELABORACAO", "EM_REVISAO", "EM_APROVACAO", "APROVADO", "PUBLICADO", "OBSOLETO", "CANCELADO"]),
  processo: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.union([z.literal("sem"), z.uuid()]).optional()).catch(undefined),
  responsavel: uuidUrl,
  vencidas: enumUrl(["1"]),
  todos: enumUrl(["1"]),
});

/**
 * Página "Lista mestra de documentos" (ISO 9001 7.5): código, título, tipo, revisão vigente, status, processo,
 * responsável e próxima revisão, com busca e filtros. Quem não tem acesso à lista mestra é levado a "Meus documentos".
 */
/** Lista mestra de documentos (ISO 9001 7.5): código, título, tipo, revisão vigente, status, processo, responsável e próxima revisão. */
export default async function DocumentosLista({ searchParams }: PageProps<"/documentos">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Documentos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "DOCUMENTOS");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Quem só lê documentos publicados para si vai direto para "Meus documentos".
  if (!veListaMestra(a)) redirect("/documentos/meus");
  // Lê e valida os filtros da URL (valores inválidos viram "sem filtro").
  const f = esquema.parse(await searchParams);
  // Busca em paralelo a lista (já filtrada), as opções dos filtros e o fuso horário da empresa.
  const [docs, op, fuso] = await Promise.all([
    listarMestra(a, {
      busca: f.busca || undefined,
      tipo: f.tipo || undefined,
      status: f.status || undefined,
      processo: f.processo,
      responsavel: f.responsavel || undefined,
      vencidas: f.vencidas === "1",
      todos: f.todos === "1",
    }),
    opcoesDocumentos(a),
    fusoDaEmpresa(a),
  ]);
  // Data de hoje no fuso da empresa.
  const hoje = hojeNoFuso(fuso);
  // Quantos documentos vigentes estão com a revisão periódica vencida (vai para o resumo do topo).
  const vencidas = docs.filter((d) => revisaoVencida(d.proximaRevisaoEm ? dataIso(d.proximaRevisaoEm) : null, hoje) && d.versaoVigente).length;
  // Quantos estão no meio do caminho (em revisão, em aprovação ou aprovados aguardando publicação).
  const emTramitacao = docs.filter((d) => d.status === "EM_REVISAO" || d.status === "EM_APROVACAO" || d.status === "APROVADO").length;

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo="Lista mestra de documentos"
        contador={docs.length}
        subtitulo="Documentos controlados (ISO 9001 7.5): elaboração, revisão, aprovação, publicação e obsolescência."
        acoes={
          <>
            <LinkBotao href="/documentos/meus" variante="secundario">Meus documentos</LinkBotao>
            {podeElaborarDocumentos(a) && <LinkBotao href="/documentos/novo">Novo documento</LinkBotao>}
          </>
        }
      />

      <div className={styles.resumo}>
        <Link href="/documentos?vencidas=1" className={`${styles.indicador} ${vencidas ? styles.indicadorAlerta : ""}`}>
          <strong>{vencidas}</strong> revisão(ões) periódica(s) vencida(s)
        </Link>
        <span className={styles.indicador}><strong>{emTramitacao}</strong> em revisão/aprovação ou a publicar</span>
      </div>

      <form className={styles.barraFiltros} method="get">
        <div className={`${styles.campoFiltro} ${styles.campoBusca}`}>
          <Rotulo htmlFor="busca">Buscar</Rotulo>
          <CampoBusca id="busca" name="busca" placeholder="Código ou título" defaultValue={f.busca} />
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="tipo">Tipo</Rotulo>
          <Selecao id="tipo" name="tipo" defaultValue={f.tipo}>
            <option value="">Todos</option>
            {op.tipos.map((t) => <option key={t.id} value={t.id}>{t.sigla} — {t.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="status">Status</Rotulo>
          <Selecao id="status" name="status" defaultValue={f.status}>
            <option value="">Em uso (sem obsoletos/cancelados)</option>
            {STATUS_DOCUMENTO.map((s) => <option key={s} value={s}>{ROTULO_STATUS_DOCUMENTO[s]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="processo">Processo</Rotulo>
          <Selecao id="processo" name="processo" defaultValue={f.processo ?? ""}>
            <option value="">Todos</option>
            <option value="sem">— sem processo —</option>
            {op.processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="responsavel">Responsável</Rotulo>
          <Selecao id="responsavel" name="responsavel" defaultValue={f.responsavel}>
            <option value="">Todos</option>
            {op.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Selecao>
        </div>
        <label className={styles.marcador}>
          <input type="checkbox" name="vencidas" value="1" defaultChecked={f.vencidas === "1"} /> Revisão vencida
        </label>
        <label className={styles.marcador}>
          <input type="checkbox" name="todos" value="1" defaultChecked={f.todos === "1"} /> Incluir obsoletos/cancelados
        </label>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href="/documentos" className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>

      {docs.length === 0 ? (
        <EstadoVazio>Nenhum documento com estes filtros.</EstadoVazio>
      ) : (
        <div className={styles.quadro}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Título</th>
                <th scope="col">Tipo</th>
                <th scope="col" title="Revisão vigente (publicada)">Rev. vigente</th>
                <th scope="col">Status</th>
                <th scope="col">Processo</th>
                <th scope="col">Responsável</th>
                <th scope="col">Próxima revisão</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                // Este documento tem revisão vencida? (a data ganha o aviso "vencida")
                const vencida = !!d.versaoVigente && revisaoVencida(d.proximaRevisaoEm ? dataIso(d.proximaRevisaoEm) : null, hoje);
                return (
                  <tr key={d.id} className={d.status === "OBSOLETO" || d.status === "CANCELADO" ? styles.linhaInativa : undefined}>
                    <td className={styles.codigo}><Link href={`/documentos/${d.id}`}>{d.codigo}</Link></td>
                    <td className={styles.titulo}><Link href={`/documentos/${d.id}`} className={styles.linkTitulo}>{d.titulo}</Link></td>
                    <td title={d.tipo.nome}>{d.tipo.sigla}</td>
                    <td className={styles.numero}>{d.versaoVigente ? formatarRevisao(d.versaoVigente.numero) : "—"}</td>
                    <td><BadgeStatusDocumento status={d.status} rotulo={ROTULO_STATUS_DOCUMENTO[d.status]} /></td>
                    <td title={d.processo?.nome}>{d.processo?.codigo ?? "—"}</td>
                    <td>{d.responsavel.nome}</td>
                    <td>
                      {d.versaoVigente && d.proximaRevisaoEm ? (
                        vencida ? <BadgeAtrasado>{formatarData(d.proximaRevisaoEm)} · vencida</BadgeAtrasado> : formatarData(d.proximaRevisaoEm)
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
