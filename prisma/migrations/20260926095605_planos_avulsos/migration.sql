-- AlterTable
ALTER TABLE "plano_acao" ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "obra_id" UUID,
ADD COLUMN     "versao" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "plano_acao_empresa_id_obra_id_idx" ON "plano_acao"("empresa_id", "obra_id");

-- AddForeignKey
ALTER TABLE "plano_acao" ADD CONSTRAINT "plano_acao_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Plano avulso (MANUAL) não tem registro de origem.
ALTER TABLE "plano_acao" ADD CONSTRAINT "plano_acao_manual_sem_origem_chk"
  CHECK ("origem_tipo" <> 'MANUAL' OR "origem_id" IS NULL);
