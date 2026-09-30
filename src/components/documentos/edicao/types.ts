/**
 * F6 - Tipos e Contratos para Edição de Documento
 * Suporte a Concorrência Otimista (Optimistic Locking) e Estados do Vigen Design System
 */

export type StatusDocumento = 'rascunho' | 'revisao' | 'publicado' | 'arquivado';

export interface DocumentoEdicao {
  id: string;
  versao: number; // Controle de concorrência otimista
  titulo: string;
  descricao: string;
  categoria: string;
  tags: string[];
  status: StatusDocumento;
  autor?: string;
  atualizadoEm?: string;
}

export interface AtualizarDocumentoInput {
  id: string;
  versao: number; // A versão com a qual o usuário abriu o formulário
  titulo: string;
  descricao: string;
  categoria: string;
  tags: string[];
  status: StatusDocumento;
}

export type AtualizarDocumentoResult =
  | {
      success: true;
      documento: DocumentoEdicao;
      message: string;
    }
  | {
      success: false;
      error: 'conflito_versao';
      message: string; // Ex: "O documento foi modificado por outro usuário."
      versaoServidor: number;
      documentoServidor?: DocumentoEdicao;
    }
  | {
      success: false;
      error: 'validacao';
      message: string;
      errosCampos?: Record<string, string>;
    }
  | {
      success: false;
      error: 'nao_encontrado' | 'permissao' | 'erro_interno' | 'offline';
      message: string;
    };
