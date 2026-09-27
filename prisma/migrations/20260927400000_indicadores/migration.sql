-- CreateEnum
CREATE TYPE "DirecaoIndicador" AS ENUM ('MAIOR_MELHOR', 'MENOR_MELHOR');

CREATE TYPE "PeriodicidadeIndicador" AS ENUM ('MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "FonteIndicador" AS ENUM ('MANUAL', 'RNC_EFICACIA_PRIMEIRA_VERIFICACAO', 'PLANO_ITENS_ATRASADOS');

-- AlterEnum
ALTER TYPE "Permissao" ADD VALUE 'INDICADOR_GERENCIAR';

-- AlterEnum
ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'INDICADOR';

-- AlterEnum
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'INDICADOR';

-- AlterEnum
ALTER TYPE "TipoNotificacao" ADD VALUE 'INDICADOR_SEM_LANCAMENTO';

-- CreateTable
CREATE TABLE "indicador" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "processo_id" UUID,
    "unidade" TEXT NOT NULL,
    "direcao" "DirecaoIndicador" NOT NULL,
    "meta" DECIMAL(14,4) NOT NULL,
    "periodicidade" "PeriodicidadeIndicador" NOT NULL,
    "fonte" "FonteIndicador" NOT NULL DEFAULT 'MANUAL',
    "formula" TEXT,
    "responsavel_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultado_indicador" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "indicador_id" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "valor" DECIMAL(14,4) NOT NULL,
    "meta" DECIMAL(14,4) NOT NULL,
    "direcao" "DirecaoIndicador" NOT NULL,
    "automatico" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "registrado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultado_indicador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "indicador_empresa_id_processo_id_idx" ON "indicador"("empresa_id", "processo_id");

-- CreateIndex
CREATE INDEX "indicador_empresa_id_responsavel_id_idx" ON "indicador"("empresa_id", "responsavel_id");

-- CreateIndex
CREATE UNIQUE INDEX "indicador_empresa_id_id_key" ON "indicador"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "indicador_empresa_id_nome_key" ON "indicador"("empresa_id", "nome");

-- CreateIndex
CREATE INDEX "resultado_indicador_empresa_id_indicador_id_periodo_criado__idx" ON "resultado_indicador"("empresa_id", "indicador_id", "periodo", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "resultado_indicador_empresa_id_id_key" ON "resultado_indicador"("empresa_id", "id");

-- AddForeignKey
ALTER TABLE "indicador" ADD CONSTRAINT "indicador_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicador" ADD CONSTRAINT "indicador_empresa_id_processo_id_fkey" FOREIGN KEY ("empresa_id", "processo_id") REFERENCES "processo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicador" ADD CONSTRAINT "indicador_empresa_id_responsavel_id_fkey" FOREIGN KEY ("empresa_id", "responsavel_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicador" ADD CONSTRAINT "indicador_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_indicador" ADD CONSTRAINT "resultado_indicador_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_indicador" ADD CONSTRAINT "resultado_indicador_empresa_id_indicador_id_fkey" FOREIGN KEY ("empresa_id", "indicador_id") REFERENCES "indicador"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_indicador" ADD CONSTRAINT "resultado_indicador_empresa_id_registrado_por_id_fkey" FOREIGN KEY ("empresa_id", "registrado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Regras SQL (P7 — Indicadores)
ALTER TABLE "indicador" ADD CONSTRAINT "indicador_textos" CHECK (length(btrim("nome")) > 0 AND length(btrim("unidade")) > 0);
-- Período: AAAA (anual), AAAA-MM (mensal), AAAA-Tn (trimestral) ou AAAA-Sn (semestral).
ALTER TABLE "resultado_indicador" ADD CONSTRAINT "resultado_indicador_periodo" CHECK ("periodo" ~ '^[0-9]{4}(-(0[1-9]|1[0-2])|-T[1-4]|-S[12])?$');

-- ResultadoIndicador é append-only: correção = novo lançamento do mesmo período.
CREATE OR REPLACE FUNCTION resultado_indicador_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'resultado_indicador é imutável: % não permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resultado_indicador_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON resultado_indicador
  FOR EACH ROW EXECUTE FUNCTION resultado_indicador_imutavel();
