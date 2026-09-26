import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adicionarItemModeloAcao,
  ativarModeloAcao,
  editarItemModeloAcao,
  editarModeloAcao,
  moverItemModeloAcao,
  removerItemModeloAcao,
} from "@/app/(app)/inspecoes/actions";
import { getAtor } from "@/lib/ator-servidor";
import { ROTULO_TIPO_CHECKLIST, ROTULO_TIPO_RESPOSTA, TIPOS_CHECKLIST, TIPOS_RESPOSTA } from "@/lib/inspecoes/regras";
import { obterModelo, podeGerenciarModelos } from "@/lib/inspecoes/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/inspecao-modelo.module.css";

type Item = { id: string; pergunta: string; tipoResposta: (typeof TIPOS_RESPOSTA)[number]; obrigatorioFoto: boolean; ajuda: string | null };

function CamposItem({ item }: { item?: Item }) {
  return (
    <>
      <label className={styles.campoLargo}>Pergunta<input name="pergunta" required minLength={3} maxLength={500} defaultValue={item?.pergunta} className={styles.entrada} /></label>
      <label className={styles.campo}>Tipo de resposta
        <select name="tipoResposta" defaultValue={item?.tipoResposta ?? "CONFORME_NAO_CONFORME_NA"} className={styles.entrada}>
          {TIPOS_RESPOSTA.map((t) => <option key={t} value={t}>{ROTULO_TIPO_RESPOSTA[t]}</option>)}
        </select>
      </label>
      <label className={styles.marcador}><input type="checkbox" name="obrigatorioFoto" defaultChecked={item?.obrigatorioFoto} /> Foto obrigatória se não conforme</label>
      <label className={styles.campoLargo}>Critério / ajuda (opcional)<input name="ajuda" maxLength={1000} defaultValue={item?.ajuda ?? ""} className={styles.entrada} /></label>
    </>
  );
}

/** Detalhe do modelo de checklist: dados, perguntas reordenáveis (↑↓), adicionar/editar/remover. */
export default async function InspecaoModelo({ params }: PageProps<"/inspecoes/modelos/[id]">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "INSPECOES");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  if (!podeGerenciarModelos(a)) notFound();
  const m = await obterModelo(a, id);
  if (!m) notFound();

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/inspecoes/modelos">← Modelos de checklist</Link>
      </nav>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>{m.nome}</h1>
          <p className={styles.meta}>{ROTULO_TIPO_CHECKLIST[m.tipo]} · {m.itens.length} pergunta(s) · nota mínima {m.notaMinima} · {m._count.inspecoes} inspeção(ões) · {m.ativo ? "Ativo" : "Inativo"}</p>
        </div>
        <FormAcao acao={ativarModeloAcao} botao={m.ativo ? "Inativar modelo" : "Reativar modelo"} variante={m.ativo ? "secundario" : "primario"} tamanho="pequeno">
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="ativo" value={m.ativo ? "0" : "1"} />
        </FormAcao>
      </header>
      <p className={styles.aviso}>Alterações nas perguntas valem para as próximas inspeções; as já iniciadas guardam o texto da época.</p>

      <Cartao titulo={`Perguntas · ${m.itens.length}`}>
        {m.itens.length === 0 ? (
          <p className={styles.vazio}>Nenhuma pergunta. Adicione abaixo.</p>
        ) : (
          <ol className={styles.itens}>
            {m.itens.map((it, n) => (
              <li key={it.id} className={styles.item}>
                <div className={styles.linhaItem}>
                  <span className={styles.ordem}>{it.ordem}</span>
                  <div className={styles.textoItem}>
                    <strong>{it.pergunta}</strong>
                    <span className={styles.meta}>{ROTULO_TIPO_RESPOSTA[it.tipoResposta]}{it.obrigatorioFoto ? " · foto obrigatória em NC" : ""}{it.ajuda ? ` · ${it.ajuda}` : ""}</span>
                  </div>
                  <div className={styles.botoesOrdem}>
                    <FormAcao acao={moverItemModeloAcao} botao="↑" variante="texto" tamanho="pequeno">
                      <input type="hidden" name="itemId" value={it.id} />
                      <input type="hidden" name="modeloId" value={m.id} />
                      <input type="hidden" name="direcao" value="cima" />
                    </FormAcao>
                    <FormAcao acao={moverItemModeloAcao} botao="↓" variante="texto" tamanho="pequeno">
                      <input type="hidden" name="itemId" value={it.id} />
                      <input type="hidden" name="modeloId" value={m.id} />
                      <input type="hidden" name="direcao" value="baixo" />
                    </FormAcao>
                  </div>
                </div>
                <details className={styles.editar}>
                  <summary>Editar pergunta {n + 1}</summary>
                  <FormAcao acao={editarItemModeloAcao} botao="Salvar" tamanho="pequeno" className={styles.formulario}>
                    <input type="hidden" name="itemId" value={it.id} />
                    <input type="hidden" name="modeloId" value={m.id} />
                    <CamposItem item={it} />
                  </FormAcao>
                  <FormAcao acao={removerItemModeloAcao} botao="Remover pergunta" variante="perigo" tamanho="pequeno" confirmar="Remover esta pergunta do modelo?" className={styles.remover}>
                    <input type="hidden" name="itemId" value={it.id} />
                    <input type="hidden" name="modeloId" value={m.id} />
                  </FormAcao>
                </details>
              </li>
            ))}
          </ol>
        )}
        <h3 className={styles.subtitulo}>Adicionar pergunta</h3>
        <FormAcao acao={adicionarItemModeloAcao} botao="Adicionar" tamanho="pequeno" className={styles.formulario}>
          <input type="hidden" name="modeloId" value={m.id} />
          <CamposItem />
        </FormAcao>
      </Cartao>

      <Cartao titulo="Dados do modelo">
        <FormAcao acao={editarModeloAcao} botao="Salvar" tamanho="pequeno" className={styles.formulario}>
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="versao" value={m.versao} />
          <label className={styles.campoLargo}>Nome<input name="nome" required minLength={3} maxLength={150} defaultValue={m.nome} className={styles.entrada} /></label>
          <label className={styles.campo}>Tipo
            <select name="tipo" defaultValue={m.tipo} className={styles.entrada}>
              {TIPOS_CHECKLIST.map((t) => <option key={t} value={t}>{ROTULO_TIPO_CHECKLIST[t]}</option>)}
            </select>
          </label>
          <label className={styles.campo}>Nota mínima<input name="notaMinima" type="number" min={1} max={5} defaultValue={m.notaMinima} className={styles.entrada} /></label>
          <label className={styles.campoLargo}>Descrição<textarea name="descricao" rows={2} maxLength={2000} defaultValue={m.descricao ?? ""} className={styles.entrada} /></label>
        </FormAcao>
      </Cartao>
    </div>
  );
}
