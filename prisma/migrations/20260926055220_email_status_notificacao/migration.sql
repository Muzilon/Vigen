-- CreateEnum
CREATE TYPE "StatusEmailNotificacao" AS ENUM ('PENDENTE', 'ENVIADO', 'IGNORADO', 'FALHOU');

-- AlterTable
ALTER TABLE "notificacao" ADD COLUMN     "email_status" "StatusEmailNotificacao" NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN     "email_tentativa_em" TIMESTAMP(3),
ADD COLUMN     "email_tentativas" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "notificacao_empresa_id_email_status_criado_em_idx" ON "notificacao"("empresa_id", "email_status", "criado_em");

-- Dados existentes: já enviadas => ENVIADO; o backlog antigo sem envio NÃO é reenviado (IGNORADO).
UPDATE "notificacao" SET "email_status" = 'ENVIADO', "email_tentativas" = 1 WHERE "email_enviado_em" IS NOT NULL;
UPDATE "notificacao" SET "email_status" = 'IGNORADO' WHERE "email_enviado_em" IS NULL;
