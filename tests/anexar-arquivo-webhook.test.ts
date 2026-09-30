import { describe, it, expect, beforeEach, vi } from 'vitest';
import { anexarArquivoAction, getDb, resetDb } from '@/components/anexos/upload/anexarArquivoAction';

// Mock fetch
global.fetch = vi.fn();

describe('anexarArquivoAction - Webhook Google Drive', () => {
  beforeEach(() => {
    resetDb();
    process.env.GOOGLE_DRIVE_WEBHOOK_URL = 'https://script.google.com/macros/s/test/exec';
    process.env.GOOGLE_DRIVE_WEBHOOK_TOKEN = 'test-token-123';
    vi.resetAllMocks();
  });

  it('deve enviar parâmetros via application/x-www-form-urlencoded com URLSearchParams', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ fileId: 'drive-file-id-abc' })
    });

    const result = await anexarArquivoAction({
      fileName: 'relatorio.pdf',
      base64Data: 'JVBERi0xLjQK...',
      documentoId: 'doc-999',
      justificativa: 'Upload de anexo de medição de obra'
    });

    expect(result.success).toBe(true);
    expect(result.fileId).toBe('drive-file-id-abc');

    expect(global.fetch).toHaveBeenCalledWith('https://script.google.com/macros/s/test/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        token: 'test-token-123',
        fileName: 'relatorio.pdf',
        mimeType: 'application/pdf',
        fileData: 'JVBERi0xLjQK...'
      }).toString()
    });

    const db = getDb();
    expect(db.files).toHaveLength(1);
    expect(db.files[0]).toEqual({
      documentId: 'doc-999',
      fileName: 'relatorio.pdf',
      fileId: 'drive-file-id-abc'
    });
  });

  it('deve falhar a action e não criar mock-id quando webhook retornar { error: ... }', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'Token inválido ou sem permissão de escrita no Drive' })
    });

    const result = await anexarArquivoAction({
      fileName: 'relatorio.pdf',
      base64Data: 'JVBERi0xLjQK...',
      documentoId: 'doc-999',
      justificativa: 'Upload de anexo com falha simulada'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Token inválido ou sem permissão de escrita no Drive');
    expect(result.fileId).toBeUndefined();

    // Valida que NENHUM registro nem mock-id foi salvo no banco em memória
    const db = getDb();
    expect(db.files).toHaveLength(0);
    expect(db.history).toHaveLength(0);
  });

  it('deve falhar se a resposta não trouxer fileId e não criar mock-id', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    const result = await anexarArquivoAction({
      fileName: 'relatorio.pdf',
      base64Data: 'JVBERi0xLjQK...',
      documentoId: 'doc-999',
      justificativa: 'Upload de anexo sem fileId de retorno'
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ID do arquivo/);
    expect(result.fileId).toBeUndefined();

    const db = getDb();
    expect(db.files).toHaveLength(0);
    expect(db.history).toHaveLength(0);
  });
});
