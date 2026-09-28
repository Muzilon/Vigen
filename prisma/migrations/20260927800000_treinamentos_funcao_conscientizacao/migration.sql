-- AlterEnum
ALTER TYPE "TipoTreinamento" ADD VALUE 'CONSCIENTIZACAO';

-- AlterTable
ALTER TABLE "treinamento" ADD COLUMN     "documento_id" UUID,
ADD COLUMN     "obrigatorio_funcao_ids" UUID[] DEFAULT ARRAY[]::UUID[];

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "funcao_id" UUID;

-- CreateTable
CREATE TABLE "funcao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funcao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "funcao_empresa_id_id_key" ON "funcao"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "funcao_empresa_id_nome_key" ON "funcao"("empresa_id", "nome");

-- AddForeignKey
ALTER TABLE "funcao" ADD CONSTRAINT "funcao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empresa_id_funcao_id_fkey" FOREIGN KEY ("empresa_id", "funcao_id") REFERENCES "funcao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento" ADD CONSTRAINT "treinamento_empresa_id_documento_id_fkey" FOREIGN KEY ("empresa_id", "documento_id") REFERENCES "documento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras SQL
ALTER TABLE "funcao" ADD CONSTRAINT "funcao_nome" CHECK (length(btrim("nome")) > 0);
