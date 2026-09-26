-- CreateEnum
CREATE TYPE "TipoEntidadeInteracao" AS ENUM ('RNC', 'ITEM_ACAO');

-- CreateTable
CREATE TABLE "interacao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "entidade_tipo" "TipoEntidadeInteracao" NOT NULL,
    "entidade_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "destinatario_id" UUID,
    "mensagem" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leitura_interacao" (
    "empresa_id" UUID NOT NULL,
    "interacao_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "lida_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leitura_interacao_pkey" PRIMARY KEY ("empresa_id","interacao_id","usuario_id")
);

-- CreateTable
CREATE TABLE "tentativa_login" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "sucesso" BOOLEAN NOT NULL,
    "bloqueada" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentativa_login_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interacao_empresa_id_entidade_tipo_entidade_id_criado_em_idx" ON "interacao"("empresa_id", "entidade_tipo", "entidade_id", "criado_em");

-- CreateIndex
CREATE INDEX "interacao_empresa_id_destinatario_id_criado_em_idx" ON "interacao"("empresa_id", "destinatario_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "interacao_empresa_id_id_key" ON "interacao"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "leitura_interacao_empresa_id_usuario_id_idx" ON "leitura_interacao"("empresa_id", "usuario_id");

-- CreateIndex
CREATE INDEX "tentativa_login_email_criado_em_idx" ON "tentativa_login"("email", "criado_em");

-- CreateIndex
CREATE INDEX "tentativa_login_ip_criado_em_idx" ON "tentativa_login"("ip", "criado_em");

-- AddForeignKey
ALTER TABLE "interacao" ADD CONSTRAINT "interacao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacao" ADD CONSTRAINT "interacao_empresa_id_autor_id_fkey" FOREIGN KEY ("empresa_id", "autor_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacao" ADD CONSTRAINT "interacao_empresa_id_destinatario_id_fkey" FOREIGN KEY ("empresa_id", "destinatario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leitura_interacao" ADD CONSTRAINT "leitura_interacao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leitura_interacao" ADD CONSTRAINT "leitura_interacao_empresa_id_interacao_id_fkey" FOREIGN KEY ("empresa_id", "interacao_id") REFERENCES "interacao"("empresa_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leitura_interacao" ADD CONSTRAINT "leitura_interacao_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
