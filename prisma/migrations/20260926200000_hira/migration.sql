-- CreateEnum
CREATE TYPE "CondicaoOperacional" AS ENUM ('NORMAL', 'ANORMAL', 'EMERGENCIA');

-- CreateEnum
CREATE TYPE "HierarquiaControle" AS ENUM ('ELIMINACAO', 'SUBSTITUICAO', 'ENGENHARIA', 'ADMINISTRATIVO', 'EPI');

-- CreateEnum
CREATE TYPE "StatusLinhaSgi" AS ENUM ('PENDENTE_APROVACAO', 'VIGENTE', 'REJEITADA', 'INATIVA');

-- CreateEnum
CREATE TYPE "AcaoHistoricoSgi" AS ENUM ('INCLUSAO', 'ALTERACAO', 'EXCLUSAO', 'REAVALIACAO', 'REVISAO_GERAL', 'PLANO', 'APROVACAO', 'REJEICAO');

-- AlterEnum
ALTER TYPE "OrigemPlanoAcao" ADD VALUE 'HIRA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permissao" ADD VALUE 'HIRA_GERENCIAR';
ALTER TYPE "Permissao" ADD VALUE 'LAIA_GERENCIAR';

-- AlterEnum
ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'HIRA';

-- AlterEnum
ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'HIRA';

-- AlterEnum
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'HIRA';

-- CreateTable
CREATE TABLE "linha_hira" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "obra_id" UUID NOT NULL,
    "setor" TEXT NOT NULL,
    "processo_id" UUID,
    "atividade" TEXT NOT NULL,
    "rotineira" BOOLEAN NOT NULL DEFAULT true,
    "perigo" TEXT NOT NULL,
    "risco" TEXT NOT NULL,
    "condicao" "CondicaoOperacional" NOT NULL DEFAULT 'NORMAL',
    "controles_existentes" TEXT,
    "hierarquia_controle" "HierarquiaControle",
    "controles_propostos" TEXT,
    "probabilidade" INTEGER NOT NULL,
    "severidade" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "faixa" "FaixaNivel" NOT NULL,
    "probabilidade_residual" INTEGER,
    "severidade_residual" INTEGER,
    "score_residual" INTEGER,
    "faixa_residual" "FaixaNivel",
    "requisito_legal" TEXT,
    "responsavel_id" UUID,
    "plano_acao_id" UUID,
    "modo_reavaliacao" "ModoReavaliacao" NOT NULL DEFAULT 'ITEM',
    "periodicidade_meses" INTEGER NOT NULL DEFAULT 12,
    "proxima_reavaliacao_em" DATE,
    "ultima_reavaliacao_em" TIMESTAMP(3),
    "status" "StatusLinhaSgi" NOT NULL DEFAULT 'VIGENTE',
    "versao" INTEGER NOT NULL DEFAULT 0,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linha_hira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_linha_hira" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "linha_id" UUID NOT NULL,
    "acao" "AcaoHistoricoSgi" NOT NULL,
    "versao" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "observacao" TEXT,
    "usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_linha_hira_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linha_hira_empresa_id_obra_id_status_idx" ON "linha_hira"("empresa_id", "obra_id", "status");

-- CreateIndex
CREATE INDEX "linha_hira_empresa_id_processo_id_idx" ON "linha_hira"("empresa_id", "processo_id");

-- CreateIndex
CREATE INDEX "linha_hira_empresa_id_proxima_reavaliacao_em_idx" ON "linha_hira"("empresa_id", "proxima_reavaliacao_em");

-- CreateIndex
CREATE UNIQUE INDEX "linha_hira_empresa_id_id_key" ON "linha_hira"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "linha_hira_empresa_id_numero_key" ON "linha_hira"("empresa_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "linha_hira_empresa_id_plano_acao_id_key" ON "linha_hira"("empresa_id", "plano_acao_id");

-- CreateIndex
CREATE INDEX "historico_linha_hira_empresa_id_linha_id_criado_em_idx" ON "historico_linha_hira"("empresa_id", "linha_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "historico_linha_hira_empresa_id_id_key" ON "historico_linha_hira"("empresa_id", "id");

-- AddForeignKey
ALTER TABLE "linha_hira" ADD CONSTRAINT "linha_hira_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_hira" ADD CONSTRAINT "linha_hira_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_hira" ADD CONSTRAINT "linha_hira_empresa_id_processo_id_fkey" FOREIGN KEY ("empresa_id", "processo_id") REFERENCES "processo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_hira" ADD CONSTRAINT "linha_hira_empresa_id_responsavel_id_fkey" FOREIGN KEY ("empresa_id", "responsavel_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_hira" ADD CONSTRAINT "linha_hira_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_hira" ADD CONSTRAINT "linha_hira_empresa_id_plano_acao_id_fkey" FOREIGN KEY ("empresa_id", "plano_acao_id") REFERENCES "plano_acao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_linha_hira" ADD CONSTRAINT "historico_linha_hira_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_linha_hira" ADD CONSTRAINT "historico_linha_hira_empresa_id_linha_id_fkey" FOREIGN KEY ("empresa_id", "linha_id") REFERENCES "linha_hira"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_linha_hira" ADD CONSTRAINT "historico_linha_hira_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras extras (não expressas no schema Prisma)
ALTER TABLE "linha_hira" ADD CONSTRAINT "linha_hira_ps_positivos" CHECK ("probabilidade" > 0 AND "severidade" > 0 AND "score" > 0);
ALTER TABLE "linha_hira" ADD CONSTRAINT "linha_hira_residual_completo" CHECK (
  ("probabilidade_residual" IS NULL AND "severidade_residual" IS NULL AND "score_residual" IS NULL AND "faixa_residual" IS NULL)
  OR ("probabilidade_residual" IS NOT NULL AND "severidade_residual" IS NOT NULL AND "score_residual" IS NOT NULL AND "faixa_residual" IS NOT NULL));
ALTER TABLE "linha_hira" ADD CONSTRAINT "linha_hira_periodicidade" CHECK ("periodicidade_meses" BETWEEN 1 AND 60);
ALTER TABLE "linha_hira" ADD CONSTRAINT "linha_hira_textos_nao_vazios" CHECK (length(btrim("atividade")) > 0 AND length(btrim("perigo")) > 0 AND length(btrim("risco")) > 0 AND length(btrim("setor")) > 0);

-- HistoricoLinhaHira é append-only.
CREATE OR REPLACE FUNCTION historico_linha_hira_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'historico_linha_hira é imutável: % não permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER historico_linha_hira_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON historico_linha_hira
  FOR EACH ROW EXECUTE FUNCTION historico_linha_hira_imutavel();
