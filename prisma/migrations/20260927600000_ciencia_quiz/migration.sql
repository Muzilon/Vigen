-- Micro-quiz de ciência de leitura: até 3 perguntas de múltipla escolha, cadastradas na publicação.
-- Shape: Array<{ pergunta: string; opcoes: string[]; correta: number }>.
ALTER TABLE "publicacao_documento" ADD COLUMN "perguntas_ciencia" JSONB;
