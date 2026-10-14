"use client";

import { useActionState, useId, useState } from "react";
import { Entrada, Rotulo } from "@/paginas/html/componentes/campo-formulario";
import type { AcaoServidor, ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/configuracoes.module.css";

/**
 * Formulário de feriado (data + descrição), usado para cadastrar e para editar.
 * Os campos são "controlados" (guardados em estado): se a action devolver erro, o que a pessoa
 * digitou continua na tela. Com `limpar`, os campos esvaziam depois de um cadastro com sucesso.
 * Quando é edição, `id` e `versao` vão escondidos no formulário (a versão é a trava contra edição simultânea).
 */
export function FormularioFeriado({
  acao,
  botao,
  id,
  versao,
  inicial = { data: "", descricao: "" },
  limpar = false,
}: {
  acao: AcaoServidor;
  botao: string;
  id?: string;
  versao?: number;
  inicial?: { data: string; descricao: string };
  limpar?: boolean;
}) {
  // Prefixo único para ligar cada rótulo ao seu campo (a tela tem vários formulários).
  const uid = useId();
  // Valores digitados.
  const [data, setData] = useState(inicial.data);
  const [descricao, setDescricao] = useState(inicial.descricao);
  // Envolve a action: se der certo num cadastro, esvazia os campos.
  const envolver: AcaoServidor = async (anterior, fd) => {
    const r = await acao(anterior, fd);
    if (limpar && r?.ok) {
      setData("");
      setDescricao("");
    }
    return r;
  };
  // `res` é a resposta da action; `pendente` fica verdadeiro enquanto o servidor trabalha.
  const [res, executar, pendente] = useActionState<ResultadoAcao, FormData>(envolver, null);
  const idErro = `${uid}-erro`;
  return (
    <form action={executar} className={styles.formFeriado}>
      {id && <input type="hidden" name="id" value={id} />}
      {versao !== undefined && <input type="hidden" name="versao" value={versao} />}
      <div className={styles.campoFeriadoData}>
        <Rotulo htmlFor={`${uid}-data`}>Data *</Rotulo>
        <Entrada
          id={`${uid}-data`}
          name="data"
          type="date"
          required
          value={data}
          onChange={(e) => setData(e.target.value)}
          aria-invalid={res?.erro ? true : undefined}
          aria-describedby={res?.erro ? idErro : undefined}
          className={styles.alvoToque}
        />
      </div>
      <div className={styles.campoFeriadoDescricao}>
        <Rotulo htmlFor={`${uid}-descricao`}>Descrição *</Rotulo>
        <Entrada
          id={`${uid}-descricao`}
          name="descricao"
          required
          maxLength={120}
          placeholder="Ex.: Natal"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          aria-invalid={res?.erro ? true : undefined}
          aria-describedby={res?.erro ? idErro : undefined}
          className={styles.alvoToque}
        />
      </div>
      <button type="submit" disabled={pendente} className={`${styles.botaoPrimario} ${styles.alvoToque}`}>
        {pendente ? "Salvando…" : botao}
      </button>
      {res?.erro && <p id={idErro} role="alert" className={`${styles.retornoFeriado} ${styles.retornoErro}`}>{res.erro}</p>}
      {res?.ok && <p role="status" className={`${styles.retornoFeriado} ${styles.retornoSucesso}`}>{res.ok}</p>}
    </form>
  );
}
