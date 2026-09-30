"use client";

import { useState } from "react";
import { registrarIncidenteAcao } from "@/app/(app)/incidentes/actions";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/incidentes-novo-formulario.module.css";

// Uma opção de lista: o id (valor guardado) e o nome (o que aparece).
type Opcao = { id: string; nome: string };

// Tipos de ocorrência: valor guardado e texto exibido.
const TIPOS: [string, string][] = [
  ["QUASE_ACIDENTE", "Quase-acidente"],
  ["ACIDENTE_TIPICO", "Acidente típico"],
  ["ACIDENTE_TRAJETO", "Acidente de trajeto"],
  ["DOENCA_OCUPACIONAL", "Doença ocupacional"],
];
// Gravidades possíveis: valor guardado e texto exibido.
const GRAVIDADES: [string, string][] = [
  ["SEM_AFASTAMENTO", "Sem afastamento"],
  ["COM_AFASTAMENTO", "Com afastamento"],
  ["FATALIDADE", "Fatalidade"],
];

/**
 * Formulário de registro de incidente: dados do fato, envolvido (colaborador ou terceiro), dados sensíveis (LGPD),
 * CAT e fotos de evidência. O registro vira "restrito" automaticamente quando há pessoa envolvida ou dado sensível.
 * - `obras`, `setores`, `usuarios`: listas para as escolhas. `agora`: data/hora atual no fuso da empresa (padrão e limite).
 * - `podeSensiveis`: se o usuário pode anexar arquivos sensíveis.
 */
/** Registro de incidente: dados do fato, envolvido (usuário ou terceiro), toggle de dados sensíveis e fotos. */
export function IncidenteNovoFormulario({
  obras,
  setores,
  usuarios,
  agora,
  podeSensiveis,
}: {
  obras: Opcao[];
  setores: Opcao[];
  usuarios: Opcao[];
  /** "YYYY-MM-DDTHH:mm" no fuso da empresa. */
  agora: string;
  podeSensiveis: boolean;
}) {
  // Quem está envolvido: ninguém identificado, um colaborador do sistema ou um terceiro (muda os campos mostrados).
  const [envolvido, setEnvolvido] = useState<"nenhum" | "usuario" | "terceiro">("nenhum");
  // Se o usuário marcou "Registrar dados sensíveis" (mostra o bloco de dados protegidos pela LGPD).
  const [sensiveis, setSensiveis] = useState(false);
  // Gravidade escolhida (só pede "dias perdidos" quando há afastamento).
  const [gravidade, setGravidade] = useState("SEM_AFASTAMENTO");
  // Se a ocorrência gera CAT (Comunicação de Acidente de Trabalho) — mostra o campo do número.
  const [cat, setCat] = useState(false);
  // Há dado pessoal no registro? Nesse caso o sistema marca como restrito automaticamente (LGPD).
  const temPessoais = envolvido !== "nenhum" || sensiveis;

  return (
    <FormAcao acao={registrarIncidenteAcao} botao="Registrar incidente" className={styles.formulario}>
      <fieldset className={styles.grupo}>
        <legend>O que aconteceu</legend>
        <div className={styles.grade}>
          <label className={styles.campo}>Tipo
            <select name="tipo" defaultValue="QUASE_ACIDENTE" className={styles.entrada}>
              {TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </label>
          <label className={styles.campo}>Gravidade
            <select name="gravidade" value={gravidade} onChange={(e) => setGravidade(e.target.value)} className={styles.entrada}>
              {GRAVIDADES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </label>
          <label className={styles.campo}>Data e hora
            <input type="datetime-local" name="dataHora" required defaultValue={agora} max={agora} className={styles.entrada} />
          </label>
          <label className={styles.campo}>Unidade
            <select name="obraId" required defaultValue={obras.length === 1 ? obras[0].id : ""} className={styles.entrada}>
              <option value="">Selecione…</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </label>
          <label className={styles.campo}>Setor (opcional)
            <select name="setorId" defaultValue="" className={styles.entrada}>
              <option value="">—</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
          <label className={styles.campo}>Local (detalhe)
            <input name="local" maxLength={300} placeholder="Ex.: Bloco B, 4º pavimento, fachada norte" className={styles.entrada} />
          </label>
          <label className={styles.campoLargo}>Descrição dos fatos
            <textarea name="descricaoFatos" required rows={4} maxLength={8000} placeholder="O que aconteceu, atividade em execução, condições do local. Evite nomes aqui — use o bloco de dados sensíveis." className={styles.entrada} />
          </label>
          {gravidade !== "SEM_AFASTAMENTO" && (
            <label className={styles.campo}>Dias perdidos (se já conhecido)
              <input type="number" name="diasPerdidos" min={0} className={styles.entrada} />
            </label>
          )}
          <label className={styles.caixa}>
            <input type="checkbox" name="geraCat" checked={cat} onChange={(e) => setCat(e.target.checked)} /> Gera CAT (Comunicação de Acidente de Trabalho)
          </label>
          {cat && (
            <label className={styles.campo}>Número da CAT (opcional)
              <input name="numeroCat" maxLength={60} className={styles.entrada} />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className={styles.grupo}>
        <legend>Envolvido e testemunhas</legend>
        <div role="radiogroup" aria-label="Envolvido" className={styles.segmentado}>
          {([["nenhum", "Sem envolvido identificado"], ["usuario", "Colaborador (usuário do sistema)"], ["terceiro", "Terceiro / outra pessoa"]] as const).map(([v, r]) => (
            <label key={v} className={`${styles.opcao} ${envolvido === v ? styles.opcaoAtiva : ""}`}>
              <input type="radio" name="_envolvido" value={v} checked={envolvido === v} onChange={() => setEnvolvido(v)} className={styles.radioOculto} />
              {r}
            </label>
          ))}
        </div>
        <div className={styles.grade}>
          {envolvido === "usuario" && (
            <label className={styles.campo}>Colaborador envolvido
              <select name="envolvidoId" required defaultValue="" className={styles.entrada}>
                <option value="">Selecione…</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>
          )}
          {envolvido === "terceiro" && (
            <>
              <label className={styles.campo}>Nome do terceiro
                <input name="terceiroNome" required maxLength={200} className={styles.entrada} />
              </label>
              <label className={styles.campo}>Função / empresa
                <input name="terceiroFuncao" maxLength={200} placeholder="Ex.: Servente — Empreiteira X" className={styles.entrada} />
              </label>
            </>
          )}
          <label className={styles.campoLargo}>Testemunhas (nomes)
            <input name="testemunhas" maxLength={2000} className={styles.entrada} />
          </label>
        </div>

        <label className={styles.caixa}>
          <input type="checkbox" name="temSensiveis" checked={sensiveis} onChange={(e) => setSensiveis(e.target.checked)} /> Registrar dados sensíveis (documento, relato, lesão)
        </label>
        {sensiveis && (
          <div className={styles.blocoSensivel}>
            <p className={styles.tituloSensivel}>Dados sensíveis — acesso restrito (LGPD)</p>
            <div className={styles.grade}>
              <label className={styles.campo}>Nome do envolvido
                <input name="nomeEnvolvido" maxLength={200} className={styles.entrada} />
              </label>
              <label className={styles.campo}>Documento (CPF/RG)
                <input name="documentoEnvolvido" maxLength={60} className={styles.entrada} />
              </label>
              <label className={styles.campo}>Função
                <input name="funcaoEnvolvido" maxLength={200} className={styles.entrada} />
              </label>
              <label className={styles.campoLargo}>Relato do envolvido
                <textarea name="relato" rows={3} maxLength={8000} className={styles.entrada} />
              </label>
              <label className={styles.campoLargo}>Lesão / parte do corpo atingida
                <input name="lesaoDescricao" maxLength={4000} className={styles.entrada} />
              </label>
              <label className={styles.campoLargo}>Relato das testemunhas
                <textarea name="testemunhasRelato" rows={2} maxLength={8000} className={styles.entrada} />
              </label>
              {podeSensiveis && (
                <label className={styles.campoLargo}>Anexos sensíveis (atestado, foto de lesão)
                  <input type="file" name="arquivosSensiveis" multiple className={styles.entrada} />
                </label>
              )}
            </div>
          </div>
        )}
        {temPessoais ? (
          <label className={styles.caixa}>
            <input type="checkbox" checked disabled /> Restrito (automático)
          </label>
        ) : (
          <label className={styles.caixa}>
            <input type="checkbox" name="restrita" /> Marcar como restrito
          </label>
        )}
        <p className={styles.nota}>
          Com envolvido, testemunhas ou dados sensíveis o registro fica restrito automaticamente (LGPD): só quem tem a permissão de
          ver incidentes restritos, quem registrou e o responsável pela investigação o acessam.
        </p>
      </fieldset>

      <fieldset className={styles.grupo}>
        <legend>Evidências (fotos do local)</legend>
        <input type="file" name="arquivos" multiple accept="image/*,application/pdf" className={styles.entrada} />
      </fieldset>
    </FormAcao>
  );
}
