-- CreateEnum
CREATE TYPE "TipoEntidadeAprovacao" AS ENUM ('PROCESSO', 'HIRA', 'LAIA', 'DOCUMENTO', 'RISCO_OPORTUNIDADE', 'TESTE');

-- CreateEnum
CREATE TYPE "TipoAlteracaoAprovacao" AS ENUM ('INCLUSAO', 'ALTERACAO', 'EXCLUSAO', 'PUBLICACAO');

-- CreateEnum
CREATE TYPE "ModoAprovacao" AS ENUM ('SEQUENCIAL', 'PARALELO');

-- CreateEnum
CREATE TYPE "StatusFluxoAprovacao" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusEtapaAprovacao" AS ENUM ('AGUARDANDO', 'PENDENTE', 'APROVADA', 'REJEITADA', 'IGNORADA');

-- CreateEnum
CREATE TYPE "AcaoHistoricoAprovacao" AS ENUM ('SOLICITADO', 'APROVADO', 'REJEITADO', 'CANCELADO', 'CONCLUIDO');

-- AlterEnum
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'FLUXO_APROVACAO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacao" ADD VALUE 'APROVACAO_PENDENTE';
ALTER TYPE "TipoNotificacao" ADD VALUE 'APROVACAO_DECIDIDA';
ALTER TYPE "TipoNotificacao" ADD VALUE 'REAVALIACAO_PROXIMA';

-- CreateTable
CREATE TABLE "fluxo_aprovacao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "entidade_tipo" "TipoEntidadeAprovacao" NOT NULL,
    "entidade_id" UUID NOT NULL,
    "tipo_alteracao" "TipoAlteracaoAprovacao" NOT NULL,
    "modo" "ModoAprovacao" NOT NULL,
    "status" "StatusFluxoAprovacao" NOT NULL DEFAULT 'PENDENTE',
    "solicitante_id" UUID NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "resumo" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMP(3),

    CONSTRAINT "fluxo_aprovacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapa_aprovacao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "fluxo_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "aprovador_id" UUID NOT NULL,
    "status" "StatusEtapaAprovacao" NOT NULL,
    "decidido_em" TIMESTAMP(3),
    "comentario" TEXT,

    CONSTRAINT "etapa_aprovacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_aprovacao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "fluxo_id" UUID NOT NULL,
    "etapa_id" UUID,
    "usuario_id" UUID NOT NULL,
    "acao" "AcaoHistoricoAprovacao" NOT NULL,
    "comentario" TEXT,
    "metadados" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_aprovacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fluxo_aprovacao_empresa_id_entidade_tipo_entidade_id_idx" ON "fluxo_aprovacao"("empresa_id", "entidade_tipo", "entidade_id");

-- CreateIndex
CREATE INDEX "fluxo_aprovacao_empresa_id_solicitante_id_status_idx" ON "fluxo_aprovacao"("empresa_id", "solicitante_id", "status");

-- CreateIndex
CREATE INDEX "fluxo_aprovacao_empresa_id_status_idx" ON "fluxo_aprovacao"("empresa_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fluxo_aprovacao_empresa_id_id_key" ON "fluxo_aprovacao"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "etapa_aprovacao_empresa_id_aprovador_id_status_idx" ON "etapa_aprovacao"("empresa_id", "aprovador_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "etapa_aprovacao_empresa_id_id_key" ON "etapa_aprovacao"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "etapa_aprovacao_empresa_id_fluxo_id_ordem_key" ON "etapa_aprovacao"("empresa_id", "fluxo_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "etapa_aprovacao_empresa_id_fluxo_id_aprovador_id_key" ON "etapa_aprovacao"("empresa_id", "fluxo_id", "aprovador_id");

-- CreateIndex
CREATE INDEX "historico_aprovacao_empresa_id_fluxo_id_criado_em_idx" ON "historico_aprovacao"("empresa_id", "fluxo_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "historico_aprovacao_empresa_id_id_key" ON "historico_aprovacao"("empresa_id", "id");

-- AddForeignKey
ALTER TABLE "fluxo_aprovacao" ADD CONSTRAINT "fluxo_aprovacao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fluxo_aprovacao" ADD CONSTRAINT "fluxo_aprovacao_empresa_id_solicitante_id_fkey" FOREIGN KEY ("empresa_id", "solicitante_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapa_aprovacao" ADD CONSTRAINT "etapa_aprovacao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapa_aprovacao" ADD CONSTRAINT "etapa_aprovacao_empresa_id_fluxo_id_fkey" FOREIGN KEY ("empresa_id", "fluxo_id") REFERENCES "fluxo_aprovacao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapa_aprovacao" ADD CONSTRAINT "etapa_aprovacao_empresa_id_aprovador_id_fkey" FOREIGN KEY ("empresa_id", "aprovador_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_aprovacao" ADD CONSTRAINT "historico_aprovacao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_aprovacao" ADD CONSTRAINT "historico_aprovacao_empresa_id_fluxo_id_fkey" FOREIGN KEY ("empresa_id", "fluxo_id") REFERENCES "fluxo_aprovacao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_aprovacao" ADD CONSTRAINT "historico_aprovacao_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- No máximo um fluxo PENDENTE por entidade (empresa + tipo + id).
CREATE UNIQUE INDEX "fluxo_aprovacao_um_pendente"
  ON "fluxo_aprovacao" ("empresa_id", "entidade_tipo", "entidade_id")
  WHERE "status" = 'PENDENTE';

-- historico_aprovacao é append-only
CREATE OR REPLACE FUNCTION historico_aprovacao_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'historico_aprovacao é imutável: % não permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER historico_aprovacao_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON historico_aprovacao
  FOR EACH ROW EXECUTE FUNCTION historico_aprovacao_imutavel();
