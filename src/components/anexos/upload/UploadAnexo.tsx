'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './UploadAnexo.module.css';

/**
 * Payload estruturado enviado para a Server Action
 */
export interface UploadAnexoPayload {
  fileName: string;
  fileSize: number;
  mimeType: string;
  base64Data: string;
  justificativa: string;
  documentoId?: string;
  versaoAnteriorId?: string;
  timestamp: string;
}

/**
 * Resposta padrão retornada pela Server Action
 */
export interface UploadAnexoResult {
  success: boolean;
  message?: string;
  anexoId?: string;
  versao?: number;
  error?: string;
}

/**
 * Propriedades do componente UploadAnexo
 */
export interface F7UploadAnexoProps {
  documentoId?: string;
  versaoAnteriorId?: string;
  maxSizeBytes?: number; // Padrão: 15MB
  acceptedFormats?: string[]; // Extensões aceitas
  serverAction?: (payload: UploadAnexoPayload) => Promise<UploadAnexoResult>;
  onSuccess?: (result: UploadAnexoResult) => void;
  onError?: (error: string) => void;
  initialOffline?: boolean;
}

/**
 * Converte um arquivo do cliente para representação Base64 (DataURL)
 */
export const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64Pure = reader.result.replace(/^data:.*?;base64,/, '');
        resolve(base64Pure);
      } else {
        reject(new Error('Falha ao processar arquivo em Base64.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Erro na leitura do arquivo local.'));
    };
  });
};

/**
 * Formata bytes em formato legível (KB, MB)
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Server Action Padrão (Fallback quando nenhuma ação externa for fornecida)
 */
const defaultServerAction = async (payload: UploadAnexoPayload): Promise<UploadAnexoResult> => {
  // Simulação de chamada de Server Action com latência de rede
  await new Promise((resolve) => setTimeout(resolve, 1200));

  if (!payload.base64Data || !payload.fileName) {
    return {
      success: false,
      error: 'Arquivo inválido ou corrompido durante o processamento.',
    };
  }

  if (payload.justificativa.trim().length < 10) {
    return {
      success: false,
      error: 'A justificativa informada é insuficiente (mínimo de 10 caracteres).',
    };
  }

  return {
    success: true,
    message: `Anexo "${payload.fileName}" registrado com sucesso como nova versão.`,
    anexoId: `anx-${Date.now()}`,
    versao: 2,
  };
};

/**
 * Componente UploadAnexo
 * Vigen Design System - Fatia F7 (Anexos e Versões)
 * Atende estados: Vazio, Carregando, Erro, Offline e Sucesso.
 */
export const F7UploadAnexo: React.FC<F7UploadAnexoProps> = ({
  documentoId = 'DOC-2026-F7',
  versaoAnteriorId,
  maxSizeBytes = 15 * 1024 * 1024, // 15MB
  acceptedFormats = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.xlsx'],
  serverAction = defaultServerAction,
  onSuccess,
  onError,
  initialOffline = false,
}) => {
  // Estados do Componente
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [justificativa, setJustificativa] = useState<string>('');
  const [justificativaTouched, setJustificativaTouched] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<UploadAnexoResult | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(
    initialOffline || (typeof navigator !== 'undefined' ? !navigator.onLine : false)
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monitoramento de Conexão Offline / Online
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  // Validação da Justificativa
  const trimmedJustificativa = justificativa.trim();
  const isJustificativaValid = trimmedJustificativa.length >= 10;
  const showJustificativaError = justificativaTouched && !isJustificativaValid;

  // Validação Geral para Habilitar o Envio
  const isSubmitDisabled =
    !selectedFile || !isJustificativaValid || isLoading || isOffline;

  // Limpeza de erros ao alterar entradas
  const handleClearErrors = useCallback(() => {
    if (errorMessage) setErrorMessage(null);
  }, [errorMessage]);

  // Validação do Arquivo Selecionado
  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeBytes) {
      return `O arquivo selecionado excede o limite máximo de ${formatFileSize(maxSizeBytes)}.`;
    }

    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const isAccepted = acceptedFormats.some((fmt) => fmt.toLowerCase() === fileExt);
    if (!isAccepted) {
      return `Formato de arquivo não suportado. Extensões aceitas: ${acceptedFormats.join(', ')}.`;
    }

    return null;
  };

  // Processamento de seleção de arquivo
  const handleSelectFile = (file: File) => {
    handleClearErrors();
    const error = validateFile(file);
    if (error) {
      setErrorMessage(error);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setSuccessResult(null);
  };

  // Handlers do Dropzone
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading && !isOffline) {
      setIsDragging(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading && !isOffline) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isLoading || isOffline) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleSelectFile(droppedFile);
    }
  };

  // Ativação da Dropzone pelo teclado (Acessibilidade WCAG)
  const handleDropzoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isLoading || isOffline) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  // Remoção de arquivo selecionado
  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    handleClearErrors();
  };

  // Reset Completo do Formulário
  const handleReset = () => {
    setSelectedFile(null);
    setJustificativa('');
    setJustificativaTouched(false);
    setErrorMessage(null);
    setSuccessResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Envio / Server Action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJustificativaTouched(true);

    if (!selectedFile) {
      setErrorMessage('Por favor, selecione ou arraste um arquivo para envio.');
      return;
    }

    if (!isJustificativaValid) {
      setErrorMessage('A justificativa deve conter no mínimo 10 caracteres.');
      return;
    }

    if (isOffline) {
      setErrorMessage('Sem conexão com a internet. Não é possível enviar o arquivo offline.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Conversão em Base64 no lado do cliente
      const base64Data = await convertFileToBase64(selectedFile);

      // 2. Construção do Payload
      const payload: UploadAnexoPayload = {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type || 'application/octet-stream',
        base64Data,
        justificativa: trimmedJustificativa,
        documentoId,
        versaoAnteriorId,
        timestamp: new Date().toISOString(),
      };

      // 3. Invocação da Server Action
      const result = await serverAction(payload);

      if (result.success) {
        setSuccessResult(result);
        onSuccess?.(result);
      } else {
        const errorText = result.error || 'Falha ao processar o upload do anexo.';
        setErrorMessage(errorText);
        onError?.(errorText);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Erro inesperado durante a conversão ou envio do anexo.';
      setErrorMessage(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      className={styles.container}
      aria-labelledby="upload-title"
      aria-busy={isLoading}
      data-testid="upload-container"
    >
      {/* Cabeçalho */}
      <header className={styles.header}>
        <h2 id="upload-title" className={styles.title}>
          Upload de Novo Anexo e Versão
        </h2>
        <p className={styles.subtitle}>
          Adicione um documento comprobatório informando obrigatoriamente a justificativa da alteração.
        </p>
      </header>

      {/* ESTADO OFFLINE */}
      {isOffline && (
        <div
          className={styles.offlineBanner}
          role="status"
          aria-live="polite"
          data-testid="offline-banner"
        >
          <span className={styles.offlineIcon} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"></line>
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
              <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
              <line x1="12" y1="20" x2="12.01" y2="20"></line>
            </svg>
          </span>
          <span>
            <strong>Você está offline.</strong> As alterações e envios serão bloqueados até que sua conexão seja restabelecida.
          </span>
        </div>
      )}

      {/* ESTADO DE SUCESSO */}
      {successResult && (
        <div
          className={`${styles.feedbackBanner} ${styles.feedbackSuccess}`}
          role="alert"
          data-testid="success-banner"
        >
          <div className={styles.feedbackText}>
            <p className={styles.feedbackTitle}>Anexo enviado com sucesso!</p>
            <p className={styles.feedbackDesc}>
              {successResult.message || 'O arquivo foi registrado e vinculado à nova versão.'}
            </p>
          </div>
          <button
            type="button"
            className={styles.feedbackDismissButton}
            onClick={() => setSuccessResult(null)}
            aria-label="Fechar notificação de sucesso"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}

      {/* ESTADO DE ERRO */}
      {errorMessage && (
        <div
          className={`${styles.feedbackBanner} ${styles.feedbackError}`}
          role="alert"
          aria-live="assertive"
          data-testid="error-banner"
        >
          <div className={styles.feedbackText}>
            <p className={styles.feedbackTitle}>Atenção</p>
            <p className={styles.feedbackDesc}>{errorMessage}</p>
          </div>
          <button
            type="button"
            className={styles.feedbackDismissButton}
            onClick={() => setErrorMessage(null)}
            aria-label="Fechar mensagem de erro"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* ÁREA DROPZONE (Arrastar e Soltar) */}
        <div
          className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''} ${
            isLoading || isOffline ? styles.dropzoneDisabled : ''
          }`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && !isOffline && fileInputRef.current?.click()}
          onKeyDown={handleDropzoneKeyDown}
          tabIndex={isLoading || isOffline ? -1 : 0}
          role="button"
          aria-label={
            selectedFile
              ? `Arquivo selecionado: ${selectedFile.name}. Pressione Enter para substituir o arquivo.`
              : 'Área para envio de anexo. Arraste e solte o arquivo aqui ou pressione Enter para selecionar de seu dispositivo.'
          }
          data-testid="dropzone"
        >
          <input
            ref={fileInputRef}
            type="file"
            className={styles.hiddenInput}
            accept={acceptedFormats.join(',')}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleSelectFile(e.target.files[0]);
              }
            }}
            disabled={isLoading || isOffline}
            tabIndex={-1}
            aria-hidden="true"
            data-testid="file-input"
          />

          {/* ESTADO VAZIO DA DROPZONE */}
          {!selectedFile ? (
            <div className={styles.dropzoneEmptyContent} data-testid="dropzone-empty">
              <div className={styles.uploadIconWrapper} aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <p className={styles.dropzonePrompt}>
                <span className={styles.dropzonePromptAction}>Clique para escolher</span> ou arraste o arquivo até aqui
              </p>
              <p className={styles.dropzoneHints}>
                Formatos permitidos: {acceptedFormats.join(', ')} (Máx. {formatFileSize(maxSizeBytes)})
              </p>
            </div>
          ) : (
            /* PREVIEW DO ARQUIVO SELECIONADO */
            <div
              className={styles.fileCard}
              onClick={(e) => e.stopPropagation()}
              data-testid="file-card"
            >
              <div className={styles.fileCardInfo}>
                <div className={styles.fileCardIcon} aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <div className={styles.fileCardMeta}>
                  <p className={styles.fileName} title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className={styles.fileSize}>{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <div className={styles.fileCardActions}>
                <button
                  type="button"
                  className={styles.removeFileButton}
                  onClick={handleRemoveFile}
                  disabled={isLoading}
                  aria-label={`Remover arquivo ${selectedFile.name}`}
                  data-testid="remove-file-button"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CAMPO DE JUSTIFICATIVA OBRIGATÓRIA */}
        <div className={styles.fieldGroup} style={{ marginTop: 'var(--vigen-space-5)' }}>
          <div className={styles.labelWrapper}>
            <label htmlFor="justificativa" className={styles.label}>
              Justificativa da Versão <span className={styles.required}>*</span>
            </label>
            <span
              id="justificativa-counter"
              className={`${styles.charCounter} ${
                trimmedJustificativa.length >= 10 ? styles.charCounterValid : styles.charCounterInvalid
              }`}
              aria-live="polite"
            >
              {trimmedJustificativa.length}/10 caracteres mínimos
            </span>
          </div>

          <textarea
            id="justificativa"
            name="justificativa"
            className={`${styles.textarea} ${showJustificativaError ? styles.textareaInvalid : ''}`}
            placeholder="Descreva o motivo desta nova versão ou inclusão de anexo (mínimo de 10 caracteres)..."
            value={justificativa}
            onChange={(e) => {
              setJustificativa(e.target.value);
              handleClearErrors();
            }}
            onBlur={() => setJustificativaTouched(true)}
            disabled={isLoading || isOffline}
            aria-required="true"
            aria-invalid={showJustificativaError}
            aria-describedby="justificativa-hint justificativa-counter"
            data-testid="justificativa-input"
          />

          <p id="justificativa-hint" className={styles.fieldHint}>
            A justificativa é registrada permanentemente no histórico de auditoria do documento.
          </p>

          {showJustificativaError && (
            <p className={styles.fieldError} role="alert" data-testid="justificativa-error">
              A justificativa deve conter pelo menos 10 caracteres. Faltam{' '}
              {10 - trimmedJustificativa.length} caractere(s).
            </p>
          )}
        </div>

        {/* ESTADO CARREGANDO (VISUAL STATUS) */}
        {isLoading && (
          <div
            className={styles.loadingContainer}
            role="status"
            aria-live="polite"
            style={{ marginTop: 'var(--vigen-space-4)' }}
            data-testid="loading-indicator"
          >
            <span className={styles.spinner} aria-hidden="true" />
            <span>Processando arquivo em Base64 e registrando versão...</span>
          </div>
        )}

        {/* AÇÕES E BOTÕES */}
        <div className={styles.actions}>
          {(selectedFile || justificativa.length > 0) && (
            <button
              type="button"
              className={styles.resetButton}
              onClick={handleReset}
              disabled={isLoading}
              data-testid="reset-button"
            >
              Limpar
            </button>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitDisabled}
            aria-disabled={isSubmitDisabled}
            data-testid="submit-button"
          >
            {isLoading ? (
              <>
                <span className={styles.buttonSpinner} aria-hidden="true" />
                <span>Enviando...</span>
              </>
            ) : (
              'Enviar Anexo'
            )}
          </button>
        </div>
      </form>
    </section>
  );
};

export const UploadAnexo = F7UploadAnexo;
export default F7UploadAnexo;
