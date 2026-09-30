import type { TipoEntidadeInteracao } from "@prisma/client";
import { enviarInteracaoAcao } from "@/app/(app)/rncs/actions";
import { AtualizarContadores } from "@/components/atualizar-contadores";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Cartao } from "@/paginas/html/componentes/cartao";
import type { Ator } from "@/lib/ator";
import { formatarDataHora } from "@/lib/datas";
import { listarInteracoes, marcarLidas } from "@/lib/interacoes/servico";
import { marcarLidasDaEntidade } from "@/lib/notificacoes/servico";
import styles from "@/paginas/css/componentes/interacoes.module.css";

/** Pega as iniciais do nome para o "avatar" redondo: "Maria Silva" → "MS". */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Seção "Interações": a conversa (comentários) de um registro — uma RNC, um documento etc.
 * Mostra as mensagens, o formulário para escrever uma nova e, ao ser exibida, marca como lidas
 * as mensagens que o usuário recebeu. É um componente de servidor ("async"): busca os dados
 * no banco antes de desenhar a tela.
 * - `a`: quem está logado. `tipo` + `entidadeId`: a qual registro a conversa pertence.
 * - `usuarios`: pessoas que podem receber a mensagem. `fuso`: fuso horário da empresa (para as datas).
 */
export async function Interacoes({
  a,
  tipo,
  entidadeId,
  usuarios,
  fuso,
}: {
  a: Ator;
  tipo: TipoEntidadeInteracao;
  entidadeId: string;
  usuarios: { id: string; nome: string }[];
  fuso: string;
}) {
  const t = { tipo, entidadeId };
  const msgs = await listarInteracoes(a, t);
  // marcarLidas também marca as notificações INTERACAO_NOVA; contamos as duas para saber se o
  // contador do layout (sino) ficou desatualizado.
  const notifPendentes = await marcarLidasDaEntidade(a, tipo, entidadeId);
  const marcadas = (await marcarLidas(a, t)) + notifPendentes;
  return (
    <Cartao titulo="Interações">
      {marcadas > 0 && <AtualizarContadores />}
      {msgs.length === 0 ? (
        <p className={styles.vazio}>Nenhuma mensagem ainda.</p>
      ) : (
        <ul className={styles.lista}>
          {msgs.map((m) => {
            // `minha`: fui eu quem escreveu (muda o estilo do balão).
            const minha = m.autorId === a.usuarioId;
            // `nova`: mensagem endereçada a mim que ainda não tinha sido lida (ganha o selo "nova").
            const nova = m.destinatarioId === a.usuarioId && !minha && m.leituras.length === 0;
            return (
              <li key={m.id} className={`${styles.mensagem} ${minha ? styles.mensagemPropria : ""}`}>
                <span className={styles.avatar} aria-hidden="true">{iniciais(m.autor.nome)}</span>
                <div className={styles.corpo}>
                  <div className={styles.cabecalhoMensagem}>
                    <span className={styles.autor}>{m.autor.nome}</span>
                    {m.destinatario && <span>para {m.destinatario.nome}</span>}
                    <span className={styles.data}>{formatarDataHora(m.criadoEm, fuso)}</span>
                    {nova && <span className={styles.seloNova}>nova</span>}
                  </div>
                  <p className={styles.texto}>{m.mensagem}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <FormAcao acao={enviarInteracaoAcao} botao="Enviar" className={styles.formulario}>
        <input type="hidden" name="entidadeTipo" value={tipo} />
        <input type="hidden" name="entidadeId" value={entidadeId} />
        <label htmlFor={`msg-${entidadeId}`} className={styles.rotuloOculto}>Mensagem</label>
        <textarea id={`msg-${entidadeId}`} name="mensagem" rows={3} required maxLength={4000} placeholder="Escreva uma mensagem" className={styles.areaTexto} />
        <div className={styles.linhaDestinatario}>
          <label className={styles.rotuloDestinatario} htmlFor={`dest-${entidadeId}`}>Para</label>
          <select id={`dest-${entidadeId}`} name="destinatarioId" defaultValue="" className={styles.selecao}>
            <option value="">Padrão (responsável)</option>
            {usuarios.filter((u) => u.id !== a.usuarioId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      </FormAcao>
    </Cartao>
  );
}
