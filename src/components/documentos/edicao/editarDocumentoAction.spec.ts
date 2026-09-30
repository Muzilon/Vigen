import { describe, it, expect, beforeEach } from 'vitest';
import { atualizarDocumentoAction } from './server-action';
import type { AtualizarDocumentoInput } from './types';

describe('editarDocumentoAction', () => {
  beforeEach(() => {
    // Reset any global mocks or data if needed
    global.mockEventLog = [];
  });

  it('deve atualizar o documento com sucesso (caminho feliz) preservando metadados', async () => {
    const input: AtualizarDocumentoInput = {
      id: 'doc-101',
      versao: 1, // Versão atual no mock
      titulo: 'Diretrizes de Segurança 2026 Revisadas',
      descricao: 'Novas normas de segurança com maior nível de detalhes.',
      categoria: 'Segurança',
      tags: ['seguranca'],
      status: 'publicado'
    };

    const resultado = await atualizarDocumentoAction(input);

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.documento.versao).toBe(2);
      expect(resultado.documento.titulo).toBe('Diretrizes de Segurança 2026 Revisadas');
      // Verifica se os metadados antigos foram mantidos (não destrutivo)
      expect(resultado.documento.autor).toBe('admin@vigen.internal');
      
      // Verifica trilha de auditoria
      expect(global.mockEventLog).toHaveLength(1);
      expect(global.mockEventLog[0].tipo).toBe('EDICAO');
      expect(global.mockEventLog[0].antes.versao).toBe(1);
      expect(global.mockEventLog[0].depois.versao).toBe(2);
    }
  });

  it('deve falhar por conflito de versão (concorrência otimista)', async () => {
    const input: AtualizarDocumentoInput = {
      id: 'doc-101',
      versao: 1, // A versão no servidor agora é 2 por causa do teste anterior
      titulo: 'Tentativa de Sobrescrita',
      descricao: 'Descrição longa o suficiente.',
      categoria: 'Segurança',
      tags: ['seguranca'],
      status: 'revisao'
    };

    const resultado = await atualizarDocumentoAction(input);

    expect(resultado.success).toBe(false);
    if (!resultado.success && resultado.error === 'conflito_versao') {
      expect(resultado.error).toBe('conflito_versao');
      expect(resultado.versaoServidor).toBe(2);
    } else {
      expect.fail('Deveria ter retornado conflito_versao');
    }
  });

  it('deve falhar na validação de campos', async () => {
    const input: AtualizarDocumentoInput = {
      id: 'doc-101',
      versao: 2,
      titulo: 'A', // Inválido, < 3 caracteres
      descricao: 'Curta', // Inválido, < 10 caracteres
      categoria: '', // Inválido
      tags: [],
      status: 'rascunho'
    };

    const resultado = await atualizarDocumentoAction(input);

    expect(resultado.success).toBe(false);
    if (!resultado.success && resultado.error === 'validacao') {
      expect(resultado.errosCampos).toHaveProperty('titulo');
      expect(resultado.errosCampos).toHaveProperty('descricao');
      expect(resultado.errosCampos).toHaveProperty('categoria');
    } else {
      expect.fail('Deveria ter retornado erro de validação');
    }
  });
});
