"use client";

import { useActionState, useState } from "react";
import type { ConfigEscala } from "@/lib/escala/tipos";
import { avaliarPS, eixosPS, HIERARQUIAS, ROTULO_CONDICAO, ROTULO_HIERARQUIA, type AvaliacaoPS } from "@/lib/hira/regras";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { Botao } from "@/paginas/html/componentes/botao";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/hira-formulario.module.css";

/** Todos os valores de uma linha HIRA que o formulário controla (com `id` e `versao` só na edição). */
export interface ValoresHira {
  id?: string;
  versao?: number;
  obraId: string;
  setor: string;
  processoId: string;
  atividade: string;
  rotineira: boolean;
  perigo: string;
  risco: string;
  condicao: "NORMAL" | "ANORMAL" | "EMERGENCIA";
  controlesExistentes: string;
  hierarquiaControle: string;
  controlesPropostos: string;
  probabilidade: number;
  severidade: number;
  probabilidadeResidual: string;
  severidadeResidual: string;
  requisitoLegal: string;
  responsavelId: string;
  modoReavaliacao: "ITEM" | "GERAL";
  periodicidadeMeses: number;
}

// Uma opção de lista: o id (valor guardado) e o nome (o que aparece).
type Opcao = { id: string; nome: string };

/** Calcula o nível (probabilidade × severidade) pela escala; se os valores estiverem fora dela, devolve vazio em vez de dar erro. */
function tentar(config: ConfigEscala, p: number, s: number): AvaliacaoPS | null {
  try {
    return avaliarPS(config, p, s);
  } catch {
    return null;
  }
}

/**
 * Formulário da linha HIRA com cálculo ao vivo do nível inicial e residual (escala resolvida pela
 * obra escolhida: `escalas[obraId]` ou `escalas[""]`). `aprovacao` avisa que a gravação vira uma
 * solicitação de aprovação (config da empresa); em "alterar", pede o motivo.
 */
export function HiraFormulario({
  acao,
  modo,
  inicial,
  escalas,
  obras,
  processos,
  usuarios,
  setores,
  aprovacao,
  botao,
}: {
  acao: AcaoServidor;
  modo: "incluir" | "alterar";
  inicial: ValoresHira;
  escalas: Record<string, ConfigEscala>;
  obras: Opcao[];
  processos: (Opcao & { codigo: string })[];
  usuarios: Opcao[];
  setores: string[];
  aprovacao: { aprovadores: string[] } | null;
  botao: string;
}) {
  // Liga o formulário à server action: `res` é a resposta, `pendente` indica que está enviando.
  const [res, executar, pendente] = useActionState(acao, null);
  // `v`: todos os valores do formulário (começam com os iniciais); a tela se redesenha quando mudam.
  const [v, setV] = useState(inicial);
  // Atualiza UM campo do formulário mantendo os demais.
  const set = <K extends keyof ValoresHira>(k: K, valor: ValoresHira[K]) => setV((x) => ({ ...x, [k]: valor }));
  // Escala de pontuação da unidade escolhida (ou a padrão da empresa, se a unidade não tiver a sua).
  const config = escalas[v.obraId] ?? escalas[""];
  // Os dois eixos da escala (probabilidade e severidade) com seus níveis.
  const { eixoP, eixoS } = eixosPS(config);
  // Nível inicial calculado ao vivo (faixa e pontuação).
  const aval = tentar(config, v.probabilidade, v.severidade);
  // Nível residual (após os controles), só calculado quando os dois valores residuais foram preenchidos.
  const residual = v.probabilidadeResidual && v.severidadeResidual ? tentar(config, Number(v.probabilidadeResidual), Number(v.severidadeResidual)) : null;
  // Cria o tratador de mudança de um campo de texto/lista: copia o que foi digitado para o estado.
  const valor = (k: keyof ValoresHira) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);
  // O risco inicial é alto ou crítico?
  const riscoAltoOuCritico = aval?.faixa === "ALTO" || aval?.faixa === "CRITICO";
  // Mostra o aviso da ISO 45001 quando o risco é alto/crítico e o controle escolhido é só EPI (o mais fraco da hierarquia).
  const avisoHierarquiaBaixa = riscoAltoOuCritico && v.hierarquiaControle === "EPI";

  return (
    <form action={executar} className={styles.formulario}>
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {v.versao !== undefined && <input type="hidden" name="versao" value={v.versao} />}

      {aprovacao && (
        <p className={styles.avisoAprovacao}>
          A empresa exige aprovação: ao salvar, {modo === "incluir" ? "a linha fica pendente" : "a alteração fica pendente"} até a assinatura de{" "}
          {aprovacao.aprovadores.join(", ") || "os aprovadores padrão"}.
        </p>
      )}

      <fieldset className={styles.bloco}>
        <legend className={styles.rotuloBloco}>Identificação</legend>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Unidade *</span>
          <select name="obraId" required value={v.obraId} onChange={valor("obraId")} className={styles.entrada}>
            <option value="">— escolha —</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Setor / frente *</span>
          <input name="setor" required minLength={2} maxLength={200} list="hira-setores" value={v.setor} onChange={valor("setor")} className={styles.entrada} />
          <datalist id="hira-setores">{setores.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Processo</span>
          <select name="processoId" value={v.processoId} onChange={valor("processoId")} className={styles.entrada}>
            <option value="">— sem processo —</option>
            {processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
          </select>
        </label>
        <label className={styles.campoLargo}>
          <span className={styles.rotulo}>Atividade *</span>
          <input name="atividade" required minLength={2} maxLength={2000} value={v.atividade} onChange={valor("atividade")} className={styles.entrada} />
        </label>
        <fieldset className={styles.campo}>
          <legend className={styles.rotulo}>Rotina</legend>
          <div className={styles.segmentado}>
            {([["1", "Rotineira"], ["0", "Não rotineira"]] as const).map(([k, r]) => (
              <label key={k} className={(k === "1") === v.rotineira ? styles.opcaoMarcada : styles.opcao}>
                <input type="radio" name="rotineira" value={k} checked={(k === "1") === v.rotineira} onChange={() => set("rotineira", k === "1")} className={styles.radio} />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Condição</span>
          <select name="condicao" value={v.condicao} onChange={valor("condicao")} className={styles.entrada}>
            {(["NORMAL", "ANORMAL", "EMERGENCIA"] as const).map((c) => <option key={c} value={c}>{ROTULO_CONDICAO[c]}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Perigo (fonte) *</span>
          <textarea name="perigo" required minLength={2} rows={2} value={v.perigo} onChange={valor("perigo")} className={styles.entrada} />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Risco / dano *</span>
          <textarea name="risco" required minLength={2} rows={2} value={v.risco} onChange={valor("risco")} className={styles.entrada} />
        </label>
      </fieldset>

      <fieldset className={styles.bloco}>
        <legend className={styles.rotuloBloco}>Avaliação inicial</legend>
        <label className={styles.campoLargo}>
          <span className={styles.rotulo}>Controles existentes</span>
          <textarea name="controlesExistentes" rows={2} value={v.controlesExistentes} onChange={valor("controlesExistentes")} className={styles.entrada} />
        </label>
        <div className={styles.avaliacao}>
          <label className={styles.campo}>
            <span className={styles.rotulo}>{eixoP.rotulo} *</span>
            <select name="probabilidade" value={v.probabilidade} onChange={(e) => set("probabilidade", Number(e.target.value))} className={styles.entrada}>
              {eixoP.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
            </select>
          </label>
          <span className={styles.vezes} aria-hidden="true">×</span>
          <label className={styles.campo}>
            <span className={styles.rotulo}>{eixoS.rotulo} *</span>
            <select name="severidade" value={v.severidade} onChange={(e) => set("severidade", Number(e.target.value))} className={styles.entrada}>
              {eixoS.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
            </select>
          </label>
          <div className={styles.resultado} aria-live="polite">
            <span className={styles.rotulo}>Nível inicial</span>
            {aval ? <BadgeFaixa faixa={aval.faixa} score={aval.score} /> : <span className={styles.aviso}>Fora da escala</span>}
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.bloco}>
        <legend className={styles.rotuloBloco}>Controles e risco residual</legend>
        <fieldset className={styles.campoLargo}>
          <legend className={styles.rotulo}>Hierarquia do controle proposto</legend>
          <input type="hidden" name="hierarquiaControle" value={v.hierarquiaControle} />
          <div className={styles.segmentado}>
            {HIERARQUIAS.map((h, i) => (
              <button
                key={h}
                type="button"
                className={v.hierarquiaControle === h ? styles.opcaoMarcada : styles.opcao}
                onClick={() => set("hierarquiaControle", h)}
              >
                {i + 1}. {ROTULO_HIERARQUIA[h]}
              </button>
            ))}
          </div>
          {avisoHierarquiaBaixa && (
            <p className={styles.avisoAprovacao}>
              Atenção: este risco é {aval?.faixa === "CRITICO" ? "crítico" : "alto"}. A ISO 45001 recomenda buscar
              controles superiores (eliminação, substituição, engenharia ou administrativo) antes de recorrer só a EPI.
            </p>
          )}
        </fieldset>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Controles propostos</span>
          <textarea name="controlesPropostos" rows={2} value={v.controlesPropostos} onChange={valor("controlesPropostos")} className={styles.entrada} />
        </label>
        <div className={styles.avaliacao}>
          <label className={styles.campo}>
            <span className={styles.rotulo}>{eixoP.rotulo} residual</span>
            <select name="probabilidadeResidual" value={v.probabilidadeResidual} onChange={valor("probabilidadeResidual")} className={styles.entrada}>
              <option value="">—</option>
              {eixoP.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
            </select>
          </label>
          <span className={styles.vezes} aria-hidden="true">×</span>
          <label className={styles.campo}>
            <span className={styles.rotulo}>{eixoS.rotulo} residual</span>
            <select name="severidadeResidual" value={v.severidadeResidual} onChange={valor("severidadeResidual")} className={styles.entrada}>
              <option value="">—</option>
              {eixoS.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
            </select>
          </label>
          <div className={styles.resultado} aria-live="polite">
            <span className={styles.rotulo}>Nível residual</span>
            {residual ? <BadgeFaixa faixa={residual.faixa} score={residual.score} /> : <span className={styles.aviso}>Não avaliado</span>}
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.bloco}>
        <legend className={styles.rotuloBloco}>Gestão</legend>
        <label className={styles.campoLargo}>
          <span className={styles.rotulo}>Requisito legal aplicável</span>
          <input name="requisitoLegal" maxLength={1000} placeholder="Ex.: NR-35 (trabalho em altura)" value={v.requisitoLegal} onChange={valor("requisitoLegal")} className={styles.entrada} />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Responsável</span>
          <select name="responsavelId" value={v.responsavelId} onChange={valor("responsavelId")} className={styles.entrada}>
            <option value="">— sem responsável —</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Reavaliação</span>
          <select name="modoReavaliacao" value={v.modoReavaliacao} onChange={valor("modoReavaliacao")} className={styles.entrada}>
            <option value="ITEM">Item a item</option>
            <option value="GERAL">Na revisão geral da unidade</option>
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Periodicidade (meses)</span>
          <input name="periodicidadeMeses" type="number" min={1} max={60} value={v.periodicidadeMeses} onChange={(e) => set("periodicidadeMeses", Number(e.target.value))} className={styles.entrada} />
        </label>
        {modo === "alterar" && (
          <label className={styles.campoLargo}>
            <span className={styles.rotulo}>Motivo da alteração</span>
            <input name="motivo" maxLength={1000} className={styles.entrada} />
          </label>
        )}
      </fieldset>

      <div className={styles.rodape}>
        <RetornoAcao res={res} />
        <Botao type="submit" disabled={pendente}>{pendente ? "Salvando…" : botao}</Botao>
      </div>
    </form>
  );
}
