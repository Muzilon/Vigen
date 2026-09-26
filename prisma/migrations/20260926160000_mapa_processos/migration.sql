-- CreateEnum
CREATE TYPE "TipoProcesso" AS ENUM ('GESTAO', 'FINALISTICO', 'APOIO');

-- AlterEnum
ALTER TYPE "Permissao" ADD VALUE 'PROCESSO_GERENCIAR';

-- AlterEnum
ALTER TYPE "TipoEntidadeAnexo" ADD VALUE 'PROCESSO';

-- AlterEnum
ALTER TYPE "TipoEntidadeInteracao" ADD VALUE 'PROCESSO';

-- AlterEnum
ALTER TYPE "TipoEntidadeNotificacao" ADD VALUE 'PROCESSO';

-- CreateTable
CREATE TABLE "processo" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoProcesso" NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "objetivo" TEXT,
    "dono_id" UUID,
    "entradas" TEXT,
    "saidas" TEXT,
    "fornecedores" TEXT,
    "clientes" TEXT,
    "recursos" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "revisao" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicador_processo" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "processo_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "meta" TEXT,
    "unidade" TEXT,
    "periodicidade" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicador_processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interacao_processo" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "origem_id" UUID NOT NULL,
    "destino_id" UUID NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interacao_processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versao_processo" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "processo_id" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "observacao" TEXT,
    "publicado_por_id" UUID NOT NULL,
    "publicado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versao_processo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processo_empresa_id_tipo_ordem_idx" ON "processo"("empresa_id", "tipo", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "processo_empresa_id_id_key" ON "processo"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "processo_empresa_id_codigo_key" ON "processo"("empresa_id", "codigo");

-- CreateIndex
CREATE INDEX "indicador_processo_empresa_id_processo_id_idx" ON "indicador_processo"("empresa_id", "processo_id");

-- CreateIndex
CREATE UNIQUE INDEX "indicador_processo_empresa_id_id_key" ON "indicador_processo"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "interacao_processo_empresa_id_destino_id_idx" ON "interacao_processo"("empresa_id", "destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "interacao_processo_empresa_id_id_key" ON "interacao_processo"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "interacao_processo_empresa_id_origem_id_destino_id_key" ON "interacao_processo"("empresa_id", "origem_id", "destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "versao_processo_empresa_id_id_key" ON "versao_processo"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "versao_processo_empresa_id_processo_id_versao_key" ON "versao_processo"("empresa_id", "processo_id", "versao");

-- AddForeignKey
ALTER TABLE "processo" ADD CONSTRAINT "processo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo" ADD CONSTRAINT "processo_empresa_id_dono_id_fkey" FOREIGN KEY ("empresa_id", "dono_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicador_processo" ADD CONSTRAINT "indicador_processo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicador_processo" ADD CONSTRAINT "indicador_processo_empresa_id_processo_id_fkey" FOREIGN KEY ("empresa_id", "processo_id") REFERENCES "processo"("empresa_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacao_processo" ADD CONSTRAINT "interacao_processo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacao_processo" ADD CONSTRAINT "interacao_processo_empresa_id_origem_id_fkey" FOREIGN KEY ("empresa_id", "origem_id") REFERENCES "processo"("empresa_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacao_processo" ADD CONSTRAINT "interacao_processo_empresa_id_destino_id_fkey" FOREIGN KEY ("empresa_id", "destino_id") REFERENCES "processo"("empresa_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_processo" ADD CONSTRAINT "versao_processo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_processo" ADD CONSTRAINT "versao_processo_empresa_id_processo_id_fkey" FOREIGN KEY ("empresa_id", "processo_id") REFERENCES "processo"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_processo" ADD CONSTRAINT "versao_processo_empresa_id_publicado_por_id_fkey" FOREIGN KEY ("empresa_id", "publicado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras extras (não expressas no schema Prisma)
ALTER TABLE "interacao_processo" ADD CONSTRAINT "interacao_processo_origem_diferente_destino" CHECK ("origem_id" <> "destino_id");
ALTER TABLE "processo" ADD CONSTRAINT "processo_codigo_nao_vazio" CHECK (length(btrim("codigo")) > 0);

-- VersaoProcesso é append-only (snapshot publicado imutável).
CREATE OR REPLACE FUNCTION versao_processo_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'versao_processo é imutável: % não permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER versao_processo_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON versao_processo
  FOR EACH ROW EXECUTE FUNCTION versao_processo_imutavel();
