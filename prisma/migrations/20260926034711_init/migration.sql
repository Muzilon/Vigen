-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('BASICO', 'PROFISSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Modulo" AS ENUM ('RNC', 'PLANO_ACAO', 'INSPECAO', 'AUDITORIA', 'DOCUMENTOS');

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ADMIN', 'GESTOR_SGI', 'INSPETOR', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "Permissao" AS ENUM ('RNC_ABRIR', 'RNC_TRATAR', 'RNC_VERIFICAR_EFICACIA', 'RNC_SOLICITAR_CANCELAMENTO', 'RNC_APROVAR_CANCELAMENTO', 'RNC_VER_RESTRITAS', 'PLANO_GERENCIAR', 'ADMIN_CONFIG', 'VER_TODAS_OBRAS');

-- CreateEnum
CREATE TYPE "EscopoObras" AS ENUM ('TODAS', 'SELECIONADAS');

-- CreateEnum
CREATE TYPE "TipoRnc" AS ENUM ('QUALIDADE', 'MEIO_AMBIENTE', 'SSO');

-- CreateEnum
CREATE TYPE "OrigemRnc" AS ENUM ('AUDITORIA_INTERNA', 'INSPECAO', 'RECLAMACAO_CLIENTE', 'AUTO_IDENTIFICADA', 'AUDITORIA_EXTERNA');

-- CreateEnum
CREATE TYPE "Gravidade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "MetodoCausaRaiz" AS ENUM ('CINCO_PORQUES', 'ISHIKAWA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusRnc" AS ENUM ('ABERTO', 'EM_ANALISE', 'PLANO_EM_EXECUCAO', 'EM_VERIFICACAO', 'ENCERRADO', 'REABERTO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ResultadoVerificacao" AS ENUM ('EFICAZ', 'INEFICAZ');

-- CreateEnum
CREATE TYPE "StatusSolicitacaoCancelamento" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "OrigemPlanoAcao" AS ENUM ('RNC', 'INSPECAO', 'AUDITORIA', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusItemAcao" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoEntidadeAnexo" AS ENUM ('RNC', 'RNC_DADOS_SENSIVEIS', 'VERIFICACAO_EFICACIA', 'PLANO_ACAO', 'ITEM_ACAO');

-- CreateEnum
CREATE TYPE "TipoSequencia" AS ENUM ('RNC');

-- CreateTable
CREATE TABLE "empresa" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "segmento" TEXT,
    "plano" "Plano" NOT NULL DEFAULT 'BASICO',
    "modulos_ativos" "Modulo"[] DEFAULT ARRAY['RNC', 'PLANO_ACAO']::"Modulo"[],
    "dias_alerta_prazo" INTEGER NOT NULL DEFAULT 3,
    "fuso_horario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "config" JSONB NOT NULL DEFAULT '{}',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra_unidade" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "endereco" TEXT,
    "segmento" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obra_unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setor" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "permissoes" "Permissao"[],
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'COLABORADOR',
    "perfil_id" UUID,
    "setor_id" UUID,
    "escopo_obras" "EscopoObras" NOT NULL DEFAULT 'SELECIONADAS',
    "token_versao" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_login" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_acesso_obra" (
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_acesso_obra_pkey" PRIMARY KEY ("empresa_id","usuario_id","obra_id")
);

-- CreateTable
CREATE TABLE "contador_sequencial" (
    "empresa_id" UUID NOT NULL,
    "tipo" "TipoSequencia" NOT NULL,
    "ano" INTEGER NOT NULL,
    "ultimo_valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contador_sequencial_pkey" PRIMARY KEY ("empresa_id","tipo","ano")
);

-- CreateTable
CREATE TABLE "rnc" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoRnc" NOT NULL,
    "origem" "OrigemRnc" NOT NULL,
    "gravidade" "Gravidade" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "data_abertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "obra_id" UUID NOT NULL,
    "setor_id" UUID,
    "processo_area" TEXT,
    "aberto_por_id" UUID NOT NULL,
    "responsavel_id" UUID,
    "causa_raiz" TEXT,
    "metodo_causa_raiz" "MetodoCausaRaiz",
    "analise_causa" JSONB,
    "status" "StatusRnc" NOT NULL DEFAULT 'ABERTO',
    "data_verificacao_eficacia" DATE,
    "eficaz" BOOLEAN,
    "restrita" BOOLEAN NOT NULL DEFAULT false,
    "contem_dados_pessoais" BOOLEAN NOT NULL DEFAULT false,
    "plano_acao_id" UUID,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "encerrado_em" TIMESTAMP(3),
    "cancelado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rnc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rnc_dados_sensiveis" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "nome_envolvido" TEXT,
    "documento_envolvido" TEXT,
    "funcao_envolvido" TEXT,
    "relato" TEXT,
    "lesao_descricao" TEXT,
    "dados_cifrados" BYTEA,
    "iv" BYTEA,
    "chave_id" TEXT,
    "chave_versao" INTEGER,
    "nome_hash_busca" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rnc_dados_sensiveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificacao_eficacia" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "tentativa" INTEGER NOT NULL,
    "resultado" "ResultadoVerificacao" NOT NULL,
    "comentario" TEXT NOT NULL,
    "verificador_id" UUID NOT NULL,
    "verificado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verificacao_eficacia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_status_rnc" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "status_anterior" "StatusRnc",
    "status_novo" "StatusRnc" NOT NULL,
    "usuario_id" UUID NOT NULL,
    "motivo" TEXT,
    "metadados" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_status_rnc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacao_cancelamento" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "rnc_id" UUID NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "status_rnc_na_solicitacao" "StatusRnc" NOT NULL,
    "status" "StatusSolicitacaoCancelamento" NOT NULL DEFAULT 'PENDENTE',
    "aprovador_id" UUID,
    "decidido_em" TIMESTAMP(3),
    "comentario_decisao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacao_cancelamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_acao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "origem_tipo" "OrigemPlanoAcao" NOT NULL,
    "origem_id" UUID,
    "titulo" TEXT NOT NULL,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plano_acao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_acao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "plano_acao_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ciclo" INTEGER NOT NULL DEFAULT 1,
    "o_que" TEXT NOT NULL,
    "por_que" TEXT,
    "onde" TEXT,
    "quem_id" UUID NOT NULL,
    "quando" DATE NOT NULL,
    "como" TEXT,
    "quanto" DECIMAL(14,2),
    "status" "StatusItemAcao" NOT NULL DEFAULT 'PENDENTE',
    "evidencia_conclusao" TEXT,
    "data_conclusao" TIMESTAMP(3),
    "alerta_enviado_em" TIMESTAMP(3),
    "atraso_notificado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_acao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexo" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "entidade_tipo" "TipoEntidadeAnexo" NOT NULL,
    "entidade_id" UUID NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "chave_armazenamento" TEXT NOT NULL,
    "url" TEXT,
    "sensivel" BOOLEAN NOT NULL DEFAULT false,
    "enviado_por_id" UUID NOT NULL,
    "excluido_em" TIMESTAMP(3),
    "excluido_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_cnpj_key" ON "empresa"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "obra_unidade_empresa_id_id_key" ON "obra_unidade"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "obra_unidade_empresa_id_nome_key" ON "obra_unidade"("empresa_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "setor_empresa_id_id_key" ON "setor"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "setor_empresa_id_nome_key" ON "setor"("empresa_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_empresa_id_id_key" ON "perfil"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_empresa_id_nome_key" ON "perfil"("empresa_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_empresa_id_ativo_idx" ON "usuario"("empresa_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_empresa_id_id_key" ON "usuario"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "usuario_acesso_obra_empresa_id_obra_id_idx" ON "usuario_acesso_obra"("empresa_id", "obra_id");

-- CreateIndex
CREATE INDEX "rnc_empresa_id_status_idx" ON "rnc"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "rnc_empresa_id_obra_id_status_idx" ON "rnc"("empresa_id", "obra_id", "status");

-- CreateIndex
CREATE INDEX "rnc_empresa_id_responsavel_id_status_idx" ON "rnc"("empresa_id", "responsavel_id", "status");

-- CreateIndex
CREATE INDEX "rnc_empresa_id_restrita_idx" ON "rnc"("empresa_id", "restrita");

-- CreateIndex
CREATE UNIQUE INDEX "rnc_empresa_id_id_key" ON "rnc"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "rnc_empresa_id_ano_sequencia_key" ON "rnc"("empresa_id", "ano", "sequencia");

-- CreateIndex
CREATE UNIQUE INDEX "rnc_empresa_id_codigo_key" ON "rnc"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "rnc_empresa_id_plano_acao_id_key" ON "rnc"("empresa_id", "plano_acao_id");

-- CreateIndex
CREATE UNIQUE INDEX "rnc_dados_sensiveis_empresa_id_id_key" ON "rnc_dados_sensiveis"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "rnc_dados_sensiveis_empresa_id_rnc_id_key" ON "rnc_dados_sensiveis"("empresa_id", "rnc_id");

-- CreateIndex
CREATE UNIQUE INDEX "verificacao_eficacia_empresa_id_id_key" ON "verificacao_eficacia"("empresa_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "verificacao_eficacia_empresa_id_rnc_id_tentativa_key" ON "verificacao_eficacia"("empresa_id", "rnc_id", "tentativa");

-- CreateIndex
CREATE INDEX "historico_status_rnc_empresa_id_rnc_id_criado_em_idx" ON "historico_status_rnc"("empresa_id", "rnc_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "historico_status_rnc_empresa_id_id_key" ON "historico_status_rnc"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "solicitacao_cancelamento_empresa_id_status_idx" ON "solicitacao_cancelamento"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "solicitacao_cancelamento_empresa_id_rnc_id_idx" ON "solicitacao_cancelamento"("empresa_id", "rnc_id");

-- CreateIndex
CREATE UNIQUE INDEX "solicitacao_cancelamento_empresa_id_id_key" ON "solicitacao_cancelamento"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "plano_acao_empresa_id_origem_tipo_origem_id_idx" ON "plano_acao"("empresa_id", "origem_tipo", "origem_id");

-- CreateIndex
CREATE UNIQUE INDEX "plano_acao_empresa_id_id_key" ON "plano_acao"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "item_acao_empresa_id_plano_acao_id_idx" ON "item_acao"("empresa_id", "plano_acao_id");

-- CreateIndex
CREATE INDEX "item_acao_empresa_id_quem_id_status_idx" ON "item_acao"("empresa_id", "quem_id", "status");

-- CreateIndex
CREATE INDEX "item_acao_empresa_id_status_quando_idx" ON "item_acao"("empresa_id", "status", "quando");

-- CreateIndex
CREATE UNIQUE INDEX "item_acao_empresa_id_id_key" ON "item_acao"("empresa_id", "id");

-- CreateIndex
CREATE INDEX "anexo_empresa_id_entidade_tipo_entidade_id_idx" ON "anexo"("empresa_id", "entidade_tipo", "entidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "anexo_empresa_id_id_key" ON "anexo"("empresa_id", "id");

-- AddForeignKey
ALTER TABLE "obra_unidade" ADD CONSTRAINT "obra_unidade_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setor" ADD CONSTRAINT "setor_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil" ADD CONSTRAINT "perfil_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empresa_id_perfil_id_fkey" FOREIGN KEY ("empresa_id", "perfil_id") REFERENCES "perfil"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empresa_id_setor_id_fkey" FOREIGN KEY ("empresa_id", "setor_id") REFERENCES "setor"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_acesso_obra" ADD CONSTRAINT "usuario_acesso_obra_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_acesso_obra" ADD CONSTRAINT "usuario_acesso_obra_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_acesso_obra" ADD CONSTRAINT "usuario_acesso_obra_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contador_sequencial" ADD CONSTRAINT "contador_sequencial_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rnc" ADD CONSTRAINT "rnc_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rnc" ADD CONSTRAINT "rnc_empresa_id_obra_id_fkey" FOREIGN KEY ("empresa_id", "obra_id") REFERENCES "obra_unidade"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rnc" ADD CONSTRAINT "rnc_empresa_id_setor_id_fkey" FOREIGN KEY ("empresa_id", "setor_id") REFERENCES "setor"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rnc" ADD CONSTRAINT "rnc_empresa_id_aberto_por_id_fkey" FOREIGN KEY ("empresa_id", "aberto_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rnc" ADD CONSTRAINT "rnc_empresa_id_responsavel_id_fkey" FOREIGN KEY ("empresa_id", "responsavel_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rnc" ADD CONSTRAINT "rnc_empresa_id_plano_acao_id_fkey" FOREIGN KEY ("empresa_id", "plano_acao_id") REFERENCES "plano_acao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rnc_dados_sensiveis" ADD CONSTRAINT "rnc_dados_sensiveis_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rnc_dados_sensiveis" ADD CONSTRAINT "rnc_dados_sensiveis_empresa_id_rnc_id_fkey" FOREIGN KEY ("empresa_id", "rnc_id") REFERENCES "rnc"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacao_eficacia" ADD CONSTRAINT "verificacao_eficacia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacao_eficacia" ADD CONSTRAINT "verificacao_eficacia_empresa_id_rnc_id_fkey" FOREIGN KEY ("empresa_id", "rnc_id") REFERENCES "rnc"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacao_eficacia" ADD CONSTRAINT "verificacao_eficacia_empresa_id_verificador_id_fkey" FOREIGN KEY ("empresa_id", "verificador_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status_rnc" ADD CONSTRAINT "historico_status_rnc_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status_rnc" ADD CONSTRAINT "historico_status_rnc_empresa_id_rnc_id_fkey" FOREIGN KEY ("empresa_id", "rnc_id") REFERENCES "rnc"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status_rnc" ADD CONSTRAINT "historico_status_rnc_empresa_id_usuario_id_fkey" FOREIGN KEY ("empresa_id", "usuario_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_cancelamento" ADD CONSTRAINT "solicitacao_cancelamento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_cancelamento" ADD CONSTRAINT "solicitacao_cancelamento_empresa_id_rnc_id_fkey" FOREIGN KEY ("empresa_id", "rnc_id") REFERENCES "rnc"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_cancelamento" ADD CONSTRAINT "solicitacao_cancelamento_empresa_id_solicitante_id_fkey" FOREIGN KEY ("empresa_id", "solicitante_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_cancelamento" ADD CONSTRAINT "solicitacao_cancelamento_empresa_id_aprovador_id_fkey" FOREIGN KEY ("empresa_id", "aprovador_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_acao" ADD CONSTRAINT "plano_acao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_acao" ADD CONSTRAINT "plano_acao_empresa_id_criado_por_id_fkey" FOREIGN KEY ("empresa_id", "criado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_acao" ADD CONSTRAINT "item_acao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_acao" ADD CONSTRAINT "item_acao_empresa_id_plano_acao_id_fkey" FOREIGN KEY ("empresa_id", "plano_acao_id") REFERENCES "plano_acao"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_acao" ADD CONSTRAINT "item_acao_empresa_id_quem_id_fkey" FOREIGN KEY ("empresa_id", "quem_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_empresa_id_enviado_por_id_fkey" FOREIGN KEY ("empresa_id", "enviado_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_empresa_id_excluido_por_id_fkey" FOREIGN KEY ("empresa_id", "excluido_por_id") REFERENCES "usuario"("empresa_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
