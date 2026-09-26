-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('RNC_ATRIBUIDA', 'ITEM_ATRIBUIDO', 'INTERACAO_NOVA', 'CANCELAMENTO_SOLICITADO', 'CANCELAMENTO_DECIDIDO', 'RNC_EM_VERIFICACAO', 'ITEM_PRAZO_PROXIMO', 'ITEM_ATRASADO', 'RESUMO_SEMANAL');

-- CreateEnum
CREATE TYPE "TipoEntidadeNotificacao" AS ENUM ('RNC', 'ITEM_ACAO');

-- CreateTable
CREATE TABLE "notificacao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "entidade_tipo" "TipoEntidadeNotificacao",
    "entidade_id" UUID,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "link" TEXT,
    "lida_em" TIMESTAMP(3),
    "email_enviado_em" TIMESTAMP(3),
    "chave_idempotencia" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacao_empresa_id_usuario_id_lida_em_idx" ON "notificacao"("empresa_id", "usuario_id", "lida_em");

-- CreateIndex
CREATE INDEX "notificacao_empresa_id_usuario_id_criado_em_idx" ON "notificacao"("empresa_id", "usuario_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "notificacao_empresa_id_id_key" ON "notificacao"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notificacao_empresa_id_chave_idempotencia_key" ON "notificacao"("empresa_id", "chave_idempotencia");

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
