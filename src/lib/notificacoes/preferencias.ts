/** Preferências de notificação da empresa (Empresa.config.notificacoes + Empresa.diasAlertaPrazo). */
export interface PreferenciasNotificacao {
  /** Antecedência (dias) do alerta de prazo de item de ação. 0 = só no dia do prazo. */
  diasAlertaPrazo: number;
  /** Envia o resumo semanal (segunda-feira) para gestores. */
  resumoSemanal: boolean;
  /** Envia e-mail além da notificação in-app. */
  email: boolean;
}

export const MAX_DIAS_ALERTA = 30;

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function lerPreferencias(empresa: { config: unknown; diasAlertaPrazo: number }): PreferenciasNotificacao {
  const n = objeto(objeto(empresa.config).notificacoes);
  const dias = Number.isFinite(empresa.diasAlertaPrazo) ? empresa.diasAlertaPrazo : 3;
  return {
    diasAlertaPrazo: Math.min(MAX_DIAS_ALERTA, Math.max(0, Math.trunc(dias))),
    resumoSemanal: n.resumoSemanal !== false,
    email: n.email !== false,
  };
}

/** Novo objeto config preservando as demais chaves. */
export function mesclarConfig(config: unknown, p: Pick<PreferenciasNotificacao, "resumoSemanal" | "email">) {
  const cfg = objeto(config);
  return { ...cfg, notificacoes: { ...objeto(cfg.notificacoes), resumoSemanal: p.resumoSemanal, email: p.email } };
}
