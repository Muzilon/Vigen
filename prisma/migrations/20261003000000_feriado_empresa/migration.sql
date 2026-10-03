-- CreateTable
CREATE TABLE "feriado_empresa" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feriado_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feriado_empresa_empresa_id_id_key" ON "feriado_empresa"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "feriado_empresa_empresa_id_data_key" ON "feriado_empresa"("empresa_id", "data");

-- AddForeignKey
ALTER TABLE "feriado_empresa" ADD CONSTRAINT "feriado_empresa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feriado_empresa" ADD CONSTRAINT "feriado_empresa_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras SQL
ALTER TABLE "feriado_empresa" ADD CONSTRAINT "feriado_empresa_versao_check" CHECK ("versao" >= 1);
ALTER TABLE "feriado_empresa" ADD CONSTRAINT "feriado_empresa_descricao_check" CHECK (length(btrim("descricao")) > 0);
