-- AlterEnum
ALTER TYPE "TipoNotificacao" ADD VALUE 'ITEM_CONCLUIDO_SEM_EVIDENCIA';

-- AlterTable
ALTER TABLE "item_acao" ADD COLUMN     "concluido_por_id" UUID,
ADD COLUMN     "link_evidencia" TEXT,
ADD COLUMN     "sem_evidencia" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "item_acao" ADD CONSTRAINT "item_acao_empresa_id_concluido_por_id_fkey" FOREIGN KEY ("empresa_id", "concluido_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
