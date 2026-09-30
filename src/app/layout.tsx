import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/paginas/css/base.css";

// Fonte do Design System Vigen (ver docs/05-guia-paginas-css.md): Inter em toda a interface.
// Exposta como variável CSS consumida por src/paginas/css/base.css (token --fonte-ui).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Vigen",
  description: "Vigen — Sistema de Gestão Integrado (ISO 9001, 14001 e 45001)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
