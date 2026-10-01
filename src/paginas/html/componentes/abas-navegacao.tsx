"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/paginas/css/componentes/abas-modulo.module.css";

/**
 * Faixa de abas (links) que destaca a página atual. É "use client" só porque precisa saber o endereço atual
 * (`usePathname`) para marcar a aba ativa. Quem decide QUAIS abas existem é o AbasModulo (servidor).
 */
export function AbasNavegacao({ abas }: { abas: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // A aba ativa é a de endereço MAIS LONGO que combina com a página (assim "/treinamentos" não ganha de "/treinamentos/meus").
  const ativa = [...abas]
    .filter((a) => pathname === a.href || pathname.startsWith(`${a.href}/`))
    .sort((x, y) => y.href.length - x.href.length)[0]?.href;
  return (
    <nav aria-label="Seções do módulo" className={styles.abas}>
      {abas.map((a) => (
        <Link key={a.href} href={a.href} aria-current={a.href === ativa ? "page" : undefined} className={a.href === ativa ? styles.abaAtiva : styles.aba}>
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
