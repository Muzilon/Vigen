"use client";

import { useActionState, useState } from "react";
import { entrar } from "@/app/login/actions";
import { Rotulo, Entrada } from "@/paginas/html/componentes/campo-formulario";
import { Botao } from "@/paginas/html/componentes/botao";
import { Alerta } from "@/paginas/html/componentes/alerta";
import styles from "@/paginas/css/login.module.css";

/**
 * Formulário de login (e-mail e senha), com botão de mostrar/ocultar a senha.
 * É "use client" porque reage a cliques (mostrar senha) e mostra o estado "Entrando...".
 */
export function LoginFormulario() {
  // Liga o formulário à server action `entrar`: `estado` traz o erro (e o e-mail digitado), `pendente` indica que está enviando.
  const [estado, acao, pendente] = useActionState(entrar, null);
  // Se a senha está sendo exibida em texto (true) ou escondida com pontinhos (false).
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  // Mensagem de erro de login, se houver (ex.: senha incorreta).
  const erro = estado?.erro;

  return (
    <form key={estado?.email ?? ""} action={acao} className={styles.cartaoFormulario}>
      <h2 className={styles.tituloFormulario}>Entrar</h2>
      <p className={styles.subtituloFormulario}>Use o e-mail cadastrado pela sua empresa.</p>

      <div className={styles.grupoCampo}>
        <Rotulo htmlFor="email">E-mail</Rotulo>
        <Entrada id="email" name="email" type="email" required autoComplete="email" defaultValue={estado?.email} />
      </div>

      <div className={styles.grupoCampo}>
        <Rotulo htmlFor="senha">Senha</Rotulo>
        <div className={styles.envoltorioSenha}>
          <Entrada
            id="senha"
            name="senha"
            type={senhaVisivel ? "text" : "password"}
            required
            autoComplete="current-password"
            style={{ paddingRight: 44 }}
          />
          <button
            type="button"
            aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={senhaVisivel}
            onClick={() => setSenhaVisivel((v) => !v)}
            className={styles.botaoMostrarSenha}
          >
            <IconeOlho aberto={senhaVisivel} />
          </button>
        </div>
      </div>

      {erro && (
        <div className={styles.grupoCampo}>
          <Alerta variante="erro" icone={<IconeAlerta />} role="alert">
            {erro}
          </Alerta>
        </div>
      )}

      <Botao type="submit" disabled={pendente} className={styles.botaoEntrar}>
        {pendente ? "Entrando..." : "Entrar"}
      </Botao>

      {/* Aviso da regra de bloqueio (5 falhas por e-mail → 15 min): valores de LIMITE_LOGIN em src/lib/auth/limite-login.ts. */}
      <p className={styles.notaBloqueio}>Após 5 tentativas erradas o acesso é bloqueado por 15 minutos.</p>
    </form>
  );
}

/** Ícone de olho: aberto quando a senha está escondida (clique para mostrar), riscado quando está visível. */
function IconeOlho({ aberto }: { aberto: boolean }) {
  if (!aberto) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M6.7 6.7C4.5 8.1 3 10.5 2 12c0 0 3.5 7 10 7 2 0 3.7-.6 5-1.4" />
      <path d="M14.1 5.3A10.6 10.6 0 0 1 22 12s-.7 1.4-2.1 3" />
    </svg>
  );
}

/** Ícone exibido ao lado da mensagem de erro do login. */
function IconeAlerta() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
