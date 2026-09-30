// We'll just use process.env for simplicity in the scratch file.

export interface AnexarArquivoInput {
  fileName: string;
  base64Data: string;
  documentoId: string;
  justificativa: string;
}

export interface AnexarArquivoResult {
  success: boolean;
  fileId?: string;
  error?: string;
}

// Mocking db functions
const db = {
  files: [] as any[],
  history: [] as any[]
};

export async function anexarArquivoAction(input: AnexarArquivoInput): Promise<AnexarArquivoResult> {
  const { fileName, base64Data, documentoId, justificativa } = input;

  if (!justificativa || justificativa.trim().length < 10) {
    return { success: false, error: 'A justificativa é obrigatória e deve ter no mínimo 10 caracteres.' };
  }
  
  if (!fileName || !base64Data || !documentoId) {
    return { success: false, error: 'Dados incompletos.' };
  }

  const webhookUrl = process.env.GOOGLE_DRIVE_WEBHOOK_URL;
  const webhookToken = process.env.GOOGLE_DRIVE_WEBHOOK_TOKEN;

  if (!webhookUrl || !webhookToken) {
    return { success: false, error: 'Configuração do Google Drive ausente.' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        token: webhookToken,
        fileName: fileName,
        mimeType: 'application/pdf',
        fileData: base64Data
      }).toString()
    });

    if (!response.ok) {
      return { success: false, error: 'Falha ao salvar no Google Drive.' };
    }

    const data = await response.json();
    if (data.error) {
      return { success: false, error: typeof data.error === 'string' ? data.error : JSON.stringify(data.error) };
    }

    const driveFileId = data.fileId;
    if (!driveFileId) {
      return { success: false, error: 'Falha ao salvar no Google Drive: ID do arquivo não retornado.' };
    }

    // Check if file already exists for this document with the same name
    const existingFile = db.files.find(f => f.documentId === documentoId && f.fileName === fileName);
    
    let eventType = 'ANEXO';
    if (existingFile) {
      eventType = 'NOVA_VERSAO_ARQUIVO';
      existingFile.fileId = driveFileId;
    } else {
      db.files.push({ documentId: documentoId, fileName, fileId: driveFileId });
    }

    db.history.push({
      documentId: documentoId,
      eventType,
      payload: {
        fileId: driveFileId,
        fileName,
        justificativa
      },
      timestamp: new Date().toISOString()
    });

    return { success: true, fileId: driveFileId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Helper to inspect DB in tests
export function getDb() {
  return db;
}
export function resetDb() {
  db.files = [];
  db.history = [];
}
