"use client";

import { useId, useState } from "react";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { FormAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/componentes/clonar-obra.module.css";

/**
 * "Clone Inteligente" (docs/ideias-implantadas/01-riscos-hira-laia.md, item 4): duplica a
 * planilha (HIRA ou LAIA) vigente de uma obra para outra. As linhas nascem sujeitas à mesma
 * política de aprovação do módulo — o gestor da obra destino só precisa ler e confirmar.
 */
export function ClonarObraForm({ acao, obras }: { acao: AcaoServidor; obras: { id: string; nome: string }[] }) {
  const idOrigem = useId();
  const idDestino = useId();
  const [aberto, setAberto] = useState(false);

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
      confirmar="Clonar todas as linhas vigentes desta obra para a obra destino? Elas nascem para o gestor da unidade destino revisar."
    >
      <div className={styles.campoFiltro}>
        <Rotulo htmlFor={idOrigem}>Obra de origem</Rotulo>
        <Selecao id={idOrigem} name="origemObraId" required defaultValue="">
          <option value="">— escolha —</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </Selecao>
      </div>
      <div className={styles.campoFiltro}>
        <Rotulo htmlFor={idDestino}>Obra de destino</Rotulo>
        <Selecao id={idDestino} name="destinoObraId" required defaultValue="">
          <option value="">— escolha —</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </Selecao>
      </div>
    </FormAcao>
  );
}
