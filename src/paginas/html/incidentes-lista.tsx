import Link from "next/link";
import { z } from "zod";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora } from "@/lib/datas";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import {
  GRAVIDADES_INCIDENTE,
  ROTULO_GRAVIDADE_INCIDENTE,
  ROTULO_STATUS_INCIDENTE,
  ROTULO_TIPO_INCIDENTE,
  STATUS_INCIDENTE,
  TIPOS_INCIDENTE,
} from "@/lib/incidentes/regras";
import { listarIncidentes, opcoesIncidentes } from "@/lib/incidentes/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { BadgeGravidadeIncidente, BadgeStatusIncidente } from "@/paginas/html/componentes/badge";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/incidentes-lista.module.css";

// Regra de validação dos filtros da URL (unidade, tipo, gravidade, status).
const esquema = z.object({
  obra: uuidUrl,
  tipo: enumUrl(["ACIDENTE_TIPICO", "ACIDENTE_TRAJETO", "QUASE_ACIDENTE", "DOENCA_OCUPACIONAL"]),
  gravidade: enumUrl(["SEM_AFASTAMENTO", "COM_AFASTAMENTO", "FATALIDADE"]),
  status: enumUrl(["ABERTO", "EM_INVESTIGACAO", "CONCLUIDO"]),
});

/**
 * Página "Incidentes e acidentes": tabela com data/hora, tipo, gravidade, unidade/local, responsável, status, dias perdidos,
 * CAT e plano. Registros restritos por conterem dados pessoais (LGPD) ganham um cadeado.
 */
/** Lista de incidentes/acidentes: filtros obra/tipo/gravidade/status; cadeado nos restritos (LGPD). */
export default async function IncidentesLista({ searchParams }: PageProps<"/incidentes">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Incidentes, a página responde "404 - não encontrada".
  exigirModulo(ctx, "INCIDENTES");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Lê e valida os filtros da URL.
  const f = esquema.parse(await searchParams);
  // Busca em paralelo os incidentes (já filtrados, e só os que o usuário pode ver), as opções dos filtros e o fuso horário.
  const [lista, op, fuso] = await Promise.all([
    listarIncidentes(a, { obra: f.obra || undefined, tipo: f.tipo || undefined, gravidade: f.gravidade || undefined, status: f.status || undefined }),
    opcoesIncidentes(a),
    fusoDaEmpresa(a),
  ]);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo="Incidentes e acidentes"
        contador={lista.length}
        subtitulo="Acidentes, quase-acidentes e doenças ocupacionais: registro, investigação de causa e plano de ação."
        acoes={<LinkBotao href="/incidentes/novo">Registrar incidente</LinkBotao>}
      />
      <form className={styles.barraFiltros} method="get">
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="obra">Unidade</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={f.obra}>
            <option value="">Todas</option>
            {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="tipo">Tipo</Rotulo>
          <Selecao id="tipo" name="tipo" defaultValue={f.tipo}>
            <option value="">Todos</option>
            {TIPOS_INCIDENTE.map((t) => <option key={t} value={t}>{ROTULO_TIPO_INCIDENTE[t]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="gravidade">Gravidade</Rotulo>
          <Selecao id="gravidade" name="gravidade" defaultValue={f.gravidade}>
            <option value="">Todas</option>
            {GRAVIDADES_INCIDENTE.map((g) => <option key={g} value={g}>{ROTULO_GRAVIDADE_INCIDENTE[g]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="status">Status</Rotulo>
          <Selecao id="status" name="status" defaultValue={f.status}>
            <option value="">Todos</option>
            {STATUS_INCIDENTE.map((s) => <option key={s} value={s}>{ROTULO_STATUS_INCIDENTE[s]}</option>)}
          </Selecao>
        </div>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href="/incidentes" className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>

      {lista.length === 0 ? (
        <EstadoVazio>Nenhum incidente com estes filtros.</EstadoVazio>
      ) : (
        <div className={styles.quadro}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Data/hora</th>
                <th scope="col">Tipo</th>
                <th scope="col">Gravidade</th>
                <th scope="col">Unidade / local</th>
                <th scope="col">Responsável</th>
                <th scope="col">Status</th>
                <th scope="col" title="Dias perdidos">Dias</th>
                <th scope="col">CAT</th>
                <th scope="col">Plano</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id}>
                  <td className={styles.codigo}>
                    <Link href={`/incidentes/${x.id}`}>{x.codigo}</Link>
                    {x.restrita && <IconeRestrito />}
                  </td>
                  <td className={styles.mono}>{formatarDataHora(x.dataHora, fuso)}</td>
                  <td>{ROTULO_TIPO_INCIDENTE[x.tipo]}</td>
                  <td><BadgeGravidadeIncidente gravidade={x.gravidade} rotulo={ROTULO_GRAVIDADE_INCIDENTE[x.gravidade]} /></td>
                  <td>
                    {x.obra.nome}
                    {(x.setor || x.local) && <span className={styles.sub}>{[x.setor?.nome, x.local].filter(Boolean).join(" · ")}</span>}
                  </td>
                  <td>{x.responsavel?.nome ?? "—"}</td>
                  <td><BadgeStatusIncidente status={x.status} rotulo={ROTULO_STATUS_INCIDENTE[x.status]} /></td>
                  <td className={styles.mono}>{x.diasPerdidos ?? "—"}</td>
                  <td>{x.geraCat ? "Sim" : "—"}</td>
                  <td>{x.planoAcaoId ? <Link href={`/plano-acao/planos/${x.planoAcaoId}`}>Ver</Link> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Cadeado que marca incidentes restritos (contêm dados pessoais protegidos pela LGPD). */
function IconeRestrito() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Restrito (LGPD)" className={styles.iconeRestrito}>
      <title>Restrito (LGPD)</title>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
