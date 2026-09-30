import styles from "@/paginas/css/componentes/payload-aprovacao.module.css";

type Obj = Record<string, unknown>;
/** Confere se o valor é um objeto comum (com campos), e não lista, texto ou vazio. */
const ehObjeto = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Transforma qualquer valor em texto para exibir: vazio vira "—", verdadeiro/falso vira "Sim"/"Não". */
function formatarValor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return JSON.stringify(v, null, 2);
}

/** "nomeDoCampo" / "nome_do_campo" → "Nome do campo". */
function rotuloChave(k: string) {
  const s = k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Exibe o payload de um fluxo de aprovação de forma legível: lista chave/valor, ou tabela
 * "antes → depois" quando o payload tem o formato { antes, depois } (campos alterados em destaque).
 */
export function PayloadAprovacao({ payload }: { payload: unknown }) {
  // Caso 1: o payload traz { antes, depois } → mostra uma tabela comparando campo a campo.
  if (ehObjeto(payload) && ehObjeto(payload.antes) && ehObjeto(payload.depois)) {
    const antes = payload.antes;
    const depois = payload.depois;
    // Junta os nomes de campos dos dois lados, sem repetir.
    const chaves = [...new Set([...Object.keys(antes), ...Object.keys(depois)])];
    return (
      <table className={styles.diff}>
        <thead>
          <tr>
            <th scope="col" className={styles.th}>Campo</th>
            <th scope="col" className={styles.th}>Antes</th>
            <th scope="col" className={styles.th}>Depois</th>
          </tr>
        </thead>
        <tbody>
          {chaves.map((k) => {
            // Se o valor é diferente antes e depois, a linha recebe destaque.
            const mudou = JSON.stringify(antes[k]) !== JSON.stringify(depois[k]);
            return (
              <tr key={k} className={mudou ? styles.linhaAlterada : undefined}>
                <th scope="row" className={styles.campo}>
                  {rotuloChave(k)}
                  {mudou && <span className={styles.somenteLeitor}> (alterado)</span>}
                </th>
                <td className={mudou ? styles.valorAntigo : styles.valor}>{formatarValor(antes[k])}</td>
                <td className={mudou ? styles.valorNovo : styles.valor}>{formatarValor(depois[k])}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  // Caso 2: objeto simples → lista "campo: valor".
  if (ehObjeto(payload)) {
    const entradas = Object.entries(payload);
    if (entradas.length === 0) return <p className={styles.vazio}>Sem dados adicionais.</p>;
    return (
      <dl className={styles.lista}>
        {entradas.map(([k, v]) => (
          <div key={k} className={styles.par}>
            <dt className={styles.campo}>{rotuloChave(k)}</dt>
            <dd className={styles.valor}>{formatarValor(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  // Caso 3: sem dados, ou um valor qualquer que não é objeto (mostrado como texto).
  if (payload === null || payload === undefined) return <p className={styles.vazio}>Sem dados adicionais.</p>;
  return <pre className={styles.valor}>{formatarValor(payload)}</pre>;
}
