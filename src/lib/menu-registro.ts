import type { Modulo, Permissao } from "@prisma/client";
import { GRUPO_MODULO, type GrupoModulo } from "@/lib/modulos";
import type { Contexto } from "@/lib/tenant";
import { temPermissao } from "@/lib/tenant";
import { temModulo } from "@/lib/modulos";

/**
 * Registro de itens de menu por módulo. Um item só aparece no menu lateral quando:
 * 1) `implementado` é true (a página existe no app — evita links quebrados enquanto o
 *    módulo ainda não foi entregue, ver docs/06-desenho-modulos.md, pacotes P2..P7);
 * 2) o módulo está ativo para a empresa (Empresa.modulosAtivos);
 * 3) a permissão exigida (se houver) está presente no contexto.
 *
 * RNC, Plano de Ação e Configurações continuam fixos em src/app/(app)/layout.tsx — são a
 * base do sistema e não fazem parte do gating por módulo contratado.
 */
export interface ItemMenuRegistro {
  modulo: Modulo;
  href: string;
  label: string;
  grupo: GrupoModulo;
  /** false enquanto a página do módulo não existir — some do menu independente do gating. */
  implementado: boolean;
  /** Exige ao menos uma destas permissões (lista = qualquer uma). */
  permissao?: Permissao | readonly Permissao[];
}

export const REGISTRO_ITENS_MENU: ItemMenuRegistro[] = [
  { modulo: "MAPA_PROCESSOS", href: "/processos", label: "Mapa de processos", grupo: GRUPO_MODULO.QUALIDADE, implementado: true },
  { modulo: "RISCOS_OPORTUNIDADES", href: "/riscos", label: "Riscos e oportunidades", grupo: GRUPO_MODULO.GESTAO, implementado: true },
  { modulo: "SWOT", href: "/swot", label: "SWOT", grupo: GRUPO_MODULO.GESTAO, implementado: true },
  { modulo: "HIRA", href: "/hira", label: "Perigos e riscos (HIRA)", grupo: GRUPO_MODULO.SEGURANCA, implementado: true },
  { modulo: "LAIA", href: "/laia", label: "Aspectos ambientais", grupo: GRUPO_MODULO.MEIO_AMBIENTE, implementado: true },
  { modulo: "INSPECOES", href: "/inspecoes", label: "Inspeções / checklists", grupo: GRUPO_MODULO.QUALIDADE, implementado: true },
  { modulo: "AUDITORIAS", href: "/auditorias", label: "Auditorias internas", grupo: GRUPO_MODULO.QUALIDADE, implementado: true },
  { modulo: "DOCUMENTOS", href: "/documentos", label: "Documentos (lista mestra)", grupo: GRUPO_MODULO.QUALIDADE, implementado: true, permissao: ["DOCUMENTO_ELABORAR", "DOCUMENTO_GERENCIAR"] },
  { modulo: "DOCUMENTOS", href: "/documentos/meus", label: "Meus documentos", grupo: GRUPO_MODULO.QUALIDADE, implementado: true },
  { modulo: "REQUISITOS_LEGAIS", href: "/requisitos-legais", label: "Requisitos legais", grupo: GRUPO_MODULO.GESTAO, implementado: true },
  { modulo: "INCIDENTES", href: "/incidentes", label: "Incidentes e acidentes", grupo: GRUPO_MODULO.SEGURANCA, implementado: false },
  { modulo: "INDICADORES", href: "/indicadores", label: "Indicadores", grupo: GRUPO_MODULO.GESTAO, implementado: false },
  { modulo: "TREINAMENTOS", href: "/treinamentos", label: "Treinamentos", grupo: GRUPO_MODULO.GESTAO, implementado: false },
];

/** Itens do registro visíveis para o contexto atual (módulo ativo, implementado e permitido). */
export function itensMenuVisiveis(ctx: Contexto): Omit<ItemMenuRegistro, "modulo" | "permissao" | "implementado">[] {
  return REGISTRO_ITENS_MENU.filter(
    (item) =>
      item.implementado &&
      temModulo(ctx, item.modulo) &&
      (!item.permissao || (Array.isArray(item.permissao) ? item.permissao : [item.permissao]).some((p: Permissao) => temPermissao(ctx, p))),
  ).map((item) => ({ href: item.href, label: item.label, grupo: item.grupo }));
}
