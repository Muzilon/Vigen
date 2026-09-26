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

/** Botão de ação (submit, filtro, etc.). Variantes: primario (padrão), secundario, perigo, texto. */
export function Botao({ variante = "primario", className, ...props }: PropsBotao) {
  return <button className={`${styles.botao} ${CLASSE_VARIANTE[variante]} ${className ?? ""}`} {...props} />;
}

type PropsLinkBotao = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variante?: VarianteBotao };

/** Mesma aparência do Botao, para navegação (Link do Next). */
export function LinkBotao({ variante = "primario", className, href, ...props }: PropsLinkBotao) {
  return <Link href={href} className={`${styles.botao} ${CLASSE_VARIANTE[variante]} ${className ?? ""}`} {...props} />;
}
