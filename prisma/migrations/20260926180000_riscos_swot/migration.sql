-- CreateEnum
CREATE TYPE "TipoRiscoOportunidade" AS ENUM ('RISCO', 'OPORTUNIDADE');

-- CreateEnum
CREATE TYPE "TratamentoRisco" AS ENUM ('ACEITAR', 'MITIGAR', 'TRANSFERIR', 'EVITAR', 'EXPLORAR');

-- CreateEnum
CREATE TYPE "StatusRiscoOportunidade" AS ENUM ('IDENTIFICADO', 'EM_TRATAMENTO', 'MONITORADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "FaixaNivel" AS ENUM ('BAIXO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "ModoReavaliacao" AS ENUM ('ITEM', 'GERAL');

-- CreateEnum
CREATE TYPE "AcaoHistoricoRisco" AS ENUM ('CRIACAO', 'ALTERACAO', 'TRATAMENTO', 'REAVALIACAO', 'REVISAO_GERAL', 'STATUS', 'EXCLUSAO');

-- CreateEnum
CREATE TYPE "QuadranteSwot" AS ENUM ('FORCA', 'FRAQUEZA', 'OPORTUNIDADE', 'AMEACA');

-- AlterEnum
ALTER TYPE "OrigemPlanoAcao" ADD VALUE 'RISCO_OPORTUNIDADE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permissao" ADD VALUE 'RISCO_GERENCIAR';
ALTER TYPE "Permissao" ADD VALUE 'RISCO_TRATAR';
ALTER TYPE "Permissao" ADD VALUE 'SWOT_GERENCIAR';

-- AlterEnum
ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'RISCO_OPORTUNIDADE';

-- AlterEnum
ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'RISCO_OPORTUNIDADE';

-- AlterEnum
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'RISCO_OPORTUNIDADE';

-- CreateTable
CREATE TABLE "risco_oportunidade" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "TipoRiscoOportunidade" NOT NULL,
    "processo_id" UUID,
    "obra_id" UUID,
    "descricao" TEXT NOT NULL,
    "causa" TEXT,
    "consequencia" TEXT,
    "probabilidade" INTEGER NOT NULL,
    "impacto" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "faixa" "FaixaNivel" NOT NULL,
    "tratamento" "TratamentoRisco",
    "descricao_tratamento" TEXT,
    "probabilidade_residual" INTEGER,
    "impacto_residual" INTEGER,
    "score_residual" INTEGER,
    "faixa_residual" "FaixaNivel",
    "status" "StatusRiscoOportunidade" NOT NULL DEFAULT 'IDENTIFICADO',
    "responsavel_id" UUID,
    "plano_acao_id" UUID,
    "modo_reavaliacao" "ModoReavaliacao" NOT NULL DEFAULT 'ITEM',
    "periodicidade_meses" INTEGER NOT NULL DEFAULT 12,
    "proxima_reavaliacao_em" DATE,
    "ultima_reavaliacao_em" TIMESTAMP(3),
    "versao" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risco_oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_risco_oportunidade" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "risco_id" UUID NOT NULL,
    "acao" "AcaoHistoricoRisco" NOT NULL,
    "probabilidade" INTEGER NOT NULL,
    "impacto" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "faixa" "FaixaNivel" NOT NULL,
    "probabilidade_residual" INTEGER,
    "impacto_residual" INTEGER,
    "score_residual" INTEGER,
    "faixa_residual" "FaixaNivel",
    "tratamento" "TratamentoRisco",
    "status" "StatusRiscoOportunidade" NOT NULL,
    "observacao" TEXT,
    "usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_risco_oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ciclo_swot" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "encerrado" BOOLEAN NOT NULL DEFAULT false,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ciclo_swot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_swot" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    "quadrante" "QuadranteSwot" NOT NULL,
    "descricao" TEXT NOT NULL,
    "relevancia" INTEGER NOT NULL DEFAULT 3,
    "risco_oportunidade_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_swot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parte_interessada" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "necessidades" TEXT,
    "expectativas" TEXT,
    "influencia" INTEGER NOT NULL DEFAULT 3,
    "interesse" INTEGER NOT NULL DEFAULT 3,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parte_interessada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risco_oportunidade_empresa_id_processo_id_idx" ON "risco_oportunidade"("empresa_id", "processo_id");

-- CreateIndex
CREATE INDEX "risco_oportunidade_empresa_id_faixa_idx" ON "risco_oportunidade"("empresa_id", "faixa");

-- CreateIndex
CREATE INDEX "risco_oportunidade_empresa_id_proxima_reavaliacao_em_idx" ON "risco_oportunidade"("empresa_id", "proxima_reavaliacao_em");

-- CreateIndex
CREATE UNIQUE INDEX "risco_oportunidade_empresa_id_id_key" ON "risco_oportunidade"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "risco_oportunidade_empresa_id_numero_key" ON "risco_oportunidade"("empresa_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "risco_oportunidade_empresa_id_plano_acao_id_key" ON "risco_oportunidade"("empresa_id", "plano_acao_id");

-- CreateIndex
CREATE INDEX "historico_risco_oportunidade_empresa_id_risco_id_criado_em_idx" ON "historico_risco_oportunidade"("empresa_id", "risco_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "historico_risco_oportunidade_empresa_id_id_key" ON "historico_risco_oportunidade"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ciclo_swot_empresa_id_id_key" ON "ciclo_swot"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ciclo_swot_empresa_id_ano_key" ON "ciclo_swot"("empresa_id", "ano");

-- CreateIndex
CREATE INDEX "item_swot_empresa_id_ciclo_id_quadrante_idx" ON "item_swot"("empresa_id", "ciclo_id", "quadrante");

-- CreateIndex
CREATE UNIQUE INDEX "item_swot_empresa_id_id_key" ON "item_swot"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "parte_interessada_empresa_id_ciclo_id_idx" ON "parte_interessada"("empresa_id", "ciclo_id");

-- CreateIndex
CREATE UNIQUE INDEX "parte_interessada_empresa_id_id_key" ON "parte_interessada"("empresa_id", "id");

-- AddForeignKey
ALTER TABLE "risco_oportunidade" ADD CONSTRAINT "risco_oportunidade_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risco_oportunidade" ADD CONSTRAINT "risco_oportunidade_empresa_id_processo_id_fkey" FOREIGN KEY ("empresa_id", "processo_id") REFERENCES "processo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risco_oportunidade" ADD CONSTRAINT "risco_oportunidade_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risco_oportunidade" ADD CONSTRAINT "risco_oportunidade_empresa_id_responsavel_id_fkey" FOREIGN KEY ("empresa_id", "responsavel_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risco_oportunidade" ADD CONSTRAINT "risco_oportunidade_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risco_oportunidade" ADD CONSTRAINT "risco_oportunidade_empresa_id_plano_acao_id_fkey" FOREIGN KEY ("empresa_id", "plano_acao_id") REFERENCES "plano_acao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_risco_oportunidade" ADD CONSTRAINT "historico_risco_oportunidade_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_risco_oportunidade" ADD CONSTRAINT "historico_risco_oportunidade_empresa_id_risco_id_fkey" FOREIGN KEY ("empresa_id", "risco_id") REFERENCES "risco_oportunidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_risco_oportunidade" ADD CONSTRAINT "historico_risco_oportunidade_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ciclo_swot" ADD CONSTRAINT "ciclo_swot_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ciclo_swot" ADD CONSTRAINT "ciclo_swot_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_swot" ADD CONSTRAINT "item_swot_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_swot" ADD CONSTRAINT "item_swot_empresa_id_ciclo_id_fkey" FOREIGN KEY ("empresa_id", "ciclo_id") REFERENCES "ciclo_swot"("empresa_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_swot" ADD CONSTRAINT "item_swot_empresa_id_risco_oportunidade_id_fkey" FOREIGN KEY ("empresa_id", "risco_oportunidade_id") REFERENCES "risco_oportunidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parte_interessada" ADD CONSTRAINT "parte_interessada_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parte_interessada" ADD CONSTRAINT "parte_interessada_empresa_id_ciclo_id_fkey" FOREIGN KEY ("empresa_id", "ciclo_id") REFERENCES "ciclo_swot"("empresa_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Regras extras (não expressas no schema Prisma)
ALTER TABLE "risco_oportunidade" ADD CONSTRAINT "risco_oportunidade_pi_positivos" CHECK ("probabilidade" > 0 AND "impacto" > 0 AND "score" > 0);
ALTER TABLE "risco_oportunidade" ADD CONSTRAINT "risco_oportunidade_residual_completo" CHECK (
  ("probabilidade_residual" IS NULL AND "impacto_residual" IS NULL AND "score_residual" IS NULL AND "faixa_residual" IS NULL)
  OR ("probabilidade_residual" IS NOT NULL AND "impacto_residual" IS NOT NULL AND "score_residual" IS NOT NULL AND "faixa_residual" IS NOT NULL));
ALTER TABLE "risco_oportunidade" ADD CONSTRAINT "risco_oportunidade_periodicidade" CHECK ("periodicidade_meses" BETWEEN 1 AND 60);
ALTER TABLE "risco_oportunidade" ADD CONSTRAINT "risco_oportunidade_descricao_nao_vazia" CHECK (length(btrim("descricao")) > 0);
ALTER TABLE "item_swot" ADD CONSTRAINT "item_swot_relevancia" CHECK ("relevancia" BETWEEN 1 AND 5);
ALTER TABLE "parte_interessada" ADD CONSTRAINT "parte_interessada_escalas" CHECK ("influencia" BETWEEN 1 AND 5 AND "interesse" BETWEEN 1 AND 5);
ALTER TABLE "ciclo_swot" ADD CONSTRAINT "ciclo_swot_ano" CHECK ("ano" BETWEEN 2000 AND 2100);

-- HistoricoRiscoOportunidade é append-only.
CREATE OR REPLACE FUNCTION historico_risco_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'historico_risco_oportunidade é imutável: % não permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER historico_risco_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON historico_risco_oportunidade
  FOR EACH ROW EXECUTE FUNCTION historico_risco_imutavel();
