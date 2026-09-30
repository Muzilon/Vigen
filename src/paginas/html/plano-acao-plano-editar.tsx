"use client";

import { useActionState, useState } from "react";
import { editarPlanoManualAcao } from "@/app/(app)/plano-acao/actions";
import { Alerta } from "@/paginas/html/componentes/alerta";
import { Botao } from "@/paginas/html/componentes/botao";
import { Entrada, Rotulo } from "@/paginas/html/componentes/campo-formulario";
import styles from "@/paginas/css/plano-acao-plano-editar.module.css";

/**
 * Formulário para editar o título e o objetivo de um plano avulso.
 * É "use client": os campos são controlados pelo React (guardam o que foi digitado, inclusive se der erro).
 * - `planoId`/`versao`: qual plano é e em que versão foi lido (evita sobrescrever edição de outra pessoa).
 * - `titulo`/`descricao`: valores atuais, usados como ponto de partida.
 */
export function EditarPlanoForm({ planoId, versao, titulo: t0, descricao: d0 }: { planoId: string; versao: number; titulo: string; descricao: string }) {
  // Liga o formulário à server action: `res` é a resposta, `pendente` indica que está salvando.
  const [res, acao, pendente] = useActionState(editarPlanoManualAcao, null);
  // Texto atual do título e da descrição (começam com os valores salvos).
  const [titulo, setTitulo] = useState(t0);
  const [descricao, setDescricao] = useState(d0);
  return (
    <form action={acao} className={styles.formulario}>
      <input type="hidden" name="planoId" value={planoId} />
      <input type="hidden" name="versao" value={versao} />
      <div>
        <Rotulo htmlFor="titulo-plano">Título</Rotulo>
        <Entrada id="titulo-plano" name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={3} maxLength={200} />
      </div>
      <div>
        <Rotulo htmlFor="descricao-plano">Objetivo</Rotulo>
        <textarea id="descricao-plano" name="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={5000} className={styles.areaTexto} />
      </div>
      <div>
        <Botao type="submit" disabled={pendente}>{pendente ? "Aguarde..." : "Salvar"}</Botao>
      </div>
      {res?.erro && (
        <Alerta role="alert" variante="erro">
          {res.erro}
        </Alerta>
      )}
      {res?.ok && <p className={styles.sucesso}>{res.ok}</p>}
    </form>
  );
}
