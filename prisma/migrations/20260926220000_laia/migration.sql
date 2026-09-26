-- CreateEnum
CREATE TYPE "Temporalidade" AS ENUM ('PASSADA', 'ATUAL', 'FUTURA');

-- CreateEnum
CREATE TYPE "Incidencia" AS ENUM ('DIRETA', 'INDIRETA');

-- AlterEnum
ALTER TYPE "OrigemPlanoAcao" ADD VALUE 'LAIA';

-- AlterEnum
ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'LAIA';

-- AlterEnum
ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'LAIA';

-- AlterEnum
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'LAIA';

-- CreateTable
CREATE TABLE "linha_laia" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "obra_id" UUID NOT NULL,
    "processo_id" UUID,
    "atividade" TEXT NOT NULL,
    "aspecto" TEXT NOT NULL,
    "impacto" TEXT NOT NULL,
    "situacao" "CondicaoOperacional" NOT NULL DEFAULT 'NORMAL',
    "temporalidade" "Temporalidade" NOT NULL DEFAULT 'ATUAL',
    "incidencia" "Incidencia" NOT NULL DEFAULT 'DIRETA',
    "severidade" INTEGER NOT NULL,
    "frequencia" INTEGER NOT NULL,
    "abrangencia" INTEGER NOT NULL,
    "requisito_legal" BOOLEAN NOT NULL DEFAULT false,
    "partes_interessadas" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL,
    "faixa" "FaixaNivel" NOT NULL,
    "significativo" BOOLEAN NOT NULL,
    "controles" TEXT,
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

    CONSTRAINT "linha_laia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_linha_laia" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "linha_id" UUID NOT NULL,
    "acao" "AcaoHistoricoSgi" NOT NULL,
    "versao" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "observacao" TEXT,
    "usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_linha_laia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linha_laia_empresa_id_obra_id_status_idx" ON "linha_laia"("empresa_id", "obra_id", "status");

-- CreateIndex
CREATE INDEX "linha_laia_empresa_id_processo_id_idx" ON "linha_laia"("empresa_id", "processo_id");

-- CreateIndex
CREATE INDEX "linha_laia_empresa_id_proxima_reavaliacao_em_idx" ON "linha_laia"("empresa_id", "proxima_reavaliacao_em");

-- CreateIndex
CREATE UNIQUE INDEX "linha_laia_empresa_id_id_key" ON "linha_laia"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "linha_laia_empresa_id_numero_key" ON "linha_laia"("empresa_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "linha_laia_empresa_id_plano_acao_id_key" ON "linha_laia"("empresa_id", "plano_acao_id");

-- CreateIndex
CREATE INDEX "historico_linha_laia_empresa_id_linha_id_criado_em_idx" ON "historico_linha_laia"("empresa_id", "linha_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "historico_linha_laia_empresa_id_id_key" ON "historico_linha_laia"("empresa_id", "id");

-- AddForeignKey
ALTER TABLE "linha_laia" ADD CONSTRAINT "linha_laia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_laia" ADD CONSTRAINT "linha_laia_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_laia" ADD CONSTRAINT "linha_laia_empresa_id_processo_id_fkey" FOREIGN KEY ("empresa_id", "processo_id") REFERENCES "processo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_laia" ADD CONSTRAINT "linha_laia_empresa_id_responsavel_id_fkey" FOREIGN KEY ("empresa_id", "responsavel_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_laia" ADD CONSTRAINT "linha_laia_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_laia" ADD CONSTRAINT "linha_laia_empresa_id_plano_acao_id_fkey" FOREIGN KEY ("empresa_id", "plano_acao_id") REFERENCES "plano_acao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_linha_laia" ADD CONSTRAINT "historico_linha_laia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_linha_laia" ADD CONSTRAINT "historico_linha_laia_empresa_id_linha_id_fkey" FOREIGN KEY ("empresa_id", "linha_id") REFERENCES "linha_laia"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_linha_laia" ADD CONSTRAINT "historico_linha_laia_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras extras (não expressas no schema Prisma)
ALTER TABLE "linha_laia" ADD CONSTRAINT "linha_laia_valores_positivos" CHECK ("severidade" > 0 AND "frequencia" > 0 AND "abrangencia" > 0 AND "score" > 0);
ALTER TABLE "linha_laia" ADD CONSTRAINT "linha_laia_periodicidade" CHECK ("periodicidade_meses" BETWEEN 1 AND 60);
ALTER TABLE "linha_laia" ADD CONSTRAINT "linha_laia_textos_nao_vazios" CHECK (length(btrim("atividade")) > 0 AND length(btrim("aspecto")) > 0 AND length(btrim("impacto")) > 0);

-- HistoricoLinhaLaia é append-only.
CREATE OR REPLACE FUNCTION historico_linha_laia_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'historico_linha_laia é imutável: % não permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER historico_linha_laia_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON historico_linha_laia
  FOR EACH ROW EXECUTE FUNCTION historico_linha_laia_imutavel();
