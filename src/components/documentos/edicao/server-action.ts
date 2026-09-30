'use server';

import type { AtualizarDocumentoInput, AtualizarDocumentoResult, DocumentoEdicao } from './types';

/**
 * Simulação de armazenamento em memória para referência do Server Action
 */
const mockDatabase: Record<string, DocumentoEdicao> = {
  'doc-101': {
    id: 'doc-101',
    versao: 1,
    titulo: 'Diretrizes de Segurança da Informação 2026',
    descricao: 'Normas de governança de acessos, criptografia e proteção de dados confidenciais.',
    categoria: 'Segurança',
    tags: ['governanca', 'seguranca', 'politica'],
    status: 'revisao',
    autor: 'admin@vigen.internal',
    atualizadoEm: new Date().toISOString()
  }
};

/**
 * Server Action: atualizarDocumentoAction
 * Valida os dados recebidos, verifica a versão para concorrência otimista
 * e persiste as alterações se não houver conflitos.
 */
export async function atualizarDocumentoAction(
  input: AtualizarDocumentoInput
): Promise<AtualizarDocumentoResult> {
  // Simular latência de rede/banco
  await new Promise((resolve) => setTimeout(resolve, 600));

  // 1. Validação básica de campos
  const erros: Record<string, string> = {};
  if (!input.titulo || input.titulo.trim().length < 3) {
    erros.titulo = 'O título é obrigatório e deve possuir no mínimo 3 caracteres.';
  }
  if (!input.categoria) {
    erros.categoria = 'Selecione uma categoria válida.';
  }
  if (!input.descricao || input.descricao.trim().length < 10) {
    erros.descricao = 'A descrição do documento deve possuir pelo menos 10 caracteres.';
  }

  if (Object.keys(erros).length > 0) {
    return {
      success: false,
      error: 'validacao',
      message: 'Existem campos com preenchimento inválido.',
      errosCampos: erros
    };
  }

  // 2. Busca do registro atual
  const docExistente = mockDatabase[input.id];
  if (!docExistente) {
    return {
      success: false,
      error: 'nao_encontrado',
      message: 'O documento solicitado não foi localizado no sistema.'
    };
  }

  // 3. Verificação Crítica: Concorrência Otimista (Optimistic Concurrency Control)
  if (input.versao !== docExistente.versao) {
    return {
      success: false,
      error: 'conflito_versao',
      message: 'O documento foi modificado por outro usuário.',
      versaoServidor: docExistente.versao,
      documentoServidor: { ...docExistente }
    };
  }

  // 4. Atualização e incremento de versão
  const novaVersao = docExistente.versao + 1;
  const documentoAtualizado: DocumentoEdicao = {
    ...docExistente,
    ...input,
    versao: novaVersao,
    atualizadoEm: new Date().toISOString()
  };

  // 5. Trilha de auditoria (Evento EDICAO)
  if (!global.mockEventLog) {
    global.mockEventLog = [];
  }
  global.mockEventLog.push({
    tipo: 'EDICAO',
    documentoId: input.id,
    antes: { ...docExistente },
    depois: { ...documentoAtualizado },
    data: new Date().toISOString()
  });

  mockDatabase[input.id] = documentoAtualizado;

  return {
    success: true,
    documento: documentoAtualizado,
    message: 'Documento atualizado com sucesso!'
  };
}
