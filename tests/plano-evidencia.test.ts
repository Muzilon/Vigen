import { describe, expect, it } from "vitest";
import { exigenciaJustificativaData, semEvidenciaCalculado } from "@/lib/plano-acao/evidencia";

describe("semEvidenciaCalculado — etiqueta 'Sem evidência'", () => {
  it("vale sem descrição, sem link e sem anexo", () => {
    expect(semEvidenciaCalculado({ evidencia: null, linkEvidencia: null, anexosAtivos: 0 })).toBe(true);
    expect(semEvidenciaCalculado({ evidencia: "  ", linkEvidencia: "", anexosAtivos: 0 })).toBe(true);
  });

  it("deixa de valer com descrição, link ou anexo (qualquer um)", () => {
    expect(semEvidenciaCalculado({ evidencia: "Feito conforme o checklist", anexosAtivos: 0 })).toBe(false);
    expect(semEvidenciaCalculado({ linkEvidencia: "https://exemplo.com/pasta", anexosAtivos: 0 })).toBe(false);
    expect(semEvidenciaCalculado({ anexosAtivos: 1 })).toBe(false);
  });

  it("volta a valer quando o único anexo é excluído", () => {
    expect(semEvidenciaCalculado({ evidencia: null, linkEvidencia: null, anexosAtivos: 1 })).toBe(false);
    expect(semEvidenciaCalculado({ evidencia: null, linkEvidencia: null, anexosAtivos: 0 })).toBe(true);
  });
});

describe("exigenciaJustificativaData — data de conclusão", () => {
  const hoje = "2026-10-01";

  it("hoje nunca exige justificativa", () => {
    expect(exigenciaJustificativaData("2026-10-01", hoje, false)).toBeNull();
    expect(exigenciaJustificativaData("2026-10-01", hoje, true)).toBeNull();
  });

  it("data futura exige justificativa de qualquer pessoa", () => {
    expect(exigenciaJustificativaData("2026-10-05", hoje, false)).toBe("futura");
    expect(exigenciaJustificativaData("2026-10-05", hoje, true)).toBe("futura");
  });

  it("data anterior exige justificativa só quando registrada por outra pessoa que não o responsável", () => {
    expect(exigenciaJustificativaData("2026-09-20", hoje, true)).toBe("retroativa-terceiro");
    expect(exigenciaJustificativaData("2026-09-20", hoje, false)).toBeNull();
  });
});
