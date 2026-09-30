import { describe, it, expect, beforeEach, vi } from 'vitest';
import { anexarArquivoAction, getDb, resetDb } from './anexarArquivoAction';

// Mock fetch
global.fetch = vi.fn();

describe('anexarArquivoAction', () => {
  beforeEach(() => {
    resetDb();
    process.env.GOOGLE_DRIVE_WEBHOOK_URL = 'https://mock.webhook.com';
    process.env.GOOGLE_DRIVE_WEBHOOK_TOKEN = 'mock-token';
    vi.resetAllMocks();
  });

  it('deve exigir justificativa válida com no mínimo 10 caracteres', async () => {
    const result = await anexarArquivoAction({
      fileName: 'test.pdf',
      base64Data: 'base64...',
      documentoId: 'doc-123',
      justificativa: ''
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('A justificativa é obrigatória e deve ter no mínimo 10 caracteres.');
  });

  it('deve salvar anexo novo via application/x-www-form-urlencoded e registrar evento ANEXO no historico', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ fileId: 'drive-id-123' })
    });

    const result = await anexarArquivoAction({
      fileName: 'test.pdf',
      base64Data: 'base64...',
      documentoId: 'doc-123',
      justificativa: 'Primeiro anexo com justificativa completa'
    });

    expect(result.success).toBe(true);
    expect(result.fileId).toBe('drive-id-123');

    // Verifica chamada do fetch
    expect(global.fetch).toHaveBeenCalledWith('https://mock.webhook.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        token: 'mock-token',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        fileData: 'base64...'
      }).toString()
    });

    const db = getDb();
    expect(db.files).toHaveLength(1);
    expect(db.files[0].fileId).toBe('drive-id-123');

    expect(db.history).toHaveLength(1);
    expect(db.history[0].eventType).toBe('ANEXO');
    expect(db.history[0].payload.justificativa).toBe('Primeiro anexo com justificativa completa');
  });

  it('deve salvar nova versao e registrar evento NOVA_VERSAO_ARQUIVO', async () => {
    // Setup initial file
    const db = getDb();
    db.files.push({ documentId: 'doc-123', fileName: 'test.pdf', fileId: 'old-id' });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ fileId: 'drive-id-456' })
    });

    const result = await anexarArquivoAction({
      fileName: 'test.pdf',
      base64Data: 'base64...',
      documentoId: 'doc-123',
      justificativa: 'Corrigindo erro na pagina 2'
    });

    expect(result.success).toBe(true);
    expect(db.files).toHaveLength(1);
    expect(db.files[0].fileId).toBe('drive-id-456');

    expect(db.history).toHaveLength(1);
    expect(db.history[0].eventType).toBe('NOVA_VERSAO_ARQUIVO');
    expect(db.history[0].payload.justificativa).toBe('Corrigindo erro na pagina 2');
  });

  it('deve falhar a action e não criar mock-id quando webhook retornar objeto com erro', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'Token inválido ou não autorizado' })
    });

    const result = await anexarArquivoAction({
      fileName: 'falha.pdf',
      base64Data: 'base64...',
      documentoId: 'doc-123',
      justificativa: 'Justificativa de teste com erro'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Token inválido ou não autorizado');
    expect(result.fileId).toBeUndefined();

    // Garante que nenhum mock-id foi gerado e registrado no banco
    const db = getDb();
    expect(db.files).toHaveLength(0);
    expect(db.history).toHaveLength(0);
  });
});
