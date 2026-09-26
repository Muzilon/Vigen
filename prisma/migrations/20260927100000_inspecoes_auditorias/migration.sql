-- CreateEnum
CREATE TYPE "TipoChecklist" AS ENUM ('QUALIDADE', 'SSO', 'MEIO_AMBIENTE', 'GERAL');

-- CreateEnum
CREATE TYPE "TipoRespostaChecklist" AS ENUM ('CONFORME_NAO_CONFORME_NA', 'SIM_NAO', 'NOTA_1A5', 'TEXTO');

-- CreateEnum
CREATE TYPE "ValorRespostaInspecao" AS ENUM ('CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL', 'SIM', 'NAO');

-- CreateEnum
CREATE TYPE "StatusInspecao" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoAuditoria" AS ENUM ('INTERNA', 'EXTERNA_CERTIFICACAO');

-- CreateEnum
CREATE TYPE "StatusAuditoria" AS ENUM ('PLANEJADA', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoConstatacao" AS ENUM ('NAO_CONFORMIDADE', 'OBSERVACAO', 'OPORTUNIDADE_MELHORIA', 'PONTO_FORTE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permissao" ADD VALUE 'INSPECAO_GERENCIAR';
ALTER TYPE "Permissao" ADD VALUE 'INSPECAO_REALIZAR';
ALTER TYPE "Permissao" ADD VALUE 'AUDITORIA_GERENCIAR';
ALTER TYPE "Permissao" ADD VALUE 'AUDITORIA_REALIZAR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'RESPOSTA_INSPECAO';
ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'CONSTATACAO_AUDITORIA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'INSPECAO';
ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'AUDITORIA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'INSPECAO';
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'AUDITORIA';

-- AlterEnum
ALTER TYPE "TipoNotificacao" ADD VALUE 'AUDITORIA_ATRIBUIDA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoSequencia" ADD VALUE 'INSPECAO';
ALTER TYPE "TipoSequencia" ADD VALUE 'AUDITORIA';

-- CreateTable
CREATE TABLE "modelo_checklist" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoChecklist" NOT NULL DEFAULT 'GERAL',
    "nota_minima" INTEGER NOT NULL DEFAULT 3,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelo_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_modelo_checklist" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "modelo_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "pergunta" TEXT NOT NULL,
    "tipo_resposta" "TipoRespostaChecklist" NOT NULL,
    "obrigatorio_foto" BOOLEAN NOT NULL DEFAULT false,
    "ajuda" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_modelo_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspecao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "modelo_id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "setor_id" UUID,
    "processo_id" UUID,
    "inspetor_id" UUID NOT NULL,
    "data_inspecao" DATE NOT NULL,
    "status" "StatusInspecao" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "observacoes" TEXT,
    "percentual_conformidade" INTEGER,
    "concluida_em" TIMESTAMP(3),
    "plano_acao_id" UUID,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resposta_inspecao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "inspecao_id" UUID NOT NULL,
    "item_modelo_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "pergunta" TEXT NOT NULL,
    "tipo_resposta" "TipoRespostaChecklist" NOT NULL,
    "obrigatorio_foto" BOOLEAN NOT NULL DEFAULT false,
    "ajuda" TEXT,
    "resposta" "ValorRespostaInspecao",
    "nota" INTEGER,
    "texto" TEXT,
    "comentario" TEXT,
    "respondido_em" TIMESTAMP(3),
    "gerada_rnc_id" UUID,
    "gerado_item_acao_id" UUID,

    CONSTRAINT "resposta_inspecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programa_auditoria" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "objetivo" TEXT NOT NULL,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programa_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "programa_id" UUID,
    "tipo" "TipoAuditoria" NOT NULL DEFAULT 'INTERNA',
    "norma" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "processo_id" UUID,
    "obra_id" UUID,
    "auditor_lider_id" UUID NOT NULL,
    "equipe" TEXT,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "status" "StatusAuditoria" NOT NULL DEFAULT 'PLANEJADA',
    "conclusao" TEXT,
    "concluida_em" TIMESTAMP(3),
    "versao" INTEGER NOT NULL DEFAULT 0,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_auditoria" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "auditoria_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "requisito" TEXT NOT NULL,
    "pergunta" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constatacao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "auditoria_id" UUID NOT NULL,
    "item_auditoria_id" UUID,
    "tipo" "TipoConstatacao" NOT NULL,
    "descricao" TEXT NOT NULL,
    "evidencia" TEXT,
    "gerada_rnc_id" UUID,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "constatacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modelo_checklist_empresa_id_id_key" ON "modelo_checklist"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "modelo_checklist_empresa_id_nome_key" ON "modelo_checklist"("empresa_id", "nome");

-- CreateIndex
CREATE INDEX "item_modelo_checklist_empresa_id_modelo_id_ordem_idx" ON "item_modelo_checklist"("empresa_id", "modelo_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "item_modelo_checklist_empresa_id_id_key" ON "item_modelo_checklist"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "inspecao_empresa_id_obra_id_status_idx" ON "inspecao"("empresa_id", "obra_id", "status");

-- CreateIndex
CREATE INDEX "inspecao_empresa_id_modelo_id_idx" ON "inspecao"("empresa_id", "modelo_id");

-- CreateIndex
CREATE INDEX "inspecao_empresa_id_data_inspecao_idx" ON "inspecao"("empresa_id", "data_inspecao");

-- CreateIndex
CREATE UNIQUE INDEX "inspecao_empresa_id_id_key" ON "inspecao"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inspecao_empresa_id_ano_sequencia_key" ON "inspecao"("empresa_id", "ano", "sequencia");

-- CreateIndex
CREATE UNIQUE INDEX "inspecao_empresa_id_codigo_key" ON "inspecao"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "inspecao_empresa_id_plano_acao_id_key" ON "inspecao"("empresa_id", "plano_acao_id");

-- CreateIndex
CREATE INDEX "resposta_inspecao_empresa_id_inspecao_id_ordem_idx" ON "resposta_inspecao"("empresa_id", "inspecao_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "resposta_inspecao_empresa_id_id_key" ON "resposta_inspecao"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "resposta_inspecao_empresa_id_inspecao_id_item_modelo_id_key" ON "resposta_inspecao"("empresa_id", "inspecao_id", "item_modelo_id");

-- CreateIndex
CREATE UNIQUE INDEX "resposta_inspecao_empresa_id_gerada_rnc_id_key" ON "resposta_inspecao"("empresa_id", "gerada_rnc_id");

-- CreateIndex
CREATE UNIQUE INDEX "resposta_inspecao_empresa_id_gerado_item_acao_id_key" ON "resposta_inspecao"("empresa_id", "gerado_item_acao_id");

-- CreateIndex
CREATE UNIQUE INDEX "programa_auditoria_empresa_id_id_key" ON "programa_auditoria"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "programa_auditoria_empresa_id_ano_key" ON "programa_auditoria"("empresa_id", "ano");

-- CreateIndex
CREATE INDEX "auditoria_empresa_id_status_idx" ON "auditoria"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "auditoria_empresa_id_programa_id_idx" ON "auditoria"("empresa_id", "programa_id");

-- CreateIndex
CREATE UNIQUE INDEX "auditoria_empresa_id_id_key" ON "auditoria"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "auditoria_empresa_id_ano_sequencia_key" ON "auditoria"("empresa_id", "ano", "sequencia");

-- CreateIndex
CREATE UNIQUE INDEX "auditoria_empresa_id_codigo_key" ON "auditoria"("empresa_id", "codigo");

-- CreateIndex
CREATE INDEX "item_auditoria_empresa_id_auditoria_id_ordem_idx" ON "item_auditoria"("empresa_id", "auditoria_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "item_auditoria_empresa_id_id_key" ON "item_auditoria"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "constatacao_empresa_id_auditoria_id_tipo_idx" ON "constatacao"("empresa_id", "auditoria_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "constatacao_empresa_id_id_key" ON "constatacao"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "constatacao_empresa_id_gerada_rnc_id_key" ON "constatacao"("empresa_id", "gerada_rnc_id");

-- AddForeignKey
ALTER TABLE "modelo_checklist" ADD CONSTRAINT "modelo_checklist_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelo_checklist" ADD CONSTRAINT "modelo_checklist_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_modelo_checklist" ADD CONSTRAINT "item_modelo_checklist_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_modelo_checklist" ADD CONSTRAINT "item_modelo_checklist_empresa_id_modelo_id_fkey" FOREIGN KEY ("empresa_id", "modelo_id") REFERENCES "modelo_checklist"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecao" ADD CONSTRAINT "inspecao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecao" ADD CONSTRAINT "inspecao_empresa_id_modelo_id_fkey" FOREIGN KEY ("empresa_id", "modelo_id") REFERENCES "modelo_checklist"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecao" ADD CONSTRAINT "inspecao_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecao" ADD CONSTRAINT "inspecao_empresa_id_setor_id_fkey" FOREIGN KEY ("empresa_id", "setor_id") REFERENCES "setor"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecao" ADD CONSTRAINT "inspecao_empresa_id_processo_id_fkey" FOREIGN KEY ("empresa_id", "processo_id") REFERENCES "processo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecao" ADD CONSTRAINT "inspecao_empresa_id_inspetor_id_fkey" FOREIGN KEY ("empresa_id", "inspetor_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspecao" ADD CONSTRAINT "inspecao_empresa_id_plano_acao_id_fkey" FOREIGN KEY ("empresa_id", "plano_acao_id") REFERENCES "plano_acao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_inspecao" ADD CONSTRAINT "resposta_inspecao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_inspecao" ADD CONSTRAINT "resposta_inspecao_empresa_id_inspecao_id_fkey" FOREIGN KEY ("empresa_id", "inspecao_id") REFERENCES "inspecao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_inspecao" ADD CONSTRAINT "resposta_inspecao_empresa_id_item_modelo_id_fkey" FOREIGN KEY ("empresa_id", "item_modelo_id") REFERENCES "item_modelo_checklist"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_inspecao" ADD CONSTRAINT "resposta_inspecao_empresa_id_gerada_rnc_id_fkey" FOREIGN KEY ("empresa_id", "gerada_rnc_id") REFERENCES "rnc"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_inspecao" ADD CONSTRAINT "resposta_inspecao_empresa_id_gerado_item_acao_id_fkey" FOREIGN KEY ("empresa_id", "gerado_item_acao_id") REFERENCES "item_acao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programa_auditoria" ADD CONSTRAINT "programa_auditoria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programa_auditoria" ADD CONSTRAINT "programa_auditoria_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresa_id_programa_id_fkey" FOREIGN KEY ("empresa_id", "programa_id") REFERENCES "programa_auditoria"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresa_id_processo_id_fkey" FOREIGN KEY ("empresa_id", "processo_id") REFERENCES "processo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresa_id_auditor_lider_id_fkey" FOREIGN KEY ("empresa_id", "auditor_lider_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_auditoria" ADD CONSTRAINT "item_auditoria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_auditoria" ADD CONSTRAINT "item_auditoria_empresa_id_auditoria_id_fkey" FOREIGN KEY ("empresa_id", "auditoria_id") REFERENCES "auditoria"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constatacao" ADD CONSTRAINT "constatacao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constatacao" ADD CONSTRAINT "constatacao_empresa_id_auditoria_id_fkey" FOREIGN KEY ("empresa_id", "auditoria_id") REFERENCES "auditoria"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constatacao" ADD CONSTRAINT "constatacao_empresa_id_item_auditoria_id_fkey" FOREIGN KEY ("empresa_id", "item_auditoria_id") REFERENCES "item_auditoria"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constatacao" ADD CONSTRAINT "constatacao_empresa_id_gerada_rnc_id_fkey" FOREIGN KEY ("empresa_id", "gerada_rnc_id") REFERENCES "rnc"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constatacao" ADD CONSTRAINT "constatacao_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras SQL (P5)
ALTER TABLE "modelo_checklist" ADD CONSTRAINT "modelo_checklist_nome_nao_vazio" CHECK (length(btrim("nome")) > 0);
ALTER TABLE "modelo_checklist" ADD CONSTRAINT "modelo_checklist_nota_minima" CHECK ("nota_minima" BETWEEN 1 AND 5);
ALTER TABLE "item_modelo_checklist" ADD CONSTRAINT "item_modelo_checklist_pergunta_nao_vazia" CHECK (length(btrim("pergunta")) > 0);
ALTER TABLE "inspecao" ADD CONSTRAINT "inspecao_sequencia_positiva" CHECK ("sequencia" > 0);
ALTER TABLE "inspecao" ADD CONSTRAINT "inspecao_percentual" CHECK ("percentual_conformidade" IS NULL OR "percentual_conformidade" BETWEEN 0 AND 100);
ALTER TABLE "resposta_inspecao" ADD CONSTRAINT "resposta_inspecao_nota" CHECK ("nota" IS NULL OR "nota" BETWEEN 1 AND 5);
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_sequencia_positiva" CHECK ("sequencia" > 0);
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_periodo" CHECK ("data_fim" >= "data_inicio");
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_textos" CHECK (length(btrim("norma")) > 0 AND length(btrim("escopo")) > 0);
ALTER TABLE "constatacao" ADD CONSTRAINT "constatacao_descricao_nao_vazia" CHECK (length(btrim("descricao")) > 0);
ALTER TABLE "constatacao" ADD CONSTRAINT "constatacao_rnc_so_nc" CHECK ("gerada_rnc_id" IS NULL OR "tipo" = 'NAO_CONFORMIDADE');
