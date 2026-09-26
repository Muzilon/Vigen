"use client";

import { useActionState, useState } from "react";
import { editarPlanoManualAcao } from "@/app/(app)/plano-acao/actions";
import { Alerta } from "@/paginas/html/componentes/alerta";
import { Botao } from "@/paginas/html/componentes/botao";
import { Entrada, Rotulo } from "@/paginas/html/componentes/campo-formulario";
import styles from "@/paginas/css/plano-acao-plano-editar.module.css";

/** Edição do cabeçalho do plano avulso; campos controlados (não se perdem em erro). */
export function EditarPlanoForm({ planoId, versao, titulo: t0, descricao: d0 }: { planoId: string; versao: number; titulo: string; descricao: string }) {
  const [res, acao, pendente] = useActionState(editarPlanoManualAcao, null);
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
