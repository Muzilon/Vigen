import { afterEach, describe, expect, it } from "vitest";
import { cronAutorizado } from "@/lib/cron/auth";
import { hojeNoFuso } from "@/lib/datas";
import { escaparHtml, montarEmail } from "@/lib/email/templates";
import { usuarioAcessaRnc } from "@/lib/notificacoes/destinatarios";
import { lerPreferencias, mesclarConfig } from "@/lib/notificacoes/preferencias";
import { diasAte, segundaDaSemana, selecionarAlertas, type ItemParaAlerta } from "@/lib/notificacoes/selecao";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const item = (id: string, quando: string, extra: Partial<ItemParaAlerta> = {}): ItemParaAlerta => ({
  id,
  status: "PENDENTE",
  quando: d(quando),
  alertaEnviadoEm: null,
  atrasoNotificadoEm: null,
  ...extra,
});
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();

describe("seleção de itens a alertar", () => {
  const itens = [
    item("ontem", "2026-09-25"),
    item("hoje", "2026-09-26"),
    item("d3", "2026-09-29"),
    item("d4", "2026-09-30"),
    item("concluido", "2026-09-27", { status: "CONCLUIDO" }),
    item("cancelado", "2026-09-20", { status: "CANCELADO" }),
    item("andamento", "2026-09-28", { status: "EM_ANDAMENTO" }),
  ];

  it("prazo dentro da janela [hoje, hoje+dias] e atraso < hoje", () => {
    const r = selecionarAlertas(itens, "2026-09-26", 3);
    expect(ids(r.prazo)).toEqual(["andamento", "d3", "hoje"]);
    expect(ids(r.atraso)).toEqual(["ontem"]);
  });

  it("diasAlerta = 0 alerta só o que vence hoje", () => {
    expect(ids(selecionarAlertas(itens, "2026-09-26", 0).prazo)).toEqual(["hoje"]);
  });

  it("usa o dia no fuso da empresa (23h30 em São Paulo ainda é o dia anterior em UTC+0)", () => {
    const instante = new Date("2026-09-27T02:30:00Z"); // 26/09 23:30 em São Paulo; 27/09 em UTC
    const hojeSp = hojeNoFuso("America/Sao_Paulo", instante);
    const hojeUtc = hojeNoFuso("UTC", instante);
    expect(hojeSp).toBe("2026-09-26");
    expect(hojeUtc).toBe("2026-09-27");
    // Em SP o item de 26/09 ainda vence hoje; em UTC já está atrasado.
    expect(ids(selecionarAlertas([item("x", "2026-09-26")], hojeSp, 3).prazo)).toEqual(["x"]);
    expect(ids(selecionarAlertas([item("x", "2026-09-26")], hojeUtc, 3).atraso)).toEqual(["x"]);
    // Tóquio já está em 27/09 às 11h30.
    expect(hojeNoFuso("Asia/Tokyo", instante)).toBe("2026-09-27");
  });

  it("idempotente: itens já alertados/avisados não voltam", () => {
    const hoje = "2026-09-26";
    const r1 = selecionarAlertas(itens, hoje, 3);
    const marcados = itens.map((i) => ({
      ...i,
      alertaEnviadoEm: r1.prazo.some((p) => p.id === i.id) ? new Date() : i.alertaEnviadoEm,
      atrasoNotificadoEm: r1.atraso.some((p) => p.id === i.id) ? new Date() : i.atrasoNotificadoEm,
    }));
    const r2 = selecionarAlertas(marcados, hoje, 3);
    expect(r2.prazo).toEqual([]);
    expect(r2.atraso).toEqual([]);
  });

  it("item alertado de prazo ainda recebe aviso de atraso depois que vence", () => {
    const i = item("x", "2026-09-26", { alertaEnviadoEm: new Date() });
    expect(selecionarAlertas([i], "2026-09-26", 3).prazo).toEqual([]);
    expect(ids(selecionarAlertas([i], "2026-09-27", 3).atraso)).toEqual(["x"]);
  });

  it("segunda-feira da semana e dias até o prazo", () => {
    expect(segundaDaSemana("2026-09-28")).toBe("2026-09-28"); // segunda
    expect(segundaDaSemana("2026-09-26")).toBe("2026-09-21"); // sábado
    expect(segundaDaSemana("2026-09-27")).toBe("2026-09-21"); // domingo
    expect(diasAte("2026-09-26", d("2026-09-29"))).toBe(3);
    expect(diasAte("2026-09-26", d("2026-09-24"))).toBe(-2);
  });
});

describe("preferências", () => {
  it("padrões e leitura do config", () => {
    expect(lerPreferencias({ config: {}, diasAlertaPrazo: 3 })).toEqual({ diasAlertaPrazo: 3, resumoSemanal: true, email: true });
    expect(lerPreferencias({ config: { notificacoes: { resumoSemanal: false } }, diasAlertaPrazo: 99 })).toEqual({
      diasAlertaPrazo: 30,
      resumoSemanal: false,
      email: true,
    });
    expect(lerPreferencias({ config: null, diasAlertaPrazo: -1 }).diasAlertaPrazo).toBe(0);
  });
  it("mesclar preserva outras chaves", () => {
    expect(mesclarConfig({ tema: "x", notificacoes: { outro: 1 } }, { resumoSemanal: false, email: true })).toEqual({
      tema: "x",
      notificacoes: { outro: 1, resumoSemanal: false, email: true },
    });
  });
});

describe("destinatários: acesso à RNC", () => {
  const rnc = { obraId: "o1", restrita: false, abertoPorId: "a", responsavelId: "r" };
  it("obra e restrita", () => {
    expect(usuarioAcessaRnc({ id: "u", permissoes: [], obras: null }, rnc)).toBe(true);
    expect(usuarioAcessaRnc({ id: "u", permissoes: [], obras: ["o2"] }, rnc)).toBe(false);
    expect(usuarioAcessaRnc({ id: "r", permissoes: [], obras: ["o2"] }, rnc)).toBe(true);
    expect(usuarioAcessaRnc({ id: "u", permissoes: [], obras: null }, { ...rnc, restrita: true })).toBe(false);
    expect(usuarioAcessaRnc({ id: "u", permissoes: ["RNC_VER_RESTRITAS"], obras: null }, { ...rnc, restrita: true })).toBe(true);
  });
});

describe("e-mail", () => {
  it("escapa HTML e monta link absoluto", () => {
    expect(escaparHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    const m = montarEmail({ titulo: "RNC <b>", paragrafos: ["Olá"], link: "/rncs/1" });
    expect(m.assunto).toBe("[Vigen] RNC <b>");
    expect(m.html).toContain("RNC &lt;b&gt;");
    expect(m.html).toMatch(/href="https?:\/\/[^"]+\/rncs\/1"/);
    expect(m.texto).toContain("/rncs/1");
  });
});

describe("cron: autorização", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    process.env.CRON_SECRET = original;
  });
  const req = (h?: string) => new Request("http://x/api/cron/diario", { headers: h ? { authorization: h } : {} });
  it("exige Bearer CRON_SECRET", () => {
    process.env.CRON_SECRET = "segredo";
    expect(cronAutorizado(req("Bearer segredo"))).toBe(true);
    expect(cronAutorizado(req("Bearer outro"))).toBe(false);
    expect(cronAutorizado(req())).toBe(false);
  });
  it("sem CRON_SECRET configurado, nega", () => {
    delete process.env.CRON_SECRET;
    expect(cronAutorizado(req("Bearer "))).toBe(false);
  });
});
