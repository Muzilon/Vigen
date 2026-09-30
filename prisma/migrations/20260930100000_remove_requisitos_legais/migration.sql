-- Módulo Requisitos Legais descontinuado (decisão do dono do produto, 2026-09-30).
-- Remove as tabelas e os tipos próprios do módulo.
-- Os valores "REQUISITOS_LEGAIS" / "REQUISITO_LEGAL*" dos enums compartilhados (Modulo, Permissao,
-- OrigemPlanoAcao, TipoEntidadeAnexo/Interacao/Notificacao, TipoSequencia) FICAM no banco de propósito:
-- o Postgres não remove valor de enum sem recriar o tipo, e ainda pode haver linhas antigas usando esses valores.

DROP TRIGGER IF EXISTS historico_requisito_legal_bloqueia_alteracao ON "historico_requisito_legal";
DROP FUNCTION IF EXISTS historico_requisito_legal_imutavel();

DROP TABLE "historico_requisito_legal";
DROP TABLE "requisito_legal";

DROP TYPE "AcaoHistoricoRequisito";
DROP TYPE "StatusRequisitoLegal";
DROP TYPE "TemaRequisito";
DROP TYPE "EsferaRequisito";
DROP TYPE "TipoRequisitoLegal";
