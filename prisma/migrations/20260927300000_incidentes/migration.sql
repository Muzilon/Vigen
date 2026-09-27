-- CreateEnum
CREATE TYPE "TipoIncidente" AS ENUM ('ACIDENTE_TIPICO', 'ACIDENTE_TRAJETO', 'QUASE_ACIDENTE', 'DOENCA_OCUPACIONAL');

-- CreateEnum
CREATE TYPE "GravidadeIncidente" AS ENUM ('SEM_AFASTAMENTO', 'COM_AFASTAMENTO', 'FATALIDADE');

-- CreateEnum
CREATE TYPE "StatusIncidente" AS ENUM ('ABERTO', 'EM_INVESTIGACAO', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "AcaoHistoricoIncidente" AS ENUM ('REGISTRO', 'ALTERACAO', 'INVESTIGACAO', 'STATUS', 'PLANO', 'RESPONSAVEL');

-- AlterEnum
ALTER TYPE "OrigemPlanoAcao" ADD VALUE 'INCIDENTE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permissao" ADD VALUE 'INCIDENTE_GERENCIAR';
ALTER TYPE "Permissao" ADD VALUE 'INCIDENTE_VER_RESTRITOS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'INCIDENTE';
ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'INCIDENTE_DADOS_SENSIVEIS';

-- AlterEnum
ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'INCIDENTE';

-- AlterEnum
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'INCIDENTE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacao" ADD VALUE 'INCIDENTE_REGISTRADO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'INCIDENTE_ATRIBUIDO';

-- AlterEnum
ALTER TYPE "TipoSequencia" ADD VALUE 'INCIDENTE';

-- CreateTable
CREATE TABLE "incidente" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoIncidente" NOT NULL,
    "gravidade" "GravidadeIncidente" NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "obra_id" UUID NOT NULL,
    "setor_id" UUID,
    "local" TEXT,
    "descricao_fatos" TEXT NOT NULL,
    "envolvido_id" UUID,
    "terceiro_nome" TEXT,
    "terceiro_funcao" TEXT,
    "testemunhas" TEXT,
    "status" "StatusIncidente" NOT NULL DEFAULT 'ABERTO',
    "responsavel_id" UUID,
    "causa_raiz" TEXT,
    "metodo_causa_raiz" "MetodoCausaRaiz",
    "analise_causa" JSONB,
    "conclusao" TEXT,
    "plano_acao_id" UUID,
    "restrita" BOOLEAN NOT NULL DEFAULT false,
    "contem_dados_pessoais" BOOLEAN NOT NULL DEFAULT false,
    "dias_perdidos" INTEGER,
    "gera_cat" BOOLEAN NOT NULL DEFAULT false,
    "numero_cat" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "registrado_por_id" UUID NOT NULL,
    "concluido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidente_dados_sensiveis" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "incidente_id" UUID NOT NULL,
    "nome_envolvido" TEXT,
    "documento_envolvido" TEXT,
    "funcao_envolvido" TEXT,
    "relato" TEXT,
    "lesao_descricao" TEXT,
    "testemunhas_relato" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidente_dados_sensiveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_incidente" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "incidente_id" UUID NOT NULL,
    "acao" "AcaoHistoricoIncidente" NOT NULL,
    "status_anterior" "StatusIncidente",
    "status_novo" "StatusIncidente" NOT NULL,
    "observacao" TEXT,
    "usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_incidente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidente_empresa_id_obra_id_status_idx" ON "incidente"("empresa_id", "obra_id", "status");

-- CreateIndex
CREATE INDEX "incidente_empresa_id_data_hora_idx" ON "incidente"("empresa_id", "data_hora");

-- CreateIndex
CREATE INDEX "incidente_empresa_id_restrita_idx" ON "incidente"("empresa_id", "restrita");

-- CreateIndex
CREATE UNIQUE INDEX "incidente_empresa_id_id_key" ON "incidente"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "incidente_empresa_id_ano_sequencia_key" ON "incidente"("empresa_id", "ano", "sequencia");

-- CreateIndex
CREATE UNIQUE INDEX "incidente_empresa_id_codigo_key" ON "incidente"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "incidente_empresa_id_plano_acao_id_key" ON "incidente"("empresa_id", "plano_acao_id");

-- CreateIndex
CREATE UNIQUE INDEX "incidente_dados_sensiveis_empresa_id_id_key" ON "incidente_dados_sensiveis"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "incidente_dados_sensiveis_empresa_id_incidente_id_key" ON "incidente_dados_sensiveis"("empresa_id", "incidente_id");

-- CreateIndex
CREATE INDEX "historico_incidente_empresa_id_incidente_id_criado_em_idx" ON "historico_incidente"("empresa_id", "incidente_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "historico_incidente_empresa_id_id_key" ON "historico_incidente"("empresa_id", "id");

-- AddForeignKey
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_empresa_id_setor_id_fkey" FOREIGN KEY ("empresa_id", "setor_id") REFERENCES "setor"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_empresa_id_envolvido_id_fkey" FOREIGN KEY ("empresa_id", "envolvido_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_empresa_id_responsavel_id_fkey" FOREIGN KEY ("empresa_id", "responsavel_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_empresa_id_registrado_por_id_fkey" FOREIGN KEY ("empresa_id", "registrado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_empresa_id_plano_acao_id_fkey" FOREIGN KEY ("empresa_id", "plano_acao_id") REFERENCES "plano_acao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidente_dados_sensiveis" ADD CONSTRAINT "incidente_dados_sensiveis_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidente_dados_sensiveis" ADD CONSTRAINT "incidente_dados_sensiveis_empresa_id_incidente_id_fkey" FOREIGN KEY ("empresa_id", "incidente_id") REFERENCES "incidente"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_incidente" ADD CONSTRAINT "historico_incidente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_incidente" ADD CONSTRAINT "historico_incidente_empresa_id_incidente_id_fkey" FOREIGN KEY ("empresa_id", "incidente_id") REFERENCES "incidente"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_incidente" ADD CONSTRAINT "historico_incidente_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras SQL (P6 — Incidentes e acidentes)
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_sequencia_positiva" CHECK ("sequencia" > 0);
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_descricao_nao_vazia" CHECK (length(btrim("descricao_fatos")) > 0);
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_dias_perdidos" CHECK ("dias_perdidos" IS NULL OR "dias_perdidos" >= 0);
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_envolvido_ou_terceiro" CHECK ("envolvido_id" IS NULL OR "terceiro_nome" IS NULL);
-- Dados pessoais sempre restringem o registro (LGPD).
ALTER TABLE "incidente" ADD CONSTRAINT "incidente_dados_pessoais_restrito" CHECK (NOT "contem_dados_pessoais" OR "restrita");

-- HistoricoIncidente é append-only.
CREATE OR REPLACE FUNCTION historico_incidente_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'historico_incidente é imutável: % não permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER historico_incidente_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON historico_incidente
  FOR EACH ROW EXECUTE FUNCTION historico_incidente_imutavel();
