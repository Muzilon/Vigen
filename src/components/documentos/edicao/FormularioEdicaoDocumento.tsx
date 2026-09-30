'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import styles from './FormularioEdicao.module.css';
import type {
  DocumentoEdicao,
  AtualizarDocumentoInput,
  AtualizarDocumentoResult,
  StatusDocumento
} from './types';
import { atualizarDocumentoAction } from './server-action';

export interface FormularioEdicaoDocumentoProps {
  /** Documento inicial pré-preenchido para edição */
  documentoInicial?: DocumentoEdicao | null;
  /** Identificador do documento (caso necessite carregar sob demanda) */
  documentoId?: string;
  /** Server Action para atualização (permite injeção de dependência ou teste) */
  serverAction?: (input: AtualizarDocumentoInput) => Promise<AtualizarDocumentoResult>;
  /** Callback executado ao salvar com sucesso */
  onSalvoComSucesso?: (documento: DocumentoEdicao) => void;
  /** Callback de cancelamento */
  onCancelar?: () => void;
}

export const FormularioEdicaoDocumento: React.FC<FormularioEdicaoDocumentoProps> = ({
  documentoInicial = null,
  documentoId,
  serverAction = atualizarDocumentoAction,
  onSalvoComSucesso,
  onCancelar
}) => {
  // ==========================================================================
  // Estados Locais
  // ==========================================================================
  const [documento, setDocumento] = useState<DocumentoEdicao | null>(documentoInicial);
  const [estaCarregandoInicial, setEstaCarregandoInicial] = useState<boolean>(!documentoInicial && !!documentoId);
  const [isPending, startTransition] = useTransition();

  // Estados dos campos do formulário
  const [titulo, setTitulo] = useState<string>(documentoInicial?.titulo || '');
  const [categoria, setCategoria] = useState<string>(documentoInicial?.categoria || 'Segurança');
  const [descricao, setDescricao] = useState<string>(documentoInicial?.descricao || '');
  const [tags, setTags] = useState<string[]>(documentoInicial?.tags || []);
  const [novaTag, setNovaTag] = useState<string>('');
  const [statusDoc, setStatusDoc] = useState<StatusDocumento>(documentoInicial?.status || 'rascunho');

  // Estados de Feedback e Erro
  const [errosValidacao, setErrosValidacao] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Estado crítico de Conflito de Versão (Optimistic Concurrency Control)
  const [conflitoDetectado, setConflitoDetectado] = useState<{
    ativo: boolean;
    mensagem: string;
    versaoServidor?: number;
    documentoServidor?: DocumentoEdicao;
  } | null>(null);

  // Estado Offline (Conectividade em tempo real)
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      return !window.navigator.onLine;
    }
    return false;
  });

  // ==========================================================================
  // Efeito: Monitoramento de Conexão Offline
  // ==========================================================================
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ==========================================================================
  // Efeito: Atualização com documentoInicial recebido
  // ==========================================================================
  useEffect(() => {
    if (documentoInicial) {
      setDocumento(documentoInicial);
      setTitulo(documentoInicial.titulo);
      setCategoria(documentoInicial.categoria);
      setDescricao(documentoInicial.descricao);
      setTags(documentoInicial.tags || []);
      setStatusDoc(documentoInicial.status);
      setEstaCarregandoInicial(false);
    }
  }, [documentoInicial]);

  // ==========================================================================
  // Manipulação de Tags
  // ==========================================================================
  const handleAdicionarTag = useCallback(() => {
    const tagTratada = novaTag.trim().toLowerCase();
    if (tagTratada && !tags.includes(tagTratada)) {
      setTags((prev) => [...prev, tagTratada]);
      setNovaTag('');
    }
  }, [novaTag, tags]);

  const handleRemoverTag = useCallback((tagParaRemover: string) => {
    setTags((prev) => prev.filter((t) => t !== tagParaRemover));
  }, []);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdicionarTag();
    }
  };

  // ==========================================================================
  // Validação Client-Side
  // ==========================================================================
  const validarCampos = (): boolean => {
    const novosErros: Record<string, string> = {};

    if (!titulo.trim()) {
      novosErros.titulo = 'O título do documento é obrigatório.';
    } else if (titulo.trim().length < 3) {
      novosErros.titulo = 'O título deve ter pelo menos 3 caracteres.';
    }

    if (!categoria) {
      novosErros.categoria = 'Por favor, selecione uma categoria.';
    }

    if (!descricao.trim()) {
      novosErros.descricao = 'A descrição do documento é obrigatória.';
    } else if (descricao.trim().length < 10) {
      novosErros.descricao = 'A descrição deve conter no mínimo 10 caracteres explicativos.';
    }

    setErrosValidacao(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  // ==========================================================================
  // Submissão do Formulário (Consumo da Server Action)
  // ==========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Limpar estados de feedback anteriores
    setErroGeral(null);
    setMensagemSucesso(null);
    setConflitoDetectado(null);

    // Validação de conectividade
    if (isOffline) {
      setErroGeral('Você está offline. Conecte-se à internet para salvar as alterações.');
      return;
    }

    if (!documento) {
      setErroGeral('Nenhum documento ativo para ser atualizado.');
      return;
    }

    if (!validarCampos()) {
      return;
    }

    const payload: AtualizarDocumentoInput = {
      id: documento.id,
      versao: documento.versao, // Versão para optimistic locking
      titulo: titulo.trim(),
      categoria,
      descricao: descricao.trim(),
      tags,
      status: statusDoc
    };

    startTransition(async () => {
      try {
        const resultado = await serverAction(payload);

        if (resultado.success) {
          setDocumento(resultado.documento);
          setTitulo(resultado.documento.titulo);
          setDescricao(resultado.documento.descricao);
          setCategoria(resultado.documento.categoria);
          setTags(resultado.documento.tags);
          setStatusDoc(resultado.documento.status);
          setMensagemSucesso(resultado.message || 'Documento salvo com sucesso!');
          setErrosValidacao({});
          setConflitoDetectado(null);

          if (onSalvoComSucesso) {
            onSalvoComSucesso(resultado.documento);
          }
        } else {
          // Tratamento Crítico de Conflito de Versão
          if (resultado.error === 'conflito_versao') {
            setConflitoDetectado({
              ativo: true,
              mensagem: resultado.message || 'O documento foi modificado por outro usuário.',
              versaoServidor: resultado.versaoServidor,
              documentoServidor: resultado.documentoServidor
            });
          } else if (resultado.error === 'validacao' && resultado.errosCampos) {
            setErrosValidacao(resultado.errosCampos);
            setErroGeral(resultado.message);
          } else {
            setErroGeral(resultado.message || 'Ocorreu um erro ao atualizar o documento.');
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha na comunicação com o servidor.';
        setErroGeral(msg);
      }
    });
  };

  // ==========================================================================
  // Resolução de Conflito: Recarregar dados mais recentes do servidor
  // ==========================================================================
  const handleRecarregarVersaoServidor = () => {
    if (conflitoDetectado?.documentoServidor) {
      const docAtualizado = conflitoDetectado.documentoServidor;
      setDocumento(docAtualizado);
      setTitulo(docAtualizado.titulo);
      setCategoria(docAtualizado.categoria);
      setDescricao(docAtualizado.descricao);
      setTags(docAtualizado.tags || []);
      setStatusDoc(docAtualizado.status);
      setConflitoDetectado(null);
      setErrosValidacao({});
      setErroGeral(null);
      setMensagemSucesso('Dados atualizados com a versão mais recente do servidor.');
    } else {
      // Caso não tenhamos os dados completos em memória, apenas incrementamos a versão base
      if (documento && conflitoDetectado?.versaoServidor) {
        setDocumento({
          ...documento,
          versao: conflitoDetectado.versaoServidor
        });
        setConflitoDetectado(null);
        setMensagemSucesso('Versão sincronizada. Você pode revisar e tentar salvar novamente.');
      }
    }
  };

  // ==========================================================================
  // 1. ESTADO: Carregando (Skeleton / Loading State)
  // ==========================================================================
  if (estaCarregandoInicial) {
    return (
      <section
        className={styles.card}
        aria-busy="true"
        aria-live="polite"
        data-testid="estado-carregando"
      >
        <div className={styles.loadingContainer}>
          <span className={styles.spinnerTeal} aria-hidden="true" />
          <p className={styles.subtitle}>Carregando dados do documento...</p>
          <div className={styles.loadingSkeleton}>
            <div className={styles.skeletonBar} style={{ width: '40%' }} />
            <div className={styles.skeletonBar} style={{ width: '85%' }} />
            <div className={styles.skeletonBox} />
            <div className={styles.skeletonBar} style={{ width: '60%' }} />
          </div>
        </div>
      </section>
    );
  }

  // ==========================================================================
  // 2. ESTADO: Vazio (Empty State)
  // ==========================================================================
  if (!documento) {
    return (
      <section
        className={styles.card}
        role="region"
        aria-label="Documento não encontrado"
        data-testid="estado-vazio"
      >
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h2 className={styles.emptyTitle}>Nenhum documento selecionado</h2>
          <p className={styles.emptyDescription}>
            Não foi possível carregar os dados para edição. Verifique se o identificador do
            documento é válido ou se ele foi removido.
          </p>
          {onCancelar && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onCancelar}
            >
              Voltar para lista
            </button>
          )}
        </div>
      </section>
    );
  }

  // ==========================================================================
  // Renderização Principal do Formulário
  // ==========================================================================
  return (
    <article className={styles.card} aria-labelledby="form-edicao-titulo">
      {/* 3. ESTADO: Offline Banner */}
      {isOffline && (
        <div
          className={styles.bannerOffline}
          role="status"
          aria-live="polite"
          data-testid="banner-offline"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>
            <strong>Modo Offline:</strong> Você está sem conexão com a internet. As alterações
            serão salvas assim que a conexão for reestabelecida.
          </span>
        </div>
      )}

      {/* 4. ESTADO CRÍTICO: Conflito de Versão */}
      {conflitoDetectado?.ativo && (
        <div
          className={styles.bannerConflict}
          role="alert"
          aria-live="assertive"
          data-testid="banner-conflito"
        >
          <div className={styles.bannerConflictHeader}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h3 className={styles.bannerConflictTitle}>Conflito de Versão Detectado</h3>
          </div>
          <p className={styles.bannerConflictBody}>
            <strong>O documento foi modificado por outro usuário.</strong> Sua versão local era a{' '}
            <code>v{documento.versao}</code>, enquanto o servidor possui atualizações mais
            recentes {conflitoDetectado.versaoServidor && `(v${conflitoDetectado.versaoServidor})`}.
            Para evitar perda de informações, recarregue a versão mais recente antes de salvar.
          </p>
          <div className={styles.bannerConflictActions}>
            <button
              type="button"
              className={styles.btnConflictReload}
              onClick={handleRecarregarVersaoServidor}
            >
              Recarregar Versão Mais Recente
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setConflitoDetectado(null)}
            >
              Manter Meus Dados e Revisar
            </button>
          </div>
        </div>
      )}

      {/* 5. ESTADO: Erro Geral */}
      {erroGeral && !conflitoDetectado?.ativo && (
        <div
          className={styles.bannerError}
          role="alert"
          aria-live="assertive"
          data-testid="banner-erro"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong>Erro na operação:</strong> {erroGeral}
          </div>
        </div>
      )}

      {/* 6. ESTADO: Sucesso */}
      {mensagemSucesso && (
        <div
          className={styles.bannerSuccess}
          role="status"
          aria-live="polite"
          data-testid="banner-sucesso"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {/* Cabeçalho do Formulário */}
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 id="form-edicao-titulo" className={styles.title}>
            Edição de Documento
          </h1>
          <p className={styles.subtitle}>
            Atualize as informações do documento com controle de integridade e concorrência.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={styles.versionBadge} title="Versão atual do registro">
            Versão v{documento.versao}
          </span>
        </div>
      </header>

      {/* Formulário com Dados Pré-preenchidos */}
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {/* Painel de Metadados do Registro */}
        <section className={styles.metadataPanel} aria-label="Metadados do documento">
          <div className={styles.metadataItem}>
            <span className={styles.metadataKey}>ID:</span>
            <code>{documento.id}</code>
          </div>
          {documento.autor && (
            <div className={styles.metadataItem}>
              <span className={styles.metadataKey}>Autor original:</span>
              <span>{documento.autor}</span>
            </div>
          )}
          {documento.atualizadoEm && (
            <div className={styles.metadataItem}>
              <span className={styles.metadataKey}>Última alteração:</span>
              <span>{new Date(documento.atualizadoEm).toLocaleString('pt-BR')}</span>
            </div>
          )}
        </section>

        {/* Linha: Título do Documento */}
        <div className={styles.fieldGroup}>
          <label htmlFor="campo-titulo" className={styles.label}>
            Título do Documento
            <span className={styles.requiredMark} aria-hidden="true">*</span>
          </label>
          <input
            id="campo-titulo"
            type="text"
            className={`${styles.input} ${errosValidacao.titulo ? styles.inputError : ''}`}
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value);
              if (errosValidacao.titulo) {
                setErrosValidacao((prev) => {
                  const { titulo: _, ...rest } = prev;
                  return rest;
                });
              }
            }}
            placeholder="Ex: Diretrizes de Segurança da Informação"
            aria-required="true"
            aria-invalid={!!errosValidacao.titulo}
            aria-describedby={errosValidacao.titulo ? 'erro-campo-titulo' : undefined}
            disabled={isPending}
          />
          {errosValidacao.titulo && (
            <p id="erro-campo-titulo" className={styles.errorText} role="alert">
              {errosValidacao.titulo}
            </p>
          )}
        </div>

        {/* Linha dupla: Categoria e Status */}
        <div className={styles.fieldRow}>
          <div className={styles.fieldGroup}>
            <label htmlFor="campo-categoria" className={styles.label}>
              Categoria
              <span className={styles.requiredMark} aria-hidden="true">*</span>
            </label>
            <select
              id="campo-categoria"
              className={`${styles.select} ${errosValidacao.categoria ? styles.inputError : ''}`}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              aria-required="true"
              aria-invalid={!!errosValidacao.categoria}
              aria-describedby={errosValidacao.categoria ? 'erro-campo-categoria' : undefined}
              disabled={isPending}
            >
              <option value="Segurança">Segurança</option>
              <option value="Engenharia">Engenharia</option>
              <option value="Compliance">Compliance</option>
              <option value="Operações">Operações</option>
              <option value="Design">Design</option>
            </select>
            {errosValidacao.categoria && (
              <p id="erro-campo-categoria" className={styles.errorText} role="alert">
                {errosValidacao.categoria}
              </p>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="campo-status" className={styles.label}>
              Status do Ciclo de Vida
            </label>
            <select
              id="campo-status"
              className={styles.select}
              value={statusDoc}
              onChange={(e) => setStatusDoc(e.target.value as StatusDocumento)}
              disabled={isPending}
            >
              <option value="rascunho">Rascunho</option>
              <option value="revisao">Em Revisão</option>
              <option value="publicado">Publicado</option>
              <option value="arquivado">Arquivado</option>
            </select>
            <p className={styles.helperText}>
              Documentos publicados ficam visíveis para toda a equipe.
            </p>
          </div>
        </div>

        {/* Linha: Descrição / Conteúdo */}
        <div className={styles.fieldGroup}>
          <label htmlFor="campo-descricao" className={styles.label}>
            Descrição Detalhada
            <span className={styles.requiredMark} aria-hidden="true">*</span>
          </label>
          <textarea
            id="campo-descricao"
            className={`${styles.textarea} ${errosValidacao.descricao ? styles.inputError : ''}`}
            value={descricao}
            onChange={(e) => {
              setDescricao(e.target.value);
              if (errosValidacao.descricao) {
                setErrosValidacao((prev) => {
                  const { descricao: _, ...rest } = prev;
                  return rest;
                });
              }
            }}
            placeholder="Insira a descrição detalhada ou escopo das diretrizes..."
            rows={4}
            aria-required="true"
            aria-invalid={!!errosValidacao.descricao}
            aria-describedby={errosValidacao.descricao ? 'erro-campo-descricao' : undefined}
            disabled={isPending}
          />
          {errosValidacao.descricao ? (
            <p id="erro-campo-descricao" className={styles.errorText} role="alert">
              {errosValidacao.descricao}
            </p>
          ) : (
            <p className={styles.helperText}>
              Mínimo de 10 caracteres explicativos sobre o conteúdo deste documento.
            </p>
          )}
        </div>

        {/* Linha: Tags / Palavras-chave */}
        <div className={styles.fieldGroup}>
          <label htmlFor="campo-nova-tag" className={styles.label}>
            Palavras-chave (Tags)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="campo-nova-tag"
              type="text"
              className={styles.input}
              value={novaTag}
              onChange={(e) => setNovaTag(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Digite uma tag e pressione Adicionar"
              disabled={isPending}
            />
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleAdicionarTag}
              disabled={isPending || !novaTag.trim()}
              aria-label="Adicionar tag digitada"
            >
              Adicionar
            </button>
          </div>
          {tags.length > 0 && (
            <div className={styles.tagList} role="list" aria-label="Tags associadas">
              {tags.map((tag) => (
                <span key={tag} className={styles.tagItem} role="listitem">
                  #{tag}
                  <button
                    type="button"
                    className={styles.tagRemoveBtn}
                    onClick={() => handleRemoverTag(tag)}
                    aria-label={`Remover tag ${tag}`}
                    disabled={isPending}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Barra de Ações: Estados de Carregando / Salvando / Erro */}
        <footer className={styles.actionsBar}>
          {onCancelar && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onCancelar}
              disabled={isPending}
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={isPending || isOffline}
            aria-busy={isPending}
            data-testid="btn-salvar"
          >
            {isPending ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                <span>Salvando alterações...</span>
              </>
            ) : isOffline ? (
              <span>Offline (Aguardando Rede)</span>
            ) : (
              <span>Salvar Alterações</span>
            )}
          </button>
        </footer>
      </form>
    </article>
  );
};

export default FormularioEdicaoDocumento;
