-- CreateEnum
CREATE TYPE "StatusDocumento" AS ENUM ('ELABORACAO', 'EM_REVISAO', 'EM_APROVACAO', 'APROVADO', 'PUBLICADO', 'OBSOLETO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusVersaoDocumento" AS ENUM ('RASCUNHO', 'EM_APROVACAO', 'APROVADA', 'PUBLICADA', 'OBSOLETA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "AcaoHistoricoDocumento" AS ENUM ('CRIACAO', 'ALTERACAO_DADOS', 'NOVA_REVISAO', 'ARQUIVO_SUBSTITUIDO', 'ENVIO_APROVACAO', 'REVISADO', 'APROVACAO', 'REJEICAO', 'CANCELAMENTO_APROVACAO', 'PUBLICACAO', 'OBSOLESCENCIA', 'CANCELAMENTO', 'REVISAO_PLANILHA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permissao" ADD VALUE 'DOCUMENTO_ELABORAR';
ALTER TYPE "Permissao" ADD VALUE 'DOCUMENTO_GERENCIAR';

-- AlterEnum
ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'DOCUMENTO_VERSAO';

-- AlterEnum
ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'DOCUMENTO';

-- AlterEnum
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'DOCUMENTO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacao" ADD VALUE 'DOCUMENTO_PUBLICADO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'CIENCIA_PENDENTE';
ALTER TYPE "TipoNotificacao" ADD VALUE 'REVISAO_DOCUMENTO_PROXIMA';

-- AlterEnum
ALTER TYPE "TipoSequencia" ADD VALUE 'DOCUMENTO';

-- AlterTable
ALTER TABLE "contador_sequencial" DROP CONSTRAINT "contador_sequencial_pkey",
ADD COLUMN     "subtipo" TEXT NOT NULL DEFAULT '',
ADD CONSTRAINT "contador_sequencial_pkey" PRIMARY KEY ("empresa_id", "tipo", "ano", "subtipo");

-- CreateTable
CREATE TABLE "tipo_documento_empresa" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "periodicidade_revisao_meses" INTEGER NOT NULL DEFAULT 24,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipo_documento_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "tipo_id" UUID NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "processo_id" UUID,
    "obra_id" UUID,
    "setor_id" UUID,
    "responsavel_id" UUID NOT NULL,
    "status" "StatusDocumento" NOT NULL DEFAULT 'ELABORACAO',
    "versao_vigente_id" UUID,
    "periodicidade_revisao_meses" INTEGER NOT NULL,
    "proxima_revisao_em" DATE,
    "chave_planilha" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versao_documento" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "StatusVersaoDocumento" NOT NULL DEFAULT 'RASCUNHO',
    "elaborador_id" UUID NOT NULL,
    "anexo_id" UUID,
    "conteudo" JSONB,
    "fluxo_aprovacao_id" UUID,
    "aprovado_em" TIMESTAMP(3),
    "publicado_em" TIMESTAMP(3),
    "publicado_por_id" UUID,
    "obsoleto_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versao_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publicacao_documento" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "versao_id" UUID NOT NULL,
    "publico_todos" BOOLEAN NOT NULL DEFAULT false,
    "setor_ids" UUID[],
    "obra_ids" UUID[],
    "perfil_ids" UUID[],
    "usuario_ids" UUID[],
    "notificar" BOOLEAN NOT NULL DEFAULT true,
    "exigir_ciencia" BOOLEAN NOT NULL DEFAULT false,
    "publicado_por_id" UUID NOT NULL,
    "publicado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publicacao_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ciencia_documento" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "versao_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "confirmado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ciencia_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_documento" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "versao_id" UUID,
    "acao" "AcaoHistoricoDocumento" NOT NULL,
    "observacao" TEXT,
    "dados" JSONB,
    "usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipo_documento_empresa_empresa_id_id_key" ON "tipo_documento_empresa"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_documento_empresa_empresa_id_sigla_key" ON "tipo_documento_empresa"("empresa_id", "sigla");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_documento_empresa_empresa_id_nome_key" ON "tipo_documento_empresa"("empresa_id", "nome");

-- CreateIndex
CREATE INDEX "documento_empresa_id_status_idx" ON "documento"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "documento_empresa_id_processo_id_idx" ON "documento"("empresa_id", "processo_id");

-- CreateIndex
CREATE INDEX "documento_empresa_id_proxima_revisao_em_idx" ON "documento"("empresa_id", "proxima_revisao_em");

-- CreateIndex
CREATE UNIQUE INDEX "documento_empresa_id_id_key" ON "documento"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "documento_empresa_id_codigo_key" ON "documento"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "documento_empresa_id_tipo_id_sequencia_key" ON "documento"("empresa_id", "tipo_id", "sequencia");

-- CreateIndex
CREATE UNIQUE INDEX "documento_empresa_id_versao_vigente_id_key" ON "documento"("empresa_id", "versao_vigente_id");

-- CreateIndex
CREATE UNIQUE INDEX "documento_empresa_id_chave_planilha_key" ON "documento"("empresa_id", "chave_planilha");

-- CreateIndex
CREATE INDEX "versao_documento_empresa_id_status_idx" ON "versao_documento"("empresa_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "versao_documento_empresa_id_id_key" ON "versao_documento"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "versao_documento_empresa_id_documento_id_numero_key" ON "versao_documento"("empresa_id", "documento_id", "numero");

-- CreateIndex
CREATE INDEX "publicacao_documento_empresa_id_documento_id_idx" ON "publicacao_documento"("empresa_id", "documento_id");

-- CreateIndex
CREATE UNIQUE INDEX "publicacao_documento_empresa_id_id_key" ON "publicacao_documento"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "publicacao_documento_empresa_id_versao_id_key" ON "publicacao_documento"("empresa_id", "versao_id");

-- CreateIndex
CREATE INDEX "ciencia_documento_empresa_id_usuario_id_idx" ON "ciencia_documento"("empresa_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "ciencia_documento_empresa_id_id_key" ON "ciencia_documento"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ciencia_documento_empresa_id_versao_id_usuario_id_key" ON "ciencia_documento"("empresa_id", "versao_id", "usuario_id");

-- CreateIndex
CREATE INDEX "historico_documento_empresa_id_documento_id_criado_em_idx" ON "historico_documento"("empresa_id", "documento_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "historico_documento_empresa_id_id_key" ON "historico_documento"("empresa_id", "id");

-- AddForeignKey
ALTER TABLE "tipo_documento_empresa" ADD CONSTRAINT "tipo_documento_empresa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_empresa_id_tipo_id_fkey" FOREIGN KEY ("empresa_id", "tipo_id") REFERENCES "tipo_documento_empresa"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_empresa_id_processo_id_fkey" FOREIGN KEY ("empresa_id", "processo_id") REFERENCES "processo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_empresa_id_setor_id_fkey" FOREIGN KEY ("empresa_id", "setor_id") REFERENCES "setor"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_empresa_id_responsavel_id_fkey" FOREIGN KEY ("empresa_id", "responsavel_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_empresa_id_versao_vigente_id_fkey" FOREIGN KEY ("empresa_id", "versao_vigente_id") REFERENCES "versao_documento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_documento" ADD CONSTRAINT "versao_documento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_documento" ADD CONSTRAINT "versao_documento_empresa_id_documento_id_fkey" FOREIGN KEY ("empresa_id", "documento_id") REFERENCES "documento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_documento" ADD CONSTRAINT "versao_documento_empresa_id_elaborador_id_fkey" FOREIGN KEY ("empresa_id", "elaborador_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_documento" ADD CONSTRAINT "versao_documento_empresa_id_publicado_por_id_fkey" FOREIGN KEY ("empresa_id", "publicado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_documento" ADD CONSTRAINT "versao_documento_empresa_id_anexo_id_fkey" FOREIGN KEY ("empresa_id", "anexo_id") REFERENCES "anexo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_documento" ADD CONSTRAINT "versao_documento_empresa_id_fluxo_aprovacao_id_fkey" FOREIGN KEY ("empresa_id", "fluxo_aprovacao_id") REFERENCES "fluxo_aprovacao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao_documento" ADD CONSTRAINT "publicacao_documento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao_documento" ADD CONSTRAINT "publicacao_documento_empresa_id_documento_id_fkey" FOREIGN KEY ("empresa_id", "documento_id") REFERENCES "documento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao_documento" ADD CONSTRAINT "publicacao_documento_empresa_id_versao_id_fkey" FOREIGN KEY ("empresa_id", "versao_id") REFERENCES "versao_documento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao_documento" ADD CONSTRAINT "publicacao_documento_empresa_id_publicado_por_id_fkey" FOREIGN KEY ("empresa_id", "publicado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ciencia_documento" ADD CONSTRAINT "ciencia_documento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ciencia_documento" ADD CONSTRAINT "ciencia_documento_empresa_id_versao_id_fkey" FOREIGN KEY ("empresa_id", "versao_id") REFERENCES "versao_documento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ciencia_documento" ADD CONSTRAINT "ciencia_documento_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_documento" ADD CONSTRAINT "historico_documento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_documento" ADD CONSTRAINT "historico_documento_empresa_id_documento_id_fkey" FOREIGN KEY ("empresa_id", "documento_id") REFERENCES "documento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_documento" ADD CONSTRAINT "historico_documento_empresa_id_versao_id_fkey" FOREIGN KEY ("empresa_id", "versao_id") REFERENCES "versao_documento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_documento" ADD CONSTRAINT "historico_documento_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Regras extras (não expressas no schema Prisma)
ALTER TABLE "tipo_documento_empresa" ADD CONSTRAINT "tipo_documento_sigla_valida" CHECK ("sigla" ~ '^[A-Z0-9]{1,6}$');
ALTER TABLE "tipo_documento_empresa" ADD CONSTRAINT "tipo_documento_periodicidade" CHECK ("periodicidade_revisao_meses" BETWEEN 1 AND 120);
ALTER TABLE "documento" ADD CONSTRAINT "documento_periodicidade" CHECK ("periodicidade_revisao_meses" BETWEEN 1 AND 120);
ALTER TABLE "documento" ADD CONSTRAINT "documento_titulo_nao_vazio" CHECK (length(btrim("titulo")) > 0);
ALTER TABLE "documento" ADD CONSTRAINT "documento_sequencia_positiva" CHECK ("sequencia" > 0);
ALTER TABLE "versao_documento" ADD CONSTRAINT "versao_documento_numero" CHECK ("numero" >= 0);
ALTER TABLE "versao_documento" ADD CONSTRAINT "versao_documento_motivo_nao_vazio" CHECK (length(btrim("motivo")) > 0);
ALTER TABLE "versao_documento" ADD CONSTRAINT "versao_documento_publicada_tem_data" CHECK ("status" NOT IN ('PUBLICADA', 'OBSOLETA') OR "publicado_em" IS NOT NULL);

-- Revisão publicada é imutável: depois de PUBLICADA só pode virar OBSOLETA (com obsoleto_em); nada
-- mais muda. Revisão publicada/obsoleta não pode ser excluída.
CREATE OR REPLACE FUNCTION versao_documento_publicada_imutavel() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('PUBLICADA', 'OBSOLETA') THEN
      RAISE EXCEPTION 'versao_documento publicada é imutável: DELETE não permitido';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('PUBLICADA', 'OBSOLETA') THEN
    IF NEW.documento_id IS DISTINCT FROM OLD.documento_id
      OR NEW.numero IS DISTINCT FROM OLD.numero
      OR NEW.motivo IS DISTINCT FROM OLD.motivo
      OR NEW.elaborador_id IS DISTINCT FROM OLD.elaborador_id
      OR NEW.anexo_id IS DISTINCT FROM OLD.anexo_id
      OR NEW.conteudo::text IS DISTINCT FROM OLD.conteudo::text
      OR NEW.fluxo_aprovacao_id IS DISTINCT FROM OLD.fluxo_aprovacao_id
      OR NEW.aprovado_em IS DISTINCT FROM OLD.aprovado_em
      OR NEW.publicado_em IS DISTINCT FROM OLD.publicado_em
      OR NEW.publicado_por_id IS DISTINCT FROM OLD.publicado_por_id
      OR NEW.criado_em IS DISTINCT FROM OLD.criado_em
      OR NOT (NEW.status = OLD.status OR (OLD.status = 'PUBLICADA' AND NEW.status = 'OBSOLETA'))
      OR (OLD.status = 'OBSOLETA' AND NEW.obsoleto_em IS DISTINCT FROM OLD.obsoleto_em)
    THEN
      RAISE EXCEPTION 'versao_documento publicada é imutável: somente a obsolescência é permitida';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER versao_documento_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON versao_documento
  FOR EACH ROW EXECUTE FUNCTION versao_documento_publicada_imutavel();

-- HistoricoDocumento, PublicacaoDocumento e CienciaDocumento são append-only.
CREATE OR REPLACE FUNCTION documento_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% é imutável: % não permitido', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER historico_documento_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON historico_documento
  FOR EACH ROW EXECUTE FUNCTION documento_append_only();

CREATE TRIGGER publicacao_documento_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON publicacao_documento
  FOR EACH ROW EXECUTE FUNCTION documento_append_only();

CREATE TRIGGER ciencia_documento_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON ciencia_documento
  FOR EACH ROW EXECUTE FUNCTION documento_append_only();
