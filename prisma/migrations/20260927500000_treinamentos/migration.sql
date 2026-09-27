-- CreateEnum
CREATE TYPE "TipoTreinamento" AS ENUM ('INTEGRACAO', 'NR', 'RECICLAGEM', 'TECNICO', 'OUTRO');

-- AlterEnum
ALTER TYPE "Permissao" ADD VALUE 'TREINAMENTO_GERENCIAR';

-- AlterEnum
ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'CERTIFICADO_TREINAMENTO';

-- AlterEnum
ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'TREINAMENTO';

-- AlterEnum
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'TREINAMENTO';

-- AlterEnum
ALTER TYPE "TipoNotificacao" ADD VALUE 'TREINAMENTO_VENCENDO';

-- CreateTable
CREATE TABLE "treinamento" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoTreinamento" NOT NULL,
    "descricao" TEXT,
    "carga_horaria" INTEGER,
    "validade_meses" INTEGER,
    "obrigatorio_todos" BOOLEAN NOT NULL DEFAULT false,
    "obrigatorio_setor_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao_treinamento" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "treinamento_id" UUID NOT NULL,
    "data_realizacao" DATE NOT NULL,
    "instrutor" TEXT NOT NULL,
    "obra_id" UUID,
    "carga_horaria" INTEGER,
    "observacao" TEXT,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessao_treinamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participacao_treinamento" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT true,
    "aproveitamento" TEXT,
    "certificado_anexo_id" UUID,
    "data_validade" DATE,
    "registrado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participacao_treinamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "treinamento_empresa_id_id_key" ON "treinamento"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "treinamento_empresa_id_nome_key" ON "treinamento"("empresa_id", "nome");

-- CreateIndex
CREATE INDEX "sessao_treinamento_empresa_id_treinamento_id_data_realizaca_idx" ON "sessao_treinamento"("empresa_id", "treinamento_id", "data_realizacao");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_treinamento_empresa_id_id_key" ON "sessao_treinamento"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "participacao_treinamento_empresa_id_usuario_id_idx" ON "participacao_treinamento"("empresa_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "participacao_treinamento_empresa_id_id_key" ON "participacao_treinamento"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "participacao_treinamento_empresa_id_sessao_id_usuario_id_key" ON "participacao_treinamento"("empresa_id", "sessao_id", "usuario_id");

-- AddForeignKey
ALTER TABLE "treinamento" ADD CONSTRAINT "treinamento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento" ADD CONSTRAINT "treinamento_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao_treinamento" ADD CONSTRAINT "sessao_treinamento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao_treinamento" ADD CONSTRAINT "sessao_treinamento_empresa_id_treinamento_id_fkey" FOREIGN KEY ("empresa_id", "treinamento_id") REFERENCES "treinamento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao_treinamento" ADD CONSTRAINT "sessao_treinamento_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao_treinamento" ADD CONSTRAINT "sessao_treinamento_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacao_treinamento" ADD CONSTRAINT "participacao_treinamento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacao_treinamento" ADD CONSTRAINT "participacao_treinamento_empresa_id_sessao_id_fkey" FOREIGN KEY ("empresa_id", "sessao_id") REFERENCES "sessao_treinamento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacao_treinamento" ADD CONSTRAINT "participacao_treinamento_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacao_treinamento" ADD CONSTRAINT "participacao_treinamento_empresa_id_registrado_por_id_fkey" FOREIGN KEY ("empresa_id", "registrado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacao_treinamento" ADD CONSTRAINT "participacao_treinamento_empresa_id_certificado_anexo_id_fkey" FOREIGN KEY ("empresa_id", "certificado_anexo_id") REFERENCES "anexo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Regras SQL (P7 — Treinamentos)
ALTER TABLE "treinamento" ADD CONSTRAINT "treinamento_nome" CHECK (length(btrim("nome")) > 0);
ALTER TABLE "treinamento" ADD CONSTRAINT "treinamento_carga_horaria" CHECK ("carga_horaria" IS NULL OR "carga_horaria" > 0);
ALTER TABLE "treinamento" ADD CONSTRAINT "treinamento_validade" CHECK ("validade_meses" IS NULL OR "validade_meses" BETWEEN 1 AND 120);
ALTER TABLE "sessao_treinamento" ADD CONSTRAINT "sessao_treinamento_instrutor" CHECK (length(btrim("instrutor")) > 0);
ALTER TABLE "sessao_treinamento" ADD CONSTRAINT "sessao_treinamento_carga_horaria" CHECK ("carga_horaria" IS NULL OR "carga_horaria" > 0);
-- Ausente não tem validade.
ALTER TABLE "participacao_treinamento" ADD CONSTRAINT "participacao_ausente_sem_validade" CHECK ("presente" OR "data_validade" IS NULL);
