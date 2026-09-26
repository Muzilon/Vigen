-- CreateEnum
CREATE TYPE "TipoEscala" AS ENUM ('RISCO_OPORTUNIDADE', 'HIRA', 'ASPECTO_IMPACTO');

-- AlterEnum
-- Decisão (docs/06-desenho-modulos.md): INSPECAO/AUDITORIA renomeados para INSPECOES/AUDITORIAS
-- (plural, consistente com os módulos novos); nenhum modelo usava esses valores ainda.
BEGIN;
CREATE TYPE "Modulo_new" AS ENUM ('RNC', 'PLANO_ACAO', 'MAPA_PROCESSOS', 'RISCOS_OPORTUNIDADES', 'SWOT', 'HIRA', 'LAIA', 'INSPECOES', 'AUDITORIAS', 'DOCUMENTOS', 'REQUISITOS_LEGAIS', 'INCIDENTES', 'INDICADORES', 'TREINAMENTOS');
ALTER TABLE "public"."empresa" ALTER COLUMN "modulos_ativos" DROP DEFAULT;
ALTER TABLE "empresa" ALTER COLUMN "modulos_ativos" TYPE "Modulo_new"[] USING ("modulos_ativos"::text::"Modulo_new"[]);
ALTER TYPE "Modulo" RENAME TO "Modulo_old";
ALTER TYPE "Modulo_new" RENAME TO "Modulo";
DROP TYPE "public"."Modulo_old";
ALTER TABLE "empresa" ALTER COLUMN "modulos_ativos" SET DEFAULT ARRAY['RNC', 'PLANO_ACAO']::"Modulo"[];
COMMIT;

-- CreateTable
CREATE TABLE "configuracao_escala" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "tipo" "TipoEscala" NOT NULL,
    "obra_id" UUID,
    "tamanho" INTEGER NOT NULL,
    "eixos" JSONB NOT NULL,
    "faixas" JSONB NOT NULL,
    "criterios_extras" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_escala_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configuracao_escala_empresa_id_tipo_idx" ON "configuracao_escala"("empresa_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_escala_empresa_id_id_key" ON "configuracao_escala"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_escala_empresa_id_tipo_obra_id_key" ON "configuracao_escala"("empresa_id", "tipo", "obra_id");

-- CreateIndex
-- Garante no máximo uma configuração "padrão da empresa" (obra_id nulo) por empresa+tipo.
-- Postgres não aplica UNIQUE(a,b,c) entre múltiplas linhas com c NULL, por isso o índice parcial.
CREATE UNIQUE INDEX "configuracao_escala_empresa_id_tipo_padrao_key" ON "configuracao_escala"("empresa_id", "tipo") WHERE "obra_id" IS NULL;

-- AddForeignKey
ALTER TABLE "configuracao_escala" ADD CONSTRAINT "configuracao_escala_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracao_escala" ADD CONSTRAINT "configuracao_escala_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
