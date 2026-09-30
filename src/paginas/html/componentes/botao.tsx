import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import Link from "next/link";
import styles from "@/paginas/css/componentes/botao.module.css";

type VarianteBotao = "primario" | "secundario" | "perigo" | "texto";

const CLASSE_VARIANTE: Record<VarianteBotao, string> = {
  primario: styles.primario,
  secundario: styles.secundario,
  perigo: styles.perigo,
  texto: styles.texto,
};

type PropsBotao = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao };

/**
 * Botão de ação (enviar formulário, aplicar filtro etc.).
 * `variante` muda o visual: "primario" (destaque, padrão), "secundario", "perigo" (vermelho,
 * para ações destrutivas) ou "texto" (sem fundo). Qualquer outra propriedade de <button>
 * (onClick, disabled, type...) é repassada direto ao botão.
 */
export function Botao({ variante = "primario", className, ...props }: PropsBotao) {
  return <button className={`${styles.botao} ${CLASSE_VARIANTE[variante]} ${className ?? ""}`} {...props} />;
}

type PropsLinkBotao = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variante?: VarianteBotao };

/**
 * Mesma aparência do Botao, mas é um link: leva para outra página (`href`) sem recarregar o
 * site inteiro, usando o componente Link do Next.
 */
export function LinkBotao({ variante = "primario", className, href, ...props }: PropsLinkBotao) {
  return <Link href={href} className={`${styles.botao} ${CLASSE_VARIANTE[variante]} ${className ?? ""}`} {...props} />;
}
