"use client";

import { useId, useState } from "react";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { FormAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/componentes/clonar-obra.module.css";

/**
 * "Clone Inteligente" (docs/ideias-implantadas/01-riscos-hira-laia.md, item 4): duplica a
 * planilha (HIRA ou LAIA) vigente de uma obra para outra. As linhas nascem sujeitas à mesma
 * política de aprovação do módulo — o gestor da obra destino só precisa ler e confirmar.
 *
 * - `acao`: a função de servidor que faz a cópia de fato (vem da página que usa este componente).
 * - `obras`: lista de unidades para escolher origem e destino.
 * É um componente "de cliente" ("use client"): precisa reagir a cliques, por isso usa `useState`.
 */
export function ClonarObraForm({ acao, obras }: { acao: AcaoServidor; obras: { id: string; nome: string }[] }) {
  // useId gera ids únicos para ligar cada <label> ao seu campo (acessibilidade).
  const idOrigem = useId();
  const idDestino = useId();
  // `aberto` guarda se o formulário está visível. Começa fechado: só aparece o link.
  const [aberto, setAberto] = useState(false);

  // Fechado: mostra só o link "Duplicar matriz..."; ao clicar, abre o formulário.
  if (!aberto) {
    return (
      <button type="button" className={styles.linkLimpar} onClick={() => setAberto(true)}>
        Duplicar matriz para nova unidade
      </button>
    );
  }

  return (
    <FormAcao
      acao={acao}
      botao="Duplicar matriz"
      variante="secundario"
      className={styles.barraFiltros}
      confirmar="Clonar todas as linhas vigentes desta unidade para a unidade destino? Elas nascem para o gestor da unidade destino revisar."
    >
      <div className={styles.campoFiltro}>
        <Rotulo htmlFor={idOrigem}>Unidade de origem</Rotulo>
        <Selecao id={idOrigem} name="origemObraId" required defaultValue="">
          <option value="">— escolha —</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </Selecao>
      </div>
      <div className={styles.campoFiltro}>
        <Rotulo htmlFor={idDestino}>Unidade de destino</Rotulo>
        <Selecao id={idDestino} name="destinoObraId" required defaultValue="">
          <option value="">— escolha —</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </Selecao>
      </div>
    </FormAcao>
  );
}
