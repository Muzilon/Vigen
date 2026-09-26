/**
 * Seed da Tramitação de Documentos (P4) — Monto: tipos PR/IT/FO/POL/MAN e 8 documentos em estados
 * variados (publicados, em revisão/aprovação, aprovado a publicar, rascunho, obsoleto), com arquivos PDF
 * reais no armazenamento, fluxos de aprovação e 1 política publicada exigindo ciência (ciências parciais).
 * Idempotente: documento cujo código já existe é ignorado.
 */
import type { Prisma, PrismaClient, StatusDocumento, StatusVersaoDocumento } from "@prisma/client";
import { getArmazenamento, montarChave } from "../src/lib/armazenamento";
import { gerarPdfExemplo } from "../scripts/pdf-exemplo";

type Publico = { publicoTodos?: boolean; setorIds?: string[]; obraIds?: string[]; perfilIds?: string[]; usuarioIds?: string[]; exigirCiencia?: boolean };

interface Rev {
  motivo: string;
  status: StatusVersaoDocumento;
  /** Data de publicação (revisões publicadas/obsoletas). */
  em?: string;
  /** Fluxo desta revisão: revisores/aprovadores (e-mails) e quantas assinaturas já foram dadas. */
  fluxo?: { revisores: string[]; aprovadores: string[]; assinadas: number };
}

interface Semente {
  sigla: string;
  titulo: string;
  descricao: string;
  processo?: string;
  obra?: string;
  setor?: string;
  responsavel: string;
  status: StatusDocumento;
  revs: Rev[];
  publico?: Publico;
  ciencias?: string[];
  proximaRevisao?: string;
}

export async function semearDocumentos(prisma: PrismaClient, empresaId: string) {
  const ids = new Map<string, string>();
  for (const u of await prisma.usuario.findMany({ where: { empresaId }, select: { id: true, email: true } })) ids.set(u.email, u.id);
  const uid = (email: string) => ids.get(email) ?? (() => { throw new Error(`usuário ${email}`); })();
  const setor = async (nome: string) => (await prisma.setor.findFirstOrThrow({ where: { empresaId, nome } })).id;
  const obra = async (nome: string) => (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome } })).id;
  const processo = async (codigo: string) => (await prisma.processo.findUniqueOrThrow({ where: { empresaId_codigo: { empresaId, codigo } } })).id;

  const tipos: Record<string, { id: string; periodicidadeRevisaoMeses: number }> = {};
  for (const [sigla, nome, meses] of [
    ["PR", "Procedimento", 24],
    ["IT", "Instrução de trabalho", 12],
    ["FO", "Formulário", 24],
    ["POL", "Política", 36],
    ["MAN", "Manual", 36],
  ] as const) {
    tipos[sigla] = await prisma.tipoDocumentoEmpresa.upsert({
      where: { empresaId_sigla: { empresaId, sigla } },
      update: {},
      create: { empresaId, sigla, nome, periodicidadeRevisaoMeses: meses },
    });
  }

  const qualidade = "qualidade@monto.com.br";
  const admin = "admin@monto.com.br";
  const seg = "seguranca@monto.com.br";
  const amb = "meioambiente@monto.com.br";
  const alfa = await obra("Obra Alfa");

  const S: Semente[] = [
    {
      sigla: "MAN", titulo: "Manual do Sistema de Gestão Integrado", descricao: "Escopo, política, estrutura documental e interação dos processos do SGI (ISO 9001, 14001 e 45001).",
      processo: "PG-02", responsavel: qualidade, status: "PUBLICADO", proximaRevisao: "2028-02-10", publico: { publicoTodos: true },
      revs: [
        { motivo: "Emissão inicial.", status: "OBSOLETA", em: "2024-03-04" },
        { motivo: "Inclusão da ISO 45001 no escopo.", status: "OBSOLETA", em: "2025-01-20" },
        { motivo: "Atualização do mapa de processos e das responsabilidades.", status: "PUBLICADA", em: "2026-02-10" },
      ],
    },
    {
      sigla: "POL", titulo: "Política do Sistema de Gestão Integrado", descricao: "Compromissos da Monto com qualidade, meio ambiente, saúde e segurança.",
      processo: "PG-01", responsavel: admin, status: "PUBLICADO", proximaRevisao: "2029-08-15", publico: { publicoTodos: true, exigirCiencia: true }, ciencias: [admin, qualidade],
      revs: [
        { motivo: "Emissão inicial.", status: "OBSOLETA", em: "2024-02-01" },
        { motivo: "Inclusão do compromisso de consulta e participação dos trabalhadores.", status: "PUBLICADA", em: "2026-08-15" },
      ],
    },
    {
      sigla: "PR", titulo: "Controle de documentos e registros", descricao: "Elaboração, revisão, aprovação, publicação, distribuição e obsolescência de documentos (ISO 9001 7.5).",
      processo: "PG-02", responsavel: qualidade, status: "PUBLICADO", proximaRevisao: "2026-08-31", publico: { setorIds: [await setor("Qualidade")], usuarioIds: [uid(admin)] },
      revs: [{ motivo: "Emissão inicial.", status: "PUBLICADA", em: "2024-08-31" }],
    },
    {
      sigla: "PR", titulo: "Tratamento de não conformidades e ações corretivas", descricao: "Registro de RNC, análise de causa, plano de ação e verificação de eficácia.",
      processo: "PG-02", responsavel: qualidade, status: "EM_APROVACAO",
      revs: [{ motivo: "Emissão inicial.", status: "EM_APROVACAO", fluxo: { revisores: [], aprovadores: [admin], assinadas: 0 } }],
    },
    {
      sigla: "IT", titulo: "Montagem e uso de andaime fachadeiro", descricao: "Sequência de montagem, inspeção diária e liberação do andaime (NR-18/NR-35).",
      processo: "PF-03", obra: "Obra Alfa", setor: "Segurança", responsavel: seg, status: "EM_REVISAO", proximaRevisao: "2026-10-12",
      publico: { obraIds: [alfa], setorIds: [await setor("Segurança")], exigirCiencia: false },
      revs: [
        { motivo: "Emissão inicial.", status: "PUBLICADA", em: "2025-10-12" },
        { motivo: "Inclusão da linha de vida certificada (HIRA H-001).", status: "EM_APROVACAO", fluxo: { revisores: [qualidade], aprovadores: [admin], assinadas: 0 } },
      ],
    },
    {
      sigla: "IT", titulo: "Concretagem de lajes", descricao: "Preparação, lançamento, adensamento e cura do concreto.",
      processo: "PF-03", responsavel: seg, status: "ELABORACAO",
      revs: [{ motivo: "Emissão inicial.", status: "RASCUNHO" }],
    },
    {
      sigla: "FO", titulo: "Checklist de inspeção de andaimes", descricao: "Formulário de inspeção diária do andaime fachadeiro.",
      processo: "PF-03", responsavel: seg, status: "APROVADO",
      revs: [{ motivo: "Emissão inicial.", status: "APROVADA", fluxo: { revisores: [qualidade], aprovadores: [admin], assinadas: 2 } }],
    },
    {
      sigla: "PR", titulo: "Gestão de resíduos da construção civil", descricao: "Substituído pelo PGRCC de cada obra.",
      processo: "PF-03", responsavel: amb, status: "OBSOLETO",
      revs: [{ motivo: "Emissão inicial.", status: "OBSOLETA", em: "2023-05-02" }],
    },
  ];

  const seqPorTipo: Record<string, number> = {};
  const armazenamento = getArmazenamento();
  for (const s of S) {
    const tipo = tipos[s.sigla];
    const seq = (seqPorTipo[s.sigla] = (seqPorTipo[s.sigla] ?? 0) + 1);
    const codigo = `${s.sigla}-${String(seq).padStart(3, "0")}`;
    await prisma.contadorSequencial.upsert({
      where: { empresaId_tipo_ano_subtipo: { empresaId, tipo: "DOCUMENTO", ano: 0, subtipo: tipo.id } },
      update: {},
      create: { empresaId, tipo: "DOCUMENTO", ano: 0, subtipo: tipo.id, ultimoValor: 0 },
    });
    await prisma.contadorSequencial.updateMany({ where: { empresaId, tipo: "DOCUMENTO", ano: 0, subtipo: tipo.id, ultimoValor: { lt: seq } }, data: { ultimoValor: seq } });
    if (await prisma.documento.findUnique({ where: { empresaId_codigo: { empresaId, codigo } } })) continue;

    const responsavelId = uid(s.responsavel);
    const primeiraData = new Date(`${s.revs[0].em ?? "2026-09-20"}T12:00:00.000Z`);
    const doc = await prisma.documento.create({
      data: {
        empresaId, tipoId: tipo.id, sequencia: seq, codigo, titulo: s.titulo, descricao: s.descricao,
        processoId: s.processo ? await processo(s.processo) : null, obraId: s.obra ? await obra(s.obra) : null, setorId: s.setor ? await setor(s.setor) : null,
        responsavelId, status: s.status, periodicidadeRevisaoMeses: tipo.periodicidadeRevisaoMeses,
        proximaRevisaoEm: s.proximaRevisao ? new Date(`${s.proximaRevisao}T00:00:00.000Z`) : null, criadoPorId: responsavelId, criadoEm: primeiraData,
      },
    });
    const hist = (acao: Prisma.HistoricoDocumentoUncheckedCreateInput["acao"], usuarioId: string, criadoEm: Date, versaoId: string | null, observacao: string) =>
      prisma.historicoDocumento.create({ data: { empresaId, documentoId: doc.id, versaoId, acao, observacao, usuarioId, criadoEm } });
    await hist("CRIACAO", responsavelId, primeiraData, null, `${codigo} Rev. 00 — ${s.revs[0].motivo}`);

    let vigenteId: string | null = null;
    for (const [numero, r] of s.revs.entries()) {
      const em = r.em ? new Date(`${r.em}T12:00:00.000Z`) : new Date("2026-09-22T12:00:00.000Z");
      const proxima = s.revs[numero + 1]?.em ? new Date(`${s.revs[numero + 1].em}T12:00:00.000Z`) : null;
      const publicada = r.status === "PUBLICADA" || r.status === "OBSOLETA";
      const rev = String(numero).padStart(2, "0");
      const v = await prisma.versaoDocumento.create({
        data: { empresaId, documentoId: doc.id, numero, motivo: r.motivo, status: "RASCUNHO", elaboradorId: responsavelId, criadoEm: em },
      });
      const bytes = gerarPdfExemplo(`${codigo} Rev. ${rev} - ${s.titulo}`, [s.descricao, `Motivo: ${r.motivo}`, "Monto Construtora - documento controlado (exemplo do seed)."]);
      const nome = `${codigo}_Rev${rev}.pdf`;
      const chave = await armazenamento.salvar(montarChave(empresaId, "DOCUMENTO_VERSAO", nome), bytes, "application/pdf");
      const anexo = await prisma.anexo.create({
        data: { empresaId, entidadeTipo: "DOCUMENTO_VERSAO", entidadeId: v.id, nomeArquivo: nome, mimeType: "application/pdf", tamanhoBytes: bytes.byteLength, chaveArmazenamento: chave, enviadoPorId: responsavelId, criadoEm: em },
      });
      let fluxoId: string | null = null;
      if (r.fluxo) {
        const revisorIds = r.fluxo.revisores.map(uid);
        const aprovadorIds = r.fluxo.aprovadores.map(uid);
        const todos = [...revisorIds, ...aprovadorIds];
        const concluido = r.fluxo.assinadas >= todos.length;
        const f = await prisma.fluxoAprovacao.create({
          data: {
            empresaId, entidadeTipo: "DOCUMENTO", entidadeId: doc.id, tipoAlteracao: numero === 0 ? "INCLUSAO" : "ALTERACAO", modo: "SEQUENCIAL",
            solicitanteId: responsavelId, status: concluido ? "APROVADO" : "PENDENTE", concluidoEm: concluido ? em : null, criadoEm: em,
            resumo: `${codigo} Rev. ${rev} — ${s.titulo}`,
            payload: { documentoId: doc.id, versaoId: v.id, numero, codigo, revisao: `Rev. ${rev}`, motivo: r.motivo, revisorIds, aprovadorIds },
          },
        });
        fluxoId = f.id;
        for (const [i, aprovadorId] of todos.entries()) {
          const status = i < r.fluxo.assinadas ? "APROVADA" : i === r.fluxo.assinadas ? "PENDENTE" : "AGUARDANDO";
          await prisma.etapaAprovacao.create({ data: { empresaId, fluxoId: f.id, ordem: i + 1, aprovadorId, status, decididoEm: status === "APROVADA" ? em : null } });
        }
        await prisma.historicoAprovacao.create({ data: { empresaId, fluxoId: f.id, usuarioId: responsavelId, acao: "SOLICITADO", criadoEm: em } });
        await hist("ENVIO_APROVACAO", responsavelId, em, v.id, `${revisorIds.length} revisor(es), ${aprovadorIds.length} aprovador(es) — sequencial.`);
        if (concluido) await hist("APROVACAO", aprovadorIds[aprovadorIds.length - 1], em, v.id, `Rev. ${rev} aprovada — pronta para publicar.`);
      }
      await prisma.versaoDocumento.update({
        where: { id: v.id },
        data: {
          anexoId: anexo.id,
          fluxoAprovacaoId: fluxoId,
          status: publicada ? "PUBLICADA" : r.status,
          aprovadoEm: publicada || r.status === "APROVADA" ? em : null,
          publicadoEm: publicada ? em : null,
          publicadoPorId: publicada ? uid(qualidade) : null,
        },
      });
      if (publicada) {
        const p: Publico = r.status === "PUBLICADA" ? (s.publico ?? { publicoTodos: true }) : { publicoTodos: true };
        await prisma.publicacaoDocumento.create({
          data: {
            empresaId, documentoId: doc.id, versaoId: v.id, publicoTodos: !!p.publicoTodos, setorIds: p.setorIds ?? [], obraIds: p.obraIds ?? [], perfilIds: p.perfilIds ?? [],
            usuarioIds: p.usuarioIds ?? [], notificar: true, exigirCiencia: r.status === "PUBLICADA" && !!p.exigirCiencia, publicadoPorId: uid(qualidade), publicadoEm: em,
          },
        });
        await hist("PUBLICACAO", uid(qualidade), em, v.id, `Rev. ${rev} publicada.`);
        if (r.status === "OBSOLETA") {
          const quando = proxima ?? new Date("2026-01-15T12:00:00.000Z");
          await prisma.versaoDocumento.update({ where: { id: v.id }, data: { status: "OBSOLETA", obsoletoEm: quando } });
          await hist("OBSOLESCENCIA", uid(qualidade), quando, v.id, proxima ? `Rev. ${rev} substituída pela Rev. ${String(numero + 1).padStart(2, "0")}.` : "Documento retirado de uso: substituído pelo PGRCC de cada obra.");
        } else {
          vigenteId = v.id;
        }
      }
      if (numero > 0 && !publicada) await hist("NOVA_REVISAO", responsavelId, em, v.id, `Rev. ${rev} — ${r.motivo}`);
    }
    if (vigenteId) {
      await prisma.documento.update({ where: { id: doc.id }, data: { versaoVigenteId: vigenteId } });
      for (const email of s.ciencias ?? []) {
        await prisma.cienciaDocumento.create({ data: { empresaId, versaoId: vigenteId, usuarioId: uid(email), confirmadoEm: new Date("2026-08-20T14:00:00.000Z") } });
      }
    }
  }
}
