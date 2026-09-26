"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ROTULO_GRAVIDADE, ROTULO_ORIGEM, ROTULO_TIPO } from "@/lib/rnc/rotulos";
import { criarRncAcao } from "@/app/(app)/rncs/actions";
import { CampoArquivos } from "@/paginas/html/componentes/campo-arquivos";
import { Alerta } from "@/paginas/html/componentes/alerta";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import styles from "@/paginas/css/rnc-nova-formulario.module.css";

type Opcao = { id: string; nome: string };

const CLASSE_GRAVIDADE: Record<string, string> = {
  BAIXA: styles.gravidadeBaixa,
  MEDIA: styles.gravidadeMedia,
  ALTA: styles.gravidadeAlta,
  CRITICA: styles.gravidadeCritica,
};

/** Bloco numerado do formulário (coluna de título à esquerda, campos à direita; empilha no celular). */
function Secao({ numero, titulo, descricao, children, className }: { numero: string; titulo: string; descricao?: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={`${styles.secao} ${className ?? ""}`}>
      <legend className={styles.legendaOculta}>{titulo}</legend>
      <div className={styles.cabecalhoSecao} aria-hidden="true">
        <div className={styles.numeroSecao}>{numero}</div>
        <div className={styles.tituloSecao}>{titulo}</div>
        {descricao && <div className={styles.descricaoSecao}>{descricao}</div>}
      </div>
      <div className={styles.camposSecao}>{children}</div>
    </fieldset>
  );
}

function Obrigatorio() {
  return <span className={styles.obrigatorio}> *</span>;
}

/** Formulário de abertura de RNC (client): tipo/gravidade como seletores visuais, bloco LGPD condicional. */
export function FormNovaRnc({
  obras,
  setores,
  usuarios,
  podeSensiveis,
}: {
  obras: Opcao[];
  setores: Opcao[];
  usuarios: Opcao[];
  podeSensiveis: boolean;
}) {
  const [res, acao, pendente] = useActionState(criarRncAcao, null);
  const [tipo, setTipo] = useState("QUALIDADE");
  const [pessoais, setPessoais] = useState(false);
  // Após erro, a action devolve os valores enviados: repovoa os campos (React reseta o form).
  const v = res?.valores ?? {};

  return (
    <form key={JSON.stringify(v)} action={acao} className={styles.formulario}>
      <div className={styles.cartao}>
        {/* ---------------------------------------------------------- 01 */}
        <Secao numero="01" titulo="O que aconteceu" descricao="Fatos, sem culpados.">
          <div className={styles.campo}>
            <label className={styles.rotulo} htmlFor="titulo">Título<Obrigatorio /></label>
            <input id="titulo" name="titulo" defaultValue={v.titulo} required maxLength={200} className={styles.entrada} />
          </div>
          <div className={styles.campo}>
            <label className={styles.rotulo} htmlFor="descricao">Descrição<Obrigatorio /></label>
            <textarea id="descricao" name="descricao" defaultValue={v.descricao} required rows={4} className={styles.entrada} />
          </div>
        </Secao>

        {/* ---------------------------------------------------------- 02 */}
        <Secao numero="02" titulo="Classificação">
          <div className={styles.gradeClassificacao}>
            <div className={styles.campo}>
              <span id="lbl-tipo" className={styles.rotulo}>Tipo<Obrigatorio /></span>
              <div role="radiogroup" aria-labelledby="lbl-tipo" className={styles.segmentado}>
                {Object.entries(ROTULO_TIPO).map(([valor, rotulo]) => (
                  <label key={valor} className={styles.opcaoSegmentada}>
                    <input
                      type="radio"
                      name="tipo"
                      value={valor}
                      checked={tipo === valor}
                      onChange={(e) => setTipo(e.target.value)}
                      className={styles.radioOculto}
                    />
                    {rotulo}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.campo}>
              <label className={styles.rotulo} htmlFor="origem">Origem<Obrigatorio /></label>
              <select id="origem" name="origem" defaultValue={v.origem} className={styles.entrada}>
                {Object.entries(ROTULO_ORIGEM).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.campo}>
            <span id="lbl-grav" className={styles.rotulo}>Gravidade<Obrigatorio /></span>
            <div role="radiogroup" aria-labelledby="lbl-grav" className={styles.gradeGravidade}>
              {Object.entries(ROTULO_GRAVIDADE).map(([valor, rotulo]) => (
                <label key={valor} className={`${styles.opcaoGravidade} ${CLASSE_GRAVIDADE[valor]}`}>
                  <input
                    type="radio"
                    name="gravidade"
                    value={valor}
                    defaultChecked={(v.gravidade ?? "MEDIA") === valor}
                    className={styles.radioOculto}
                  />
                  <span className={styles.pontoGravidade} aria-hidden="true" />
                  {rotulo}
                </label>
              ))}
            </div>
          </div>
        </Secao>

        {/* ---------------------------------------------------------- 03 */}
        <Secao numero="03" titulo="Onde e quem">
          <div className={styles.gradeDupla}>
            <div className={styles.campo}>
              <label className={styles.rotulo} htmlFor="obraId">Obra / unidade<Obrigatorio /></label>
              <select id="obraId" name="obraId" required className={styles.entrada} defaultValue={v.obraId ?? (obras.length === 1 ? obras[0].id : "")}>
                <option value="">Selecione...</option>
                {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div className={styles.campo}>
              <label className={styles.rotulo} htmlFor="setorId">Setor</label>
              <select id="setorId" name="setorId" defaultValue={v.setorId} className={styles.entrada}>
                <option value="">—</option>
                {setores.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div className={styles.campo}>
              <label className={styles.rotulo} htmlFor="processoArea">Processo / área</label>
              <input id="processoArea" name="processoArea" defaultValue={v.processoArea} className={styles.entrada} />
            </div>
            <div className={styles.campo}>
              <label className={styles.rotulo} htmlFor="responsavelId">Responsável sugerido</label>
              <select id="responsavelId" name="responsavelId" defaultValue={v.responsavelId} className={styles.entrada}>
                <option value="">—</option>
                {usuarios.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
          </div>
        </Secao>

        {/* ---------------------------------------------------------- 04 */}
        <Secao numero="04" titulo="Evidências" descricao="Opcional">
          <CampoArquivos rotulo="Anexos (fotos e documentos)" />
        </Secao>

        {/* ---------------------------------------------------------- 05 */}
        <Secao numero="05" titulo="Privacidade" className={styles.secaoFinal}>
          <label className={styles.linhaInterruptor}>
            <input
              type="checkbox"
              role="switch"
              name="contemDadosPessoais"
              checked={pessoais}
              onChange={(e) => setPessoais(e.target.checked)}
              className={styles.interruptor}
            />
            <span className={styles.rotuloInterruptor}>Contém dados pessoais (LGPD)</span>
          </label>
          <label className={styles.linhaCaixa}>
            <input type="checkbox" name="restrita" defaultChecked={v.restrita === "on"} className={styles.caixa} />
            Marcar como restrita
          </label>
          {tipo === "SSO" && pessoais && (
            <p className={styles.notaRestrita}>
              <IconeCadeado />
              <span>RNCs de SSO com dados pessoais são restritas automaticamente.</span>
            </p>
          )}

          {pessoais && (
            <div className={styles.blocoSensivel}>
              <p className={styles.tituloSensivel}>Dados sensíveis — acesso restrito</p>
              <div className={styles.gradeSensiveis}>
                <div className={styles.campo}>
                  <label className={styles.rotulo} htmlFor="nomeEnvolvido">Nome do envolvido</label>
                  <input id="nomeEnvolvido" name="nomeEnvolvido" defaultValue={v.nomeEnvolvido} className={styles.entrada} />
                </div>
                <div className={styles.campo}>
                  <label className={styles.rotulo} htmlFor="documentoEnvolvido">Documento</label>
                  <input id="documentoEnvolvido" name="documentoEnvolvido" defaultValue={v.documentoEnvolvido} className={`${styles.entrada} ${styles.entradaMono}`} />
                </div>
                <div className={styles.campo}>
                  <label className={styles.rotulo} htmlFor="funcaoEnvolvido">Função</label>
                  <input id="funcaoEnvolvido" name="funcaoEnvolvido" defaultValue={v.funcaoEnvolvido} className={styles.entrada} />
                </div>
              </div>
              <div className={styles.campo}>
                <label className={styles.rotulo} htmlFor="relato">Relato</label>
                <textarea id="relato" name="relato" defaultValue={v.relato} rows={3} className={styles.entrada} />
              </div>
              <div className={styles.campo}>
                <label className={styles.rotulo} htmlFor="lesaoDescricao">Descrição da lesão</label>
                <textarea id="lesaoDescricao" name="lesaoDescricao" defaultValue={v.lesaoDescricao} rows={2} className={styles.entrada} />
              </div>
              {podeSensiveis && (
                <CampoArquivos
                  nome="arquivosSensiveis"
                  rotulo="Anexos com dados pessoais (acesso restrito)"
                  ajuda="Visíveis apenas para quem tem acesso a dados sensíveis."
                />
              )}
            </div>
          )}
        </Secao>
      </div>

      {res?.erro && <Alerta variante="erro" role="alert">{res.erro}</Alerta>}

      <div className={styles.rodape}>
        <LinkBotao href="/rncs" variante="secundario" className={styles.botaoCancelar}>Cancelar</LinkBotao>
        <Botao type="submit" disabled={pendente} className={styles.botaoAbrir}>
          {pendente ? "Salvando..." : "Abrir RNC"}
          {!pendente && <IconeSeta />}
        </Botao>
      </div>
    </form>
  );
}

function IconeCadeado() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function IconeSeta() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
