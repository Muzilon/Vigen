'use server';

import { prismaAdmin as prisma } from '@/lib/prisma';
import { AcaoHistoricoDocumento } from '@prisma/client';

export type EditarDocumentoInput = {
  id: string;
  empresaId: string;
  usuarioId: string;
  versao: number;
  titulo?: string;
  descricao?: string;
  processoId?: string | null;
  obraId?: string | null;
  setorId?: string | null;
  responsavelId?: string;
};

export async function editarDocumentoAction(input: EditarDocumentoInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const documento = await tx.documento.findUnique({
        where: { id: input.id },
      });

      if (!documento) {
        return { error: 'nao_encontrado', message: 'Documento não encontrado.' };
      }

      if (documento.empresaId !== input.empresaId) {
        return { error: 'acesso_negado', message: 'Acesso negado.' };
      }

      if (documento.versao !== input.versao) {
        return { error: 'conflito_versao', message: 'O documento foi modificado por outra pessoa.' };
      }

      // Preparar os dados alterados
      const dadosAntigos = {
        titulo: documento.titulo,
        descricao: documento.descricao,
        processoId: documento.processoId,
        obraId: documento.obraId,
        setorId: documento.setorId,
        responsavelId: documento.responsavelId,
      };

      const dadosNovos = {
        titulo: input.titulo !== undefined ? input.titulo : documento.titulo,
        descricao: input.descricao !== undefined ? input.descricao : documento.descricao,
        processoId: input.processoId !== undefined ? input.processoId : documento.processoId,
        obraId: input.obraId !== undefined ? input.obraId : documento.obraId,
        setorId: input.setorId !== undefined ? input.setorId : documento.setorId,
        responsavelId: input.responsavelId !== undefined ? input.responsavelId : documento.responsavelId,
      };

      // Atualiza o documento e incrementa a versão
      const documentoAtualizado = await tx.documento.update({
        where: { id: input.id },
        data: {
          ...dadosNovos,
          versao: documento.versao + 1,
        },
      });

      // Registra o histórico
      await tx.historicoDocumento.create({
        data: {
          empresaId: input.empresaId,
          documentoId: input.id,
          usuarioId: input.usuarioId,
          acao: AcaoHistoricoDocumento.EDICAO,
          dados: {
            versao: documentoAtualizado.versao,
            antes: dadosAntigos,
            depois: dadosNovos,
          },
          observacao: 'Edição de dados do documento via action.',
        },
      });

      return { sucesso: true, documento: documentoAtualizado };
    });
  } catch (error) {
    console.error('Erro em editarDocumentoAction:', error);
    return { error: 'erro_interno', message: 'Erro interno ao atualizar o documento.' };
  }
}
