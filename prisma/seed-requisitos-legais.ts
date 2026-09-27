/**
 * Seed de Requisitos Legais (P6) — Monto: 13 requisitos plausíveis para construção civil no Brasil (NRs, resíduos,
 * licenciamento, CLT, Código Civil, CDC, NBR 15575), com status variados, 2 com verificação vencida, 1 NAO_ATENDE e
 * 1 ATENDE_PARCIAL com plano de ação real, e 1 com histórico de verificações. Feito pelo serviço.
 * Idempotente: só cria se a empresa ainda não tiver requisitos.
 */
import type { PrismaClient, StatusRequisitoLegal } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { criarDbTenant } from "../src/lib/db-tenant";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { criarRequisito, registrarVerificacao, type DadosRequisito } from "../src/lib/requisitos-legais/servico";

async function ator(prisma: PrismaClient, email: string): Promise<Ator> {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { email }, include: { perfil: true, acessosObra: true } });
  const permissoes = permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []);
  const todas = u.escopoObras === "TODAS" || permissoes.includes("VER_TODAS_OBRAS");
  return { db: criarDbTenant(u.empresaId, prisma), empresaId: u.empresaId, usuarioId: u.id, permissoes, obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId) };
}

const somarDiasIso = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

export async function semearRequisitosLegais(prisma: PrismaClient, empresaId: string) {
  if ((await prisma.requisitoLegal.count({ where: { empresaId } })) > 0) return;
  const q = await ator(prisma, "qualidade@monto.com.br");
  const seg = (await prisma.usuario.findUniqueOrThrow({ where: { email: "seguranca@monto.com.br" } })).id;
  const amb = (await prisma.usuario.findUniqueOrThrow({ where: { email: "meioambiente@monto.com.br" } })).id;
  const alfa = (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome: "Obra Alfa" } })).id;
  const beta = (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome: "Obra Beta" } })).id;
  const proc = async (codigo: string) => (await prisma.processo.findUnique({ where: { empresaId_codigo: { empresaId, codigo } } }))?.id ?? null;
  const [pf03, pa02, pf04, pa01] = await Promise.all([proc("PF-03"), proc("PA-02"), proc("PF-04"), proc("PA-01")]);

  const lista: (DadosRequisito & { status: StatusRequisitoLegal; observacao?: string; acao?: string; vencido?: boolean })[] = [
    {
      tipo: "NORMA", numero: "NR-18", titulo: "Segurança e saúde no trabalho na indústria da construção", esfera: "FEDERAL", tema: "SSO",
      orgaoEmissor: "Ministério do Trabalho e Emprego (Portaria SEPRT 3.733/2020)", dataPublicacao: "2020-02-10", processoId: pf03, responsavelId: seg,
      resumo: "PGR da obra, áreas de vivência, proteções coletivas contra quedas, andaimes, escavações, instalações elétricas provisórias e treinamento admissional/periódico.",
      aplicabilidade: "Todas as obras em execução.", status: "ATENDE", observacao: "PGR das obras Alfa e Beta revisado; áreas de vivência inspecionadas.",
    },
    {
      tipo: "NORMA", numero: "NR-35", titulo: "Trabalho em altura", esfera: "FEDERAL", tema: "SSO", orgaoEmissor: "Ministério do Trabalho e Emprego",
      dataPublicacao: "2012-03-23", processoId: pf03, obraId: alfa, responsavelId: seg, periodicidadeMeses: 6,
      resumo: "Análise de risco e permissão de trabalho para atividades acima de 2 m, treinamento de 8 h com reciclagem bienal, sistemas de proteção contra quedas.",
      aplicabilidade: "Estrutura e fachada da Obra Alfa (torre de 12 pavimentos).",
      status: "ATENDE_PARCIAL", observacao: "Permissões de trabalho emitidas, mas 4 carpinteiros sem reciclagem bienal válida.",
      acao: "Realizar reciclagem NR-35 (8 h) dos 4 carpinteiros com certificado vencido",
    },
    {
      tipo: "NORMA", numero: "NR-06", titulo: "Equipamentos de proteção individual — EPI", esfera: "FEDERAL", tema: "SSO", orgaoEmissor: "Ministério do Trabalho e Emprego",
      processoId: pa01, responsavelId: seg, resumo: "Fornecimento gratuito de EPI com CA válido, treinamento de uso, ficha de entrega assinada e substituição quando danificado.",
      status: "ATENDE", observacao: "Fichas de EPI conferidas por amostragem (20 colaboradores).",
    },
    {
      tipo: "NORMA", numero: "NR-07", titulo: "Programa de Controle Médico de Saúde Ocupacional — PCMSO", esfera: "FEDERAL", tema: "SSO", orgaoEmissor: "Ministério do Trabalho e Emprego",
      processoId: pa02, responsavelId: seg, resumo: "PCMSO elaborado por médico do trabalho; ASO admissional, periódico, de retorno, de mudança de risco e demissional.",
      status: "ATENDE", observacao: "PCMSO 2025/2026 vigente.", vencido: true,
    },
    {
      tipo: "NORMA", numero: "NR-01", titulo: "Disposições gerais e gerenciamento de riscos ocupacionais (GRO/PGR)", esfera: "FEDERAL", tema: "SSO", orgaoEmissor: "Ministério do Trabalho e Emprego",
      processoId: pa02, responsavelId: seg, resumo: "Inventário de riscos e plano de ação do PGR; ordens de serviço de segurança; capacitação.", status: "ATENDE",
    },
    {
      tipo: "NORMA", numero: "NR-10", titulo: "Segurança em instalações e serviços em eletricidade", esfera: "FEDERAL", tema: "SSO", orgaoEmissor: "Ministério do Trabalho e Emprego",
      obraId: beta, responsavelId: seg, resumo: "Prontuário das instalações, profissionais autorizados e capacitados (40 h), bloqueio e etiquetagem.",
      aplicabilidade: "Subestação provisória da Obra Beta — em avaliação se a potência exige prontuário.", status: "EM_ANALISE",
    },
    {
      tipo: "NORMA", numero: "NR-22", titulo: "Segurança e saúde ocupacional na mineração", esfera: "FEDERAL", tema: "SSO", orgaoEmissor: "Ministério do Trabalho e Emprego",
      resumo: "Aplicável a mineração e lavra.", aplicabilidade: "A empresa não realiza lavra nem beneficiamento de minério.", status: "NAO_APLICAVEL",
    },
    {
      tipo: "LEI", numero: "Lei 12.305/2010", titulo: "Política Nacional de Resíduos Sólidos", esfera: "FEDERAL", tema: "MEIO_AMBIENTE", orgaoEmissor: "Presidência da República",
      dataPublicacao: "2010-08-02", processoId: pf03, responsavelId: amb, resumo: "Hierarquia de gestão de resíduos, plano de gerenciamento, destinação ambientalmente adequada e responsabilidade compartilhada.",
      status: "ATENDE", observacao: "MTRs e CDFs de todas as destinações do trimestre arquivados.",
    },
    {
      tipo: "RESOLUCAO", numero: "Resolução CONAMA 307/2002", titulo: "Gestão dos resíduos da construção civil (PGRCC)", esfera: "FEDERAL", tema: "MEIO_AMBIENTE",
      orgaoEmissor: "Conselho Nacional do Meio Ambiente", dataPublicacao: "2002-07-17", processoId: pf03, obraId: beta, responsavelId: amb,
      resumo: "Plano de Gerenciamento de Resíduos da Construção Civil aprovado pelo município; segregação por classes A–D; proibição de disposição em bota-fora irregular.",
      aplicabilidade: "Obra Beta (PGRCC exigido para o alvará de construção).",
      status: "NAO_ATENDE", observacao: "PGRCC da Obra Beta não protocolado na prefeitura; baias de segregação classe B inexistentes.",
      acao: "Elaborar e protocolar o PGRCC da Obra Beta na Secretaria de Meio Ambiente",
    },
    {
      tipo: "OUTRO", numero: "LI 0457/2025 (órgão ambiental estadual)", titulo: "Licença de instalação — condicionantes ambientais", esfera: "ESTADUAL", tema: "MEIO_AMBIENTE",
      orgaoEmissor: "Órgão estadual de meio ambiente", dataPublicacao: "2025-11-04", obraId: alfa, responsavelId: amb, periodicidadeMeses: 3,
      resumo: "Condicionantes: controle de ruído em horário diurno, lava-rodas na saída de caminhões, monitoramento trimestral de material particulado.",
      status: "ATENDE", observacao: "Relatório trimestral de condicionantes protocolado.", vencido: true,
    },
    {
      tipo: "LEI", numero: "CLT arts. 157 e 158", titulo: "Obrigações de empregadores e empregados em segurança e medicina do trabalho", esfera: "FEDERAL", tema: "SSO",
      orgaoEmissor: "Decreto-Lei 5.452/1943", processoId: pa02, responsavelId: seg,
      resumo: "Empresa: cumprir e fazer cumprir as normas, instruir por ordens de serviço. Empregado: observar as normas e usar os EPIs (recusa injustificada = ato faltoso).",
      status: "ATENDE",
    },
    {
      tipo: "NORMA", numero: "ABNT NBR 15575", titulo: "Edificações habitacionais — Desempenho", esfera: "FEDERAL", tema: "QUALIDADE", orgaoEmissor: "ABNT",
      dataPublicacao: "2013-02-19", processoId: pf04, resumo: "Requisitos de desempenho estrutural, térmico, acústico, estanqueidade e vida útil de projeto dos sistemas.",
      aplicabilidade: "Empreendimentos residenciais (Obra Alfa).", status: "EM_ANALISE",
    },
    {
      tipo: "LEI", numero: "Código Civil art. 618", titulo: "Garantia de solidez e segurança da obra (5 anos)", esfera: "FEDERAL", tema: "QUALIDADE", orgaoEmissor: "Lei 10.406/2002",
      processoId: pf04, resumo: "O empreiteiro responde por 5 anos pela solidez e segurança do trabalho; manual do proprietário e registro de assistência técnica.",
      status: "ATENDE",
    },
  ];

  const prazo = somarDiasIso(30);
  const criados: { id: string; codigo: string; vencido?: boolean }[] = [];
  for (const { status, observacao, acao, vencido, ...d } of lista) {
    const r = await criarRequisito(q, {
      ...d,
      status,
      observacao,
      primeiraAcao: acao ? { oQue: acao, quemId: d.responsavelId ?? q.usuarioId, quando: prazo } : null,
    });
    criados.push({ ...r, vencido });
  }

  // Histórico de atendimento: a NR-06 passou por uma verificação posterior (evidência ao longo do tempo).
  await registrarVerificacao(q, criados[2].id, { status: "ATENDE", observacao: "Reinspeção de EPIs na Obra Beta: todos com CA válido." });

  // Dois requisitos com verificação vencida (simula o passar do tempo).
  for (const c of criados.filter((x) => x.vencido)) {
    await prisma.requisitoLegal.update({ where: { id: c.id }, data: { proximaVerificacaoEm: new Date(`${somarDiasIso(-20)}T00:00:00.000Z`) } });
  }
}
