-- CreateEnum
CREATE TYPE "TipoRequisitoLegal" AS ENUM ('LEI', 'NORMA', 'PORTARIA', 'RESOLUCAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "EsferaRequisito" AS ENUM ('FEDERAL', 'ESTADUAL', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "TemaRequisito" AS ENUM ('QUALIDADE', 'SSO', 'MEIO_AMBIENTE');

-- CreateEnum
CREATE TYPE "StatusRequisitoLegal" AS ENUM ('ATENDE', 'ATENDE_PARCIAL', 'NAO_ATENDE', 'NAO_APLICAVEL', 'EM_ANALISE');

-- CreateEnum
CREATE TYPE "AcaoHistoricoRequisito" AS ENUM ('CRIACAO', 'ALTERACAO', 'VERIFICACAO', 'REVISAO_GERAL', 'PLANO', 'EXCLUSAO');

-- AlterEnum
ALTER TYPE "OrigemPlanoAcao" ADD VALUE 'REQUISITO_LEGAL';

-- AlterEnum
ALTER TYPE "Permissao" ADD VALUE 'REQUISITO_LEGAL_GERENCIAR';

-- AlterEnum
ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'REQUISITO_LEGAL';

-- AlterEnum
ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'REQUISITO_LEGAL';

-- AlterEnum
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'REQUISITO_LEGAL';

-- AlterEnum
ALTER TYPE "TipoSequencia" ADD VALUE 'REQUISITO_LEGAL';

-- CreateTable
CREATE TABLE "requisito_legal" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoRequisitoLegal" NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "esfera" "EsferaRequisito" NOT NULL,
    "tema" "TemaRequisito" NOT NULL,
    "orgao_emissor" TEXT,
    "resumo" TEXT,
    "aplicabilidade" TEXT,
    "data_publicacao" DATE,
    "processo_id" UUID,
    "obra_id" UUID,
    "status" "StatusRequisitoLegal" NOT NULL DEFAULT 'EM_ANALISE',
    "responsavel_id" UUID,
    "periodicidade_meses" INTEGER NOT NULL DEFAULT 12,
    "ultima_verificacao_em" DATE,
    "proxima_verificacao_em" DATE,
    "plano_acao_id" UUID,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisito_legal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_requisito_legal" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "requisito_id" UUID NOT NULL,
    "acao" "AcaoHistoricoRequisito" NOT NULL,
    "status_anterior" "StatusRequisitoLegal",
    "status_novo" "StatusRequisitoLegal" NOT NULL,
    "data_verificacao" DATE,
    "observacao" TEXT,
    "usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_requisito_legal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requisito_legal_empresa_id_status_idx" ON "requisito_legal"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "requisito_legal_empresa_id_processo_id_idx" ON "requisito_legal"("empresa_id", "processo_id");

-- CreateIndex
CREATE INDEX "requisito_legal_empresa_id_proxima_verificacao_em_idx" ON "requisito_legal"("empresa_id", "proxima_verificacao_em");

-- CreateIndex
CREATE UNIQUE INDEX "requisito_legal_empresa_id_id_key" ON "requisito_legal"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "requisito_legal_empresa_id_ano_sequencia_key" ON "requisito_legal"("empresa_id", "ano", "sequencia");

-- CreateIndex
CREATE UNIQUE INDEX "requisito_legal_empresa_id_codigo_key" ON "requisito_legal"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "requisito_legal_empresa_id_plano_acao_id_key" ON "requisito_legal"("empresa_id", "plano_acao_id");

-- CreateIndex
CREATE INDEX "historico_requisito_legal_empresa_id_requisito_id_criado_em_idx" ON "historico_requisito_legal"("empresa_id", "requisito_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "historico_requisito_legal_empresa_id_id_key" ON "historico_requisito_legal"("empresa_id", "id");

-- AddForeignKey
ALTER TABLE "requisito_legal" ADD CONSTRAINT "requisito_legal_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisito_legal" ADD CONSTRAINT "requisito_legal_empresa_id_processo_id_fkey" FOREIGN KEY ("empresa_id", "processo_id") REFERENCES "processo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisito_legal" ADD CONSTRAINT "requisito_legal_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisito_legal" ADD CONSTRAINT "requisito_legal_empresa_id_responsavel_id_fkey" FOREIGN KEY ("empresa_id", "responsavel_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisito_legal" ADD CONSTRAINT "requisito_legal_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisito_legal" ADD CONSTRAINT "requisito_legal_empresa_id_plano_acao_id_fkey" FOREIGN KEY ("empresa_id", "plano_acao_id") REFERENCES "plano_acao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_requisito_legal" ADD CONSTRAINT "historico_requisito_legal_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_requisito_legal" ADD CONSTRAINT "historico_requisito_legal_empresa_id_requisito_id_fkey" FOREIGN KEY ("empresa_id", "requisito_id") REFERENCES "requisito_legal"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_requisito_legal" ADD CONSTRAINT "historico_requisito_legal_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras SQL (P6 — Requisitos legais)
ALTER TABLE "requisito_legal" ADD CONSTRAINT "requisito_legal_sequencia_positiva" CHECK ("sequencia" > 0);
ALTER TABLE "requisito_legal" ADD CONSTRAINT "requisito_legal_textos" CHECK (length(btrim("numero")) > 0 AND length(btrim("titulo")) > 0);
ALTER TABLE "requisito_legal" ADD CONSTRAINT "requisito_legal_periodicidade" CHECK ("periodicidade_meses" BETWEEN 1 AND 60);

-- HistoricoRequisitoLegal é append-only (evidência de atendimento ao longo do tempo).
CREATE OR REPLACE FUNCTION historico_requisito_legal_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'historico_requisito_legal é imutável: % não permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER historico_requisito_legal_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON historico_requisito_legal
  FOR EACH ROW EXECUTE FUNCTION historico_requisito_legal_imutavel();
