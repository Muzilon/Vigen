"use client";

import { useActionState, useId, useState } from "react";
import { Botao } from "@/paginas/html/componentes/botao";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/aprovacao-detalhe-acoes.module.css";

/**
 * Formulário de decisão (Aprovar / Rejeitar, comentário obrigatório na rejeição) e botão de
 * cancelamento do solicitante, na página de detalhe do fluxo.
 */
export function AprovacaoDetalheAcoes({
  fluxoId,
  versao,
  podeDecidir,
  podeCancelar,
  decidir,
  cancelar,
}: {
  fluxoId: string;
  versao: number;
  podeDecidir: boolean;
  podeCancelar: boolean;
  decidir: AcaoServidor;
  cancelar: AcaoServidor;
}) {
  // Dois formulários independentes (decidir e cancelar), cada um ligado à sua server action com resposta e estado "enviando".
  const [resDecisao, executarDecisao, pendenteDecisao] = useActionState(decidir, null);
  const [resCancelar, executarCancelar, pendenteCancelar] = useActionState(cancelar, null);
  // Aviso local mostrado quando se tenta rejeitar sem escrever o motivo.
  const [avisoRejeicao, setAvisoRejeicao] = useState("");
  // Id único para ligar os rótulos aos campos (acessibilidade).
  const id = useId();

  return (
    <div className={styles.acoes}>
      {podeDecidir && (
        <form
          action={executarDecisao}
          className={styles.formDecisao}
          onSubmit={(e) => {
            // Descobre qual botão foi clicado (Aprovar ou Rejeitar) e lê o comentário digitado.
            const botao = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            const comentario = new FormData(e.currentTarget).get("comentario");
            // Rejeitar exige comentário: se estiver vazio, cancela o envio e mostra o aviso.
            if (botao?.value === "REJEITAR" && !String(comentario ?? "").trim()) {
              e.preventDefault();
              setAvisoRejeicao("Informe o motivo da rejeição no comentário.");
              return;
            }
            setAvisoRejeicao("");
          }}
        >
          <input type="hidden" name="id" value={fluxoId} />
          <input type="hidden" name="versao" value={versao} />
          <label htmlFor={`${id}-comentario`} className={styles.rotulo}>
            Comentário <span className={styles.dica}>(obrigatório para rejeitar)</span>
          </label>
          <textarea
            id={`${id}-comentario`}
            name="comentario"
            rows={3}
            maxLength={2000}
            className={styles.areaTexto}
            aria-invalid={avisoRejeicao ? true : undefined}
            aria-describedby={avisoRejeicao ? `${id}-aviso` : undefined}
          />
          {avisoRejeicao && (
            <p id={`${id}-aviso`} role="alert" className={styles.aviso}>
              {avisoRejeicao}
            </p>
          )}
          <div className={styles.botoes}>
            <Botao type="submit" name="decisao" value="REJEITAR" variante="perigo" disabled={pendenteDecisao}>
              Rejeitar
            </Botao>
            <Botao type="submit" name="decisao" value="APROVAR" disabled={pendenteDecisao}>
              {pendenteDecisao ? "Aguarde..." : "Aprovar"}
            </Botao>
          </div>
          <RetornoAcao res={resDecisao} />
        </form>
      )}

      {podeCancelar && (
        <form
          action={executarCancelar}
          className={styles.formCancelar}
          onSubmit={(e) => {
            if (!window.confirm("Cancelar esta solicitação de aprovação?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={fluxoId} />
          <input type="hidden" name="versao" value={versao} />
          <label htmlFor={`${id}-motivo`} className={styles.rotulo}>
            Motivo do cancelamento <span className={styles.dica}>(opcional)</span>
          </label>
          <input id={`${id}-motivo`} name="motivo" maxLength={2000} className={styles.entrada} />
          <div className={styles.botoes}>
            <Botao type="submit" variante="secundario" disabled={pendenteCancelar}>
              {pendenteCancelar ? "Aguarde..." : "Cancelar solicitação"}
            </Botao>
          </div>
          <RetornoAcao res={resCancelar} />
        </form>
      )}
    </div>
  );
}
