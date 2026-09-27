"use client";

import { useActionState, useState } from "react";
import { criarPlanoManualAcao } from "@/app/(app)/plano-acao/actions";
import { linhaVazia, Tabela5W2H, type Linha5W2H } from "@/paginas/html/componentes/tabela-5w2h";
import { Alerta } from "@/paginas/html/componentes/alerta";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { Entrada, Rotulo } from "@/paginas/html/componentes/campo-formulario";
import styles from "@/paginas/css/plano-acao-novo-formulario.module.css";

type UsuarioObras = { id: string; nome: string; obras: string[] | null };

/** Todos os campos são controlados: um erro do servidor não apaga o que foi digitado. */
export function FormNovoPlano({ obras, usuarios }: { obras: { id: string; nome: string }[]; usuarios: UsuarioObras[] }) {
  const [res, acao, pendente] = useActionState(criarPlanoManualAcao, null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [obraId, setObraId] = useState("");
  const [linhas, setLinhas] = useState<Linha5W2H[]>([linhaVazia()]);

  const acessa = (u: UsuarioObras, obra: string) => !obra || u.obras === null || u.obras.includes(obra);
  const usuariosObra = usuarios.filter((u) => acessa(u, obraId));

  function trocarObra(nova: string) {
    setObraId(nova);
    // "Quem" sem acesso à nova obra é desmarcado.
    const permitidos = new Set(usuarios.filter((u) => acessa(u, nova)).map((u) => u.id));
    setLinhas(linhas.map((l) => (l.quemId && !permitidos.has(l.quemId) ? { ...l, quemId: "" } : l)));
  }

  // Só exibição: soma do "Quanto" digitado (campo numérico, opcional) nas linhas.
  const totalPrevisto = linhas.reduce((s, l) => s + (Number(l.quanto) || 0), 0);

  return (
    <form action={acao} className={styles.formulario}>
      {/* 1. Dados do plano + dica de preenchimento */}
      <div className={styles.gradeTopo}>
        <section aria-label="Dados do plano" className={styles.dadosPlano}>
          <div className={styles.campoLargo}>
            <Rotulo htmlFor="titulo">Título do plano *</Rotulo>
            <Entrada id="titulo" name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={3} maxLength={200} />
          </div>
          <div>
            <span className={styles.rotuloEstatico}>Origem</span>
            <span className={styles.origemFixa}>
              <IconeLapis />
              Manual <span className={styles.origemDetalhe}>· sem RNC vinculada</span>
            </span>
          </div>
          <div className={styles.campoLargo}>
            <Rotulo htmlFor="descricao">Objetivo</Rotulo>
            <textarea id="descricao" name="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={5000} className={styles.areaTexto} />
          </div>
          <div>
            <Rotulo htmlFor="obraId">
              Unidade <span className={styles.opcional}>opcional</span>
            </Rotulo>
            <select id="obraId" name="obraId" value={obraId} onChange={(e) => trocarObra(e.target.value)} className={styles.selecaoObra}>
              <option value="">Nenhuma (toda a empresa)</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
            <p className={styles.ajuda}>Com unidade, só usuários com acesso a ela podem ser o &quot;quem&quot; dos itens.</p>
          </div>
        </section>

        <aside aria-labelledby="dica-5w2h" className={styles.dica}>
          <h2 id="dica-5w2h" className={styles.tituloDica}>
            <IconeLampada />
            Como preencher o 5W2H
          </h2>
          <p className={styles.textoDica}>Uma linha = uma ação que uma pessoa consegue concluir e comprovar.</p>
          <ul className={styles.listaDica}>
            <li>Comece o <b>O quê</b> com um verbo: “Calibrar”, “Treinar”.</li>
            <li><b>Quem</b> é um só responsável — ele recebe a notificação.</li>
            <li><b>Quanto</b> é opcional.</li>
          </ul>
        </aside>
      </div>

      {/* 2. Itens 5W2H (componente compartilhado Tabela5W2H) */}
      <section aria-labelledby="t-5w2h" className={styles.secaoItens}>
        <div className={styles.cabecalhoItens}>
          <h2 id="t-5w2h" className={styles.tituloItens}>
            Itens (5W2H) * <span className={styles.contagem}>· {linhas.length} {linhas.length === 1 ? "linha" : "linhas"}</span>
          </h2>
          {totalPrevisto > 0 && (
            <span className={styles.total}>
              Total previsto <b>{totalPrevisto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b>
            </span>
          )}
        </div>
        <div className={styles.corpoItens}>
          <input type="hidden" name="itens" value={JSON.stringify(linhas)} />
          <Tabela5W2H linhas={linhas} onChange={setLinhas} usuarios={usuariosObra} />
        </div>
      </section>

      {res?.erro && (
        <Alerta role="alert" variante="erro">
          {res.erro}
        </Alerta>
      )}

      {/* 3. Rodapé de ações */}
      <div className={styles.rodape}>
        <p className={styles.notaRodape}>
          <IconeSino />
          Ao criar, cada responsável (exceto você) recebe uma notificação com a sua ação e o prazo.
        </p>
        <LinkBotao href="/plano-acao" variante="secundario">Cancelar</LinkBotao>
        <Botao type="submit" disabled={pendente}>{pendente ? "Salvando..." : "Criar plano de ação"}</Botao>
      </div>
    </form>
  );
}

function IconeLapis() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function IconeLampada() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />
    </svg>
  );
}

function IconeSino() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
