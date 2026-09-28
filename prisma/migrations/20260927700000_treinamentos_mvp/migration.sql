-- CreateEnum
CREATE TYPE "ModalidadeTreinamento" AS ENUM ('PRESENCIAL', 'EAD', 'SEMIPRESENCIAL');

-- CreateEnum
CREATE TYPE "ResultadoEficacia" AS ENUM ('EFICAZ', 'NAO_EFICAZ');

-- CreateEnum
CREATE TYPE "MotivoGatilhoReciclagem" AS ENUM ('MUDANCA_FUNCAO', 'RETORNO_AFASTAMENTO', 'ACIDENTE_INCIDENTE', 'MUDANCA_PROCEDIMENTO', 'OUTRO');

-- AlterTable
ALTER TABLE "participacao_treinamento" ADD COLUMN     "eficacia_avaliada_em" TIMESTAMP(3),
ADD COLUMN     "eficacia_avaliador_id" UUID,
ADD COLUMN     "eficacia_observacao" TEXT,
ADD COLUMN     "eficacia_resultado" "ResultadoEficacia";

-- AlterTable
ALTER TABLE "sessao_treinamento" ADD COLUMN     "conteudo_programatico" TEXT,
ADD COLUMN     "modalidade" "ModalidadeTreinamento" NOT NULL DEFAULT 'PRESENCIAL',
ADD COLUMN     "qualificacao_instrutor" TEXT;

-- AlterTable
ALTER TABLE "treinamento" ADD COLUMN     "critico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dias_avaliacao_eficacia" INTEGER;

-- CreateTable
CREATE TABLE "gatilho_reciclagem" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "treinamento_id" UUID NOT NULL,
    "motivo" "MotivoGatilhoReciclagem" NOT NULL,
    "data_evento" DATE NOT NULL,
    "descricao" TEXT,
    "registrado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gatilho_reciclagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gatilho_reciclagem_empresa_id_usuario_id_treinamento_id_idx" ON "gatilho_reciclagem"("empresa_id", "usuario_id", "treinamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "gatilho_reciclagem_empresa_id_id_key" ON "gatilho_reciclagem"("empresa_id", "id");

-- AddForeignKey
ALTER TABLE "participacao_treinamento" ADD CONSTRAINT "participacao_treinamento_empresa_id_eficacia_avaliador_id_fkey" FOREIGN KEY ("empresa_id", "eficacia_avaliador_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gatilho_reciclagem" ADD CONSTRAINT "gatilho_reciclagem_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gatilho_reciclagem" ADD CONSTRAINT "gatilho_reciclagem_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gatilho_reciclagem" ADD CONSTRAINT "gatilho_reciclagem_empresa_id_treinamento_id_fkey" FOREIGN KEY ("empresa_id", "treinamento_id") REFERENCES "treinamento"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gatilho_reciclagem" ADD CONSTRAINT "gatilho_reciclagem_empresa_id_registrado_por_id_fkey" FOREIGN KEY ("empresa_id", "registrado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras SQL (Treinamentos — MVP doc 06)
ALTER TABLE "treinamento" ADD CONSTRAINT "treinamento_dias_eficacia" CHECK ("dias_avaliacao_eficacia" IS NULL OR "dias_avaliacao_eficacia" BETWEEN 1 AND 365);
-- Avaliação de eficácia só para presente, e resultado/avaliador/data andam juntos.
ALTER TABLE "participacao_treinamento" ADD CONSTRAINT "participacao_eficacia_presente" CHECK ("eficacia_resultado" IS NULL OR "presente");
ALTER TABLE "participacao_treinamento" ADD CONSTRAINT "participacao_eficacia_completa" CHECK (("eficacia_resultado" IS NULL) = ("eficacia_avaliador_id" IS NULL) AND ("eficacia_resultado" IS NULL) = ("eficacia_avaliada_em" IS NULL));
