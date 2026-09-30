import { PrismaClient, type Modulo, type Permissao } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mesclarConfigAprovacao } from "../src/lib/aprovacao/config-modulo";
import { PADRAO_ASPECTO_IMPACTO, PADRAO_HIRA, PADRAO_RISCO_OPORTUNIDADE } from "../src/lib/escala/padrao";
import { codigoLaia, pontuarLaia } from "../src/lib/laia/regras";
import { avaliarPS, codigoHira } from "../src/lib/hira/regras";
import { avaliar } from "../src/lib/riscos/regras";
import { semearDocumentos } from "./seed-documentos";
import { semearInspecoes } from "./seed-inspecoes";
import { semearAuditorias } from "./seed-auditorias";
import { semearIncidentes } from "./seed-incidentes";
import { semearIndicadores } from "./seed-indicadores";
import { semearTreinamentos } from "./seed-treinamentos";

const prisma = new PrismaClient();

/** Todos os módulos (Monto testa o gating fim a fim com tudo contratado). */
const TODOS_MODULOS: Modulo[] = [
  "RNC",
  "PLANO_ACAO",
  "MAPA_PROCESSOS",
  "RISCOS_OPORTUNIDADES",
  "SWOT",
  "HIRA",
  "LAIA",
  "INSPECOES",
  "AUDITORIAS",
  "DOCUMENTOS",
  "INCIDENTES",
  "INDICADORES",
  "TREINAMENTOS",
];

async function empresa(nome: string, cnpj: string, modulosAtivos?: Modulo[]) {
  return prisma.empresa.upsert({
    where: { cnpj },
    update: { nome, ...(modulosAtivos ? { modulosAtivos } : {}) },
    create: { nome, cnpj, ...(modulosAtivos ? { modulosAtivos } : {}) },
  });
}

async function main() {
  const senhaHash = await bcrypt.hash("vigen123", 10);

  // ---- Monto ----
  // Monto: todos os módulos ativos (testa o gating/menu fim a fim).
  const monto = await empresa("Monto", "00000000000100", TODOS_MODULOS);
  const e = monto.id;
  const obras = [];
  for (const [nome, codigo] of [
    ["Obra Alfa", "ALF"],
    ["Obra Beta", "BET"],
  ]) {
    obras.push(
      await prisma.obraUnidade.upsert({
        where: { empresaId_nome: { empresaId: e, nome } },
        update: {},
        create: { empresaId: e, nome, codigo },
      }),
    );
  }

  const setores: Record<string, { id: string }> = {};
  for (const nome of ["Qualidade", "Segurança", "Meio Ambiente"]) {
    setores[nome] = await prisma.setor.upsert({
      where: { empresaId_nome: { empresaId: e, nome } },
      update: {},
      create: { empresaId: e, nome },
    });
  }

  const perfisSemente: { nome: string; descricao: string; permissoes: Permissao[] }[] = [
    {
      nome: "Qualidade",
      descricao: "Equipe de Qualidade",
      permissoes: ["RNC_VERIFICAR_EFICACIA", "RNC_APROVAR_CANCELAMENTO", "PLANO_GERENCIAR", "RNC_VER_RESTRITAS", "PROCESSO_GERENCIAR", "RISCO_GERENCIAR", "RISCO_TRATAR", "SWOT_GERENCIAR", "DOCUMENTO_ELABORAR", "DOCUMENTO_GERENCIAR", "INSPECAO_GERENCIAR", "INSPECAO_REALIZAR", "AUDITORIA_GERENCIAR", "AUDITORIA_REALIZAR", "INCIDENTE_GERENCIAR", "INDICADOR_GERENCIAR", "TREINAMENTO_GERENCIAR"],
    },
    { nome: "Segurança", descricao: "Equipe de SSO", permissoes: ["RNC_TRATAR", "PLANO_GERENCIAR", "RNC_VER_RESTRITAS", "RISCO_TRATAR", "HIRA_GERENCIAR", "DOCUMENTO_ELABORAR", "INSPECAO_GERENCIAR", "INSPECAO_REALIZAR", "INCIDENTE_GERENCIAR", "INCIDENTE_VER_RESTRITOS", "TREINAMENTO_GERENCIAR"] },
    { nome: "Meio Ambiente", descricao: "Equipe de Meio Ambiente", permissoes: ["RNC_TRATAR", "PLANO_GERENCIAR", "LAIA_GERENCIAR", "INSPECAO_REALIZAR"] },
  ];
  const perfis: Record<string, { id: string }> = {};
  for (const p of perfisSemente) {
    perfis[p.nome] = await prisma.perfil.upsert({
      where: { empresaId_nome: { empresaId: e, nome: p.nome } },
      update: { permissoes: p.permissoes, descricao: p.descricao, sistema: true },
      create: { empresaId: e, ...p, sistema: true },
    });
  }

  const usuarios = [
    { email: "admin@monto.com.br", nome: "Administrador Monto", papel: "ADMIN", escopoObras: "TODAS" },
    {
      email: "qualidade@monto.com.br",
      nome: "Gestora da Qualidade",
      papel: "GESTOR_SGI",
      escopoObras: "TODAS",
      perfilId: perfis.Qualidade.id,
      setorId: setores.Qualidade.id,
    },
    {
      email: "inspetor@monto.com.br",
      nome: "Inspetor de Campo",
      papel: "INSPETOR",
      escopoObras: "SELECIONADAS",
      setorId: setores["Segurança"].id,
    },
    { email: "colaborador@monto.com.br", nome: "Colaborador Monto", papel: "COLABORADOR", escopoObras: "SELECIONADAS" },
    {
      email: "seguranca@monto.com.br",
      nome: "Técnico de Segurança",
      papel: "INSPETOR",
      escopoObras: "TODAS",
      perfilId: perfis["Segurança"].id,
      setorId: setores["Segurança"].id,
    },
    {
      email: "meioambiente@monto.com.br",
      nome: "Analista Ambiental",
      papel: "INSPETOR",
      escopoObras: "TODAS",
      perfilId: perfis["Meio Ambiente"].id,
      setorId: setores["Meio Ambiente"].id,
    },
  ] as const;

  for (const u of usuarios) {
    const criado = await prisma.usuario.upsert({
      where: { email: u.email },
      update: { ...u, senhaHash, ativo: true },
      create: { ...u, senhaHash, empresaId: e },
    });
    if (u.email === "inspetor@monto.com.br" || u.email === "colaborador@monto.com.br") {
      await prisma.usuarioAcessoObra.upsert({
        where: { empresaId_usuarioId_obraId: { empresaId: e, usuarioId: criado.id, obraId: obras[0].id } },
        update: {},
        create: { empresaId: e, usuarioId: criado.id, obraId: obras[0].id },
      });
    }
  }

  await semearProcessos(e);
  await semearRiscos(e);
  await semearSwot(e);
  await semearHira(e);
  await semearLaia(e);
  await semearDocumentos(prisma, e);
  await semearInspecoes(prisma, e);
  await semearAuditorias(prisma, e);
  await semearIncidentes(prisma, e);
  await semearIndicadores(prisma, e);
  await semearTreinamentos(prisma, e);

  // ---- Demo (para testar isolamento) ----
  // Sem override: fica só com o default do schema (RNC + PLANO_ACAO) — testa o gating
  // junto com o isolamento (Monto tem tudo, Demo só o básico).
  const demo = await empresa("Demo", "00000000000200");
  await prisma.obraUnidade.upsert({
    where: { empresaId_nome: { empresaId: demo.id, nome: "Unidade Demo" } },
    update: {},
    create: { empresaId: demo.id, nome: "Unidade Demo" },
  });
  await prisma.usuario.upsert({
    where: { email: "admin@demo.com.br" },
    update: { senhaHash, ativo: true },
    create: {
      empresaId: demo.id,
      email: "admin@demo.com.br",
      nome: "Administrador Demo",
      papel: "ADMIN",
      escopoObras: "TODAS",
      senhaHash,
    },
  });

  console.log("Seed concluído: Monto", monto.id, "| Demo", demo.id);
}

/** Mapa de processos da Monto (construção civil): 8 processos, indicadores e interações. Idempotente. */
async function semearProcessos(empresaId: string) {
  const dono = async (email: string) => (await prisma.usuario.findUniqueOrThrow({ where: { email } })).id;
  const qualidade = await dono("qualidade@monto.com.br");
  const adminId = await dono("admin@monto.com.br");
  const inspetor = await dono("inspetor@monto.com.br");
  type Semente = {
    codigo: string; nome: string; tipo: "GESTAO" | "FINALISTICO" | "APOIO"; ordem: number; donoId: string; objetivo: string;
    fornecedores: string; entradas: string; saidas: string; clientes: string; recursos: string;
    indicadores: [string, string, string, string][];
  };
  const sementes: Semente[] = [
    { codigo: "PG-01", nome: "Planejamento estratégico", tipo: "GESTAO", ordem: 1, donoId: adminId,
      objetivo: "Definir direção, objetivos e metas da empresa.", fornecedores: "Diretoria; Partes interessadas",
      entradas: "Análise de contexto (SWOT)\nResultados de indicadores", saidas: "Plano estratégico\nObjetivos da qualidade",
      clientes: "Todos os processos", recursos: "Reunião de diretoria; BI",
      indicadores: [["Objetivos estratégicos atingidos", "≥ 80%", "%", "Anual"]] },
    { codigo: "PG-02", nome: "Gestão do SGI e melhoria contínua", tipo: "GESTAO", ordem: 2, donoId: qualidade,
      objetivo: "Manter o sistema de gestão integrado e tratar não conformidades.", fornecedores: "Todos os processos; Auditores",
      entradas: "RNCs\nResultados de auditorias", saidas: "Planos de ação\nAnálise crítica", clientes: "Diretoria; Todos os processos",
      recursos: "Vigen; Equipe de Qualidade",
      indicadores: [["RNCs encerradas no prazo", "≥ 90%", "%", "Mensal"], ["Eficácia das ações corretivas", "≥ 85%", "%", "Trimestral"]] },
    { codigo: "PF-01", nome: "Comercial e orçamentos", tipo: "FINALISTICO", ordem: 1, donoId: adminId,
      objetivo: "Captar clientes e converter propostas em contratos.", fornecedores: "Cliente; Mercado",
      entradas: "Solicitação de proposta\nProjeto básico", saidas: "Proposta comercial\nContrato assinado", clientes: "Cliente; Engenharia",
      recursos: "Tabela SINAPI; Software de orçamento",
      indicadores: [["Taxa de conversão de propostas", "≥ 25%", "%", "Trimestral"]] },
    { codigo: "PF-02", nome: "Projetos e engenharia", tipo: "FINALISTICO", ordem: 2, donoId: qualidade,
      objetivo: "Desenvolver e compatibilizar projetos executivos.", fornecedores: "Comercial; Projetistas terceiros",
      entradas: "Contrato\nRequisitos do cliente", saidas: "Projeto executivo aprovado\nCronograma físico-financeiro",
      clientes: "Execução de obras", recursos: "BIM; Engenheiros",
      indicadores: [["Revisões de projeto após liberação", "≤ 2", "revisões", "Por obra"]] },
    { codigo: "PF-03", nome: "Execução de obras", tipo: "FINALISTICO", ordem: 3, donoId: inspetor,
      objetivo: "Executar a obra no prazo, custo e qualidade previstos com segurança.", fornecedores: "Engenharia; Suprimentos; Subempreiteiros",
      entradas: "Projeto executivo\nMateriais e equipamentos", saidas: "Serviços executados e inspecionados", clientes: "Entrega e pós-obra",
      recursos: "Mão de obra; Equipamentos; Canteiro",
      indicadores: [["Desvio de prazo (IDP)", "≥ 0,95", "índice", "Mensal"], ["Taxa de frequência de acidentes", "≤ 5", "TF", "Mensal"]] },
    { codigo: "PF-04", nome: "Entrega e assistência técnica", tipo: "FINALISTICO", ordem: 4, donoId: qualidade,
      objetivo: "Entregar a obra e atender chamados no período de garantia.", fornecedores: "Execução de obras",
      entradas: "Obra concluída\nChamados de assistência", saidas: "Termo de entrega\nChamados atendidos", clientes: "Cliente",
      recursos: "Equipe de assistência técnica",
      indicadores: [["Satisfação do cliente na entrega", "≥ 8,5", "nota", "Por obra"], ["Chamados atendidos em até 15 dias", "≥ 90%", "%", "Mensal"]] },
    { codigo: "PA-01", nome: "Suprimentos e compras", tipo: "APOIO", ordem: 1, donoId: adminId,
      objetivo: "Adquirir materiais e serviços qualificados no prazo.", fornecedores: "Fornecedores; Execução de obras",
      entradas: "Requisição de compra\nCadastro de fornecedores", saidas: "Pedido de compra\nMaterial recebido e inspecionado",
      clientes: "Execução de obras", recursos: "ERP; Almoxarifado",
      indicadores: [["Entregas no prazo", "≥ 92%", "%", "Mensal"], ["Fornecedores críticos avaliados", "100%", "%", "Semestral"]] },
    { codigo: "PA-02", nome: "Gestão de pessoas e SSO", tipo: "APOIO", ordem: 2, donoId: inspetor,
      objetivo: "Recrutar, treinar e manter a segurança dos colaboradores.", fornecedores: "Todos os processos; Clínicas; Sindicato",
      entradas: "Necessidade de pessoal\nLevantamento de perigos", saidas: "Colaboradores treinados e aptos\nPGR e PCMSO",
      clientes: "Execução de obras; Todos os processos", recursos: "RH; Técnico de segurança",
      indicadores: [["Horas de treinamento por colaborador", "≥ 16", "h", "Anual"]] },
  ];
  const ids: Record<string, string> = {};
  for (const { indicadores, ...s } of sementes) {
    const p = await prisma.processo.upsert({
      where: { empresaId_codigo: { empresaId, codigo: s.codigo } },
      update: { ...s, ativo: true },
      create: { ...s, empresaId },
    });
    ids[s.codigo] = p.id;
    await prisma.indicadorProcesso.deleteMany({ where: { empresaId, processoId: p.id } });
    await prisma.indicadorProcesso.createMany({
      data: indicadores.map(([nome, meta, unidade, periodicidade], i) => ({ empresaId, processoId: p.id, nome, meta, unidade, periodicidade, ordem: i + 1 })),
    });
  }
  const interacoes: [string, string, string][] = [
    ["PF-01", "PF-02", "Contrato e requisitos do cliente"],
    ["PF-02", "PF-03", "Projeto executivo e cronograma"],
    ["PF-03", "PF-04", "Obra concluída"],
    ["PF-03", "PA-01", "Requisições de compra"],
    ["PA-01", "PF-03", "Materiais inspecionados"],
    ["PA-02", "PF-03", "Equipes treinadas e aptas"],
    ["PG-01", "PG-02", "Objetivos da qualidade"],
    ["PG-02", "PF-03", "Planos de ação de RNCs"],
    ["PF-04", "PG-02", "Reclamações e pesquisa de satisfação"],
  ];
  for (const [o, d, descricao] of interacoes) {
    await prisma.interacaoProcesso.upsert({
      where: { empresaId_origemId_destinoId: { empresaId, origemId: ids[o], destinoId: ids[d] } },
      update: { descricao },
      create: { empresaId, origemId: ids[o], destinoId: ids[d], descricao },
    });
  }
}


/**
 * Riscos e oportunidades da Monto (10, ligados aos processos), com histórico de cadastro e
 * planos de ação onde o tratamento exige. Idempotente (chave: número sequencial).
 */
async function semearRiscos(empresaId: string) {
  const usuario = async (email: string) => (await prisma.usuario.findUniqueOrThrow({ where: { email } })).id;
  const qualidade = await usuario("qualidade@monto.com.br");
  const inspetor = await usuario("inspetor@monto.com.br");
  const adminId = await usuario("admin@monto.com.br");
  const proc = async (codigo: string) => (await prisma.processo.findUniqueOrThrow({ where: { empresaId_codigo: { empresaId, codigo } } })).id;
  const obraAlfa = (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome: "Obra Alfa" } })).id;
  type T = "ACEITAR" | "MITIGAR" | "TRANSFERIR" | "EVITAR" | "EXPLORAR";
  const sementes: {
    tipo: "RISCO" | "OPORTUNIDADE"; processo: string; descricao: string; causa: string; consequencia: string;
    p: number; i: number; tratamento: T | null; descricaoTratamento?: string; pr?: number; ir?: number;
    status: "IDENTIFICADO" | "EM_TRATAMENTO" | "MONITORADO"; responsavel: string; obra?: boolean; modo?: "ITEM" | "GERAL"; plano?: string;
    proxima: string;
  }[] = [
    { tipo: "RISCO", processo: "PF-03", descricao: "Queda de altura em serviços de fachada", causa: "Andaimes sem inspeção diária; linha de vida improvisada",
      consequencia: "Acidente grave, embargo da obra", p: 3, i: 5, tratamento: "MITIGAR", descricaoTratamento: "Inspeção diária de andaimes e linha de vida certificada",
      pr: 2, ir: 5, status: "EM_TRATAMENTO", responsavel: inspetor, obra: true, plano: "Implantar checklist diário de andaimes na Obra Alfa", proxima: "2026-10-05" },
    { tipo: "RISCO", processo: "PA-01", descricao: "Atraso na entrega de concreto usinado", causa: "Fornecedor único na região", consequencia: "Atraso de cronograma e custo de mobilização",
      p: 4, i: 3, tratamento: "MITIGAR", descricaoTratamento: "Qualificar segundo fornecedor", pr: 2, ir: 3, status: "EM_TRATAMENTO", responsavel: qualidade,
      plano: "Qualificar segundo fornecedor de concreto", proxima: "2027-03-01" },
    { tipo: "RISCO", processo: "PF-02", descricao: "Incompatibilidade entre projetos estrutural e de instalações", causa: "Projetos contratados separadamente sem modelagem integrada",
      consequencia: "Retrabalho e demolições em obra", p: 3, i: 4, tratamento: "EVITAR", descricaoTratamento: "Compatibilização em BIM antes da liberação", status: "EM_TRATAMENTO",
      responsavel: adminId, plano: "Compatibilizar projetos em BIM antes da liberação", proxima: "2027-01-15" },
    { tipo: "RISCO", processo: "PF-04", descricao: "Infiltrações recorrentes após a entrega", causa: "Falhas de impermeabilização", consequencia: "Chamados de garantia e insatisfação do cliente",
      p: 2, i: 3, tratamento: "ACEITAR", descricaoTratamento: "Monitorar chamados de pós-obra", status: "MONITORADO", responsavel: qualidade, modo: "GERAL", proxima: "2026-10-01" },
    { tipo: "RISCO", processo: "PA-02", descricao: "Rotatividade de mão de obra qualificada", causa: "Mercado aquecido", consequencia: "Perda de produtividade e de conhecimento",
      p: 3, i: 3, tratamento: null, status: "IDENTIFICADO", responsavel: adminId, modo: "GERAL", proxima: "2026-12-01" },
    { tipo: "RISCO", processo: "PG-02", descricao: "Perda da certificação ISO 9001 na recertificação", causa: "Ações corretivas sem verificação de eficácia", consequencia: "Perda de contratos públicos",
      p: 1, i: 5, tratamento: "MITIGAR", descricaoTratamento: "Auditoria interna trimestral", status: "EM_TRATAMENTO", responsavel: qualidade, proxima: "2027-06-30" },
    { tipo: "RISCO", processo: "PF-01", descricao: "Contrato fechado com escopo mal definido", causa: "Pressa comercial", consequencia: "Aditivos e conflitos com o cliente",
      p: 3, i: 2, tratamento: "TRANSFERIR", descricaoTratamento: "Cláusula de revisão de escopo e seguro de responsabilidade", status: "MONITORADO", responsavel: adminId, proxima: "2027-02-01" },
    { tipo: "OPORTUNIDADE", processo: "PF-03", descricao: "Uso de pré-moldados para reduzir prazo", causa: "Novo fornecedor regional de pré-moldados", consequencia: "Redução de 15% no prazo da estrutura",
      p: 4, i: 4, tratamento: "EXPLORAR", descricaoTratamento: "Piloto na Obra Beta", status: "EM_TRATAMENTO", responsavel: inspetor, proxima: "2027-01-10" },
    { tipo: "OPORTUNIDADE", processo: "PG-01", descricao: "Programa Minha Casa Minha Vida — nova faixa", causa: "Ampliação do programa habitacional", consequencia: "Novos contratos de alto volume",
      p: 3, i: 5, tratamento: "EXPLORAR", descricaoTratamento: "Estudo de viabilidade de empreendimento", status: "IDENTIFICADO", responsavel: adminId, proxima: "2026-11-20" },
    { tipo: "OPORTUNIDADE", processo: "PG-02", descricao: "Digitalizar inspeções de qualidade em campo", causa: "Equipe já usa tablets", consequencia: "Menos papel e rastreabilidade das RNCs",
      p: 4, i: 2, tratamento: null, status: "IDENTIFICADO", responsavel: qualidade, proxima: "2027-03-15" },
  ];
  for (const [n, s] of sementes.entries()) {
    const numero = n + 1;
    const a = avaliar(PADRAO_RISCO_OPORTUNIDADE, s.p, s.i);
    const r = s.pr && s.ir ? avaliar(PADRAO_RISCO_OPORTUNIDADE, s.pr, s.ir) : null;
    const dados = {
      tipo: s.tipo, processoId: await proc(s.processo), obraId: s.obra ? obraAlfa : null, descricao: s.descricao, causa: s.causa, consequencia: s.consequencia,
      probabilidade: a.probabilidade, impacto: a.impacto, score: a.score, faixa: a.faixa,
      tratamento: s.tratamento, descricaoTratamento: s.descricaoTratamento ?? null,
      probabilidadeResidual: r?.probabilidade ?? null, impactoResidual: r?.impacto ?? null, scoreResidual: r?.score ?? null, faixaResidual: r?.faixa ?? null,
      status: s.status, responsavelId: s.responsavel, modoReavaliacao: s.modo ?? "ITEM", periodicidadeMeses: 12,
      proximaReavaliacaoEm: new Date(`${s.proxima}T00:00:00.000Z`), ativo: true,
    } as const;
    const risco = await prisma.riscoOportunidade.upsert({
      where: { empresaId_numero: { empresaId, numero } },
      update: dados,
      create: { ...dados, empresaId, numero, criadoPorId: qualidade },
    });
    if (s.plano && !risco.planoAcaoId) {
      const plano = await prisma.planoAcao.create({
        data: { empresaId, origemTipo: "RISCO_OPORTUNIDADE", origemId: risco.id, titulo: s.plano, descricao: `Tratamento do risco ${numero}.`, obraId: dados.obraId, criadoPorId: qualidade },
      });
      await prisma.itemAcao.create({
        data: { empresaId, planoAcaoId: plano.id, ciclo: 1, ordem: 1, oQue: s.plano, quemId: s.responsavel, quando: new Date("2026-11-30T00:00:00.000Z") },
      });
      await prisma.riscoOportunidade.update({ where: { id: risco.id }, data: { planoAcaoId: plano.id } });
    }
    if ((await prisma.historicoRiscoOportunidade.count({ where: { riscoId: risco.id } })) === 0) {
      await prisma.historicoRiscoOportunidade.create({
        data: {
          empresaId, riscoId: risco.id, acao: "CRIACAO", probabilidade: a.probabilidade, impacto: a.impacto, score: a.score, faixa: a.faixa,
          probabilidadeResidual: dados.probabilidadeResidual, impactoResidual: dados.impactoResidual, scoreResidual: dados.scoreResidual, faixaResidual: dados.faixaResidual,
          tratamento: s.tratamento, status: s.status, observacao: "Cadastro inicial (seed).", usuarioId: qualidade,
        },
      });
    }
  }
}

/** Ciclo SWOT 2026 da Monto com itens nos 4 quadrantes e 6 partes interessadas. Idempotente. */
async function semearSwot(empresaId: string) {
  const qualidade = (await prisma.usuario.findUniqueOrThrow({ where: { email: "qualidade@monto.com.br" } })).id;
  const ciclo = await prisma.cicloSwot.upsert({
    where: { empresaId_ano: { empresaId, ano: 2026 } },
    update: {},
    create: { empresaId, ano: 2026, titulo: "Análise de contexto 2026", criadoPorId: qualidade },
  });
  if ((await prisma.itemSwot.count({ where: { cicloId: ciclo.id } })) === 0) {
    const riscoPorNumero = async (numero: number) => (await prisma.riscoOportunidade.findUnique({ where: { empresaId_numero: { empresaId, numero } } }))?.id ?? null;
    const itens: [string, string, number, number | null][] = [
      ["FORCA", "Equipe técnica experiente e com baixa rotatividade na engenharia", 5, null],
      ["FORCA", "Certificação ISO 9001 e histórico de obras entregues no prazo", 4, null],
      ["FORCA", "Parcerias com fornecedores regionais de pré-moldados", 3, 8],
      ["FRAQUEZA", "Dependência de fornecedor único de concreto usinado", 4, 2],
      ["FRAQUEZA", "Compatibilização de projetos ainda manual", 4, 3],
      ["FRAQUEZA", "Baixa digitalização das inspeções de campo", 2, null],
      ["OPORTUNIDADE", "Ampliação do programa habitacional federal", 5, 9],
      ["OPORTUNIDADE", "Crescimento da demanda por obras industriais na região", 3, null],
      ["AMEACA", "Escassez de mão de obra qualificada", 4, 5],
      ["AMEACA", "Alta do preço do aço e do cimento", 4, null],
      ["AMEACA", "Novas exigências da NR-18 para trabalho em altura", 3, 1],
    ];
    for (const [quadrante, descricao, relevancia, risco] of itens) {
      await prisma.itemSwot.create({
        data: { empresaId, cicloId: ciclo.id, quadrante: quadrante as "FORCA", descricao, relevancia, riscoOportunidadeId: risco ? await riscoPorNumero(risco) : null },
      });
    }
  }
  if ((await prisma.parteInteressada.count({ where: { cicloId: ciclo.id } })) === 0) {
    await prisma.parteInteressada.createMany({
      data: [
        { nome: "Clientes (incorporadores e compradores)", necessidades: "Obra no prazo e sem defeitos", expectativas: "Transparência no andamento e pós-obra ágil", influencia: 5, interesse: 5 },
        { nome: "Colaboradores", necessidades: "Ambiente seguro e salário em dia", expectativas: "Treinamento e plano de carreira", influencia: 3, interesse: 5 },
        { nome: "Fornecedores de materiais", necessidades: "Pagamento em dia", expectativas: "Previsibilidade de pedidos", influencia: 3, interesse: 3 },
        { nome: "Órgãos públicos (prefeitura, MTE, CREA)", necessidades: "Cumprimento da legislação", expectativas: "Documentação e alvarás regulares", influencia: 5, interesse: 2 },
        { nome: "Comunidade do entorno das obras", necessidades: "Baixo ruído e limpeza de vias", expectativas: "Comunicação sobre interferências", influencia: 2, interesse: 3 },
        { nome: "Sindicato da construção civil", necessidades: "Cumprimento da convenção coletiva", expectativas: "Diálogo sobre segurança", influencia: 4, interesse: 3 },
      ].map((p) => ({ ...p, empresaId, cicloId: ciclo.id })),
    });
  }
}

/** HIRA da Monto: 12 linhas em 2 obras, aprovação exigida (aprovador: admin), 1 plano e 1 inclusão pendente. Idempotente. */
async function semearHira(empresaId: string) {
  const usuario = async (email: string) => (await prisma.usuario.findUniqueOrThrow({ where: { email } })).id;
  const seg = await usuario("seguranca@monto.com.br");
  const adminId = await usuario("admin@monto.com.br");
  const inspetor = await usuario("inspetor@monto.com.br");
  const emp = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
  await prisma.empresa.update({ where: { id: empresaId }, data: { config: mesclarConfigAprovacao(emp.config, "hira", { exigir: true, aprovadorIds: [adminId], modo: "SEQUENCIAL" }) as object } });
  const obra = async (nome: string) => (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome } })).id;
  const alfa = await obra("Obra Alfa");
  const beta = await obra("Obra Beta");
  const pf03 = (await prisma.processo.findUniqueOrThrow({ where: { empresaId_codigo: { empresaId, codigo: "PF-03" } } })).id;
  type H = "ELIMINACAO" | "SUBSTITUICAO" | "ENGENHARIA" | "ADMINISTRATIVO" | "EPI";
  type Semente = [string, string, string, boolean, string, string, "NORMAL" | "ANORMAL" | "EMERGENCIA", string, number, number, H | null, string | null, number | null, number | null, string | null];
  const S: Semente[] = [
    [alfa, "Fachada", "Montagem e uso de andaime fachadeiro", true, "Trabalho em altura acima de 2 m", "Queda de pessoa de nível diferente", "NORMAL", "Andaime com guarda-corpo; cinto paraquedista", 3, 5, "ENGENHARIA", "Linha de vida certificada e ancoragens projetadas", 2, 5, "NR-35; NR-18"],
    [alfa, "Estrutura", "Concretagem de lajes", true, "Bomba-lança de concreto", "Atingimento por mangote; esmagamento", "NORMAL", "Isolamento da área de lançamento", 2, 4, "ADMINISTRATIVO", "Sinaleiro dedicado e APR da concretagem", 1, 4, "NR-18; NR-12"],
    [alfa, "Estrutura", "Armação e corte de vergalhões", true, "Pontas de vergalhão expostas", "Perfuração e cortes", "NORMAL", "Uso de luvas", 4, 2, "ENGENHARIA", "Protetores plásticos (cogumelos) em todas as esperas", 2, 2, "NR-18"],
    [alfa, "Instalações", "Instalações elétricas provisórias do canteiro", true, "Eletricidade (220/380 V)", "Choque elétrico", "NORMAL", "Quadro com DR; eletricista qualificado", 2, 5, "ENGENHARIA", "Inspeção mensal do quadro e aterramento", 1, 5, "NR-10"],
    [alfa, "Canteiro", "Movimentação de cargas com grua", false, "Carga suspensa", "Queda de material sobre pessoas", "NORMAL", "Operador habilitado; plano de rigging", 3, 5, "ADMINISTRATIVO", "Isolamento sob a carga e checklist diário da grua", 2, 5, "NR-11; NR-18"],
    [alfa, "Escavação", "Escavação de subsolo acima de 1,25 m", false, "Talude instável", "Soterramento", "ANORMAL", "Escoramento em trechos críticos", 2, 5, null, null, null, null, "NR-18"],
    [alfa, "Canteiro", "Abandono em caso de incêndio no almoxarifado", false, "Inflamáveis (tintas, solventes)", "Queimaduras e intoxicação por fumaça", "EMERGENCIA", "Extintores e brigada treinada", 2, 4, "ADMINISTRATIVO", "Simulado semestral e rota de fuga sinalizada", 1, 4, "NR-23; IT do Corpo de Bombeiros"],
    [beta, "Alvenaria", "Corte de blocos com serra circular", true, "Poeira de sílica e ruído", "Silicose e perda auditiva", "NORMAL", "Protetor auricular", 4, 3, "SUBSTITUICAO", "Serra com umidificação; PFF2", 2, 3, "NR-15 Anexo 12; NR-09"],
    [beta, "Acabamento", "Pintura com solventes em ambiente fechado", true, "Vapores orgânicos", "Intoxicação", "NORMAL", "Ventilação natural", 3, 3, "SUBSTITUICAO", "Tinta à base de água; ventilação forçada", 1, 3, "NR-15"],
    [beta, "Canteiro", "Circulação de caminhões na entrada", true, "Veículos em manobra", "Atropelamento", "NORMAL", "Sinalização vertical", 3, 4, "ENGENHARIA", "Segregação de rota de pedestres com barreiras", 1, 4, "NR-18"],
    [beta, "Estrutura", "Soldagem de insertos metálicos", false, "Radiação não ionizante e fagulhas", "Queimaduras e lesão ocular", "NORMAL", "Máscara de solda; avental de raspa", 2, 3, "EPI", "Biombo de proteção para terceiros", 1, 3, "NR-18"],
    [beta, "Cobertura", "Montagem de telhas na cobertura", false, "Telhado frágil", "Queda através da telha", "NORMAL", "Tábuas de apoio", 3, 5, "ENGENHARIA", "Rede de proteção sob a cobertura e linha de vida", 1, 5, "NR-35"],
  ];
  for (const [n, s] of S.entries()) {
    const numero = n + 1;
    const pendente = numero === 12;
    const a = avaliarPS(PADRAO_HIRA, s[8], s[9]);
    const r = s[12] && s[13] ? avaliarPS(PADRAO_HIRA, s[12], s[13]) : null;
    const entrada = {
      obraId: s[0], setor: s[1], processoId: pf03, atividade: s[2], rotineira: s[3], perigo: s[4], risco: s[5], condicao: s[6], controlesExistentes: s[7],
      hierarquiaControle: s[10], controlesPropostos: s[11], requisitoLegal: s[14], responsavelId: s[0] === alfa && numero % 2 ? inspetor : seg,
      modoReavaliacao: numero > 7 ? ("GERAL" as const) : ("ITEM" as const), periodicidadeMeses: 12,
    };
    const dados = {
      ...entrada,
      probabilidade: a.probabilidade, severidade: a.severidade, score: a.score, faixa: a.faixa,
      probabilidadeResidual: r?.probabilidade ?? null, severidadeResidual: r?.severidade ?? null, scoreResidual: r?.score ?? null, faixaResidual: r?.faixa ?? null,
      proximaReavaliacaoEm: new Date(numero === 1 ? "2026-10-05T00:00:00.000Z" : "2027-06-30T00:00:00.000Z"),
      status: pendente ? ("PENDENTE_APROVACAO" as const) : ("VIGENTE" as const),
    };
    const l = await prisma.linhaHira.upsert({ where: { empresaId_numero: { empresaId, numero } }, update: {}, create: { ...dados, empresaId, numero, criadoPorId: seg } });
    if ((await prisma.historicoLinhaHira.count({ where: { linhaId: l.id } })) === 0) {
      await prisma.historicoLinhaHira.create({
        data: { empresaId, linhaId: l.id, acao: "INCLUSAO", versao: 0, dados: { ...dados, proximaReavaliacaoEm: null, codigo: codigoHira(l) }, observacao: pendente ? "Enviada para aprovação." : "Cadastro inicial (seed).", usuarioId: seg },
      });
    }
    if (numero === 1 && !l.planoAcaoId) {
      const plano = await prisma.planoAcao.create({
        data: { empresaId, origemTipo: "HIRA", origemId: l.id, titulo: "Linha de vida certificada na fachada da Obra Alfa", descricao: "Plano de ação da linha HIRA H-001.", obraId: alfa, criadoPorId: seg },
      });
      await prisma.itemAcao.create({ data: { empresaId, planoAcaoId: plano.id, ciclo: 1, ordem: 1, oQue: "Instalar linha de vida certificada na fachada norte", quemId: inspetor, quando: new Date("2026-11-15T00:00:00.000Z") } });
      await prisma.linhaHira.update({ where: { id: l.id }, data: { planoAcaoId: plano.id } });
    }
    if (pendente && (await prisma.fluxoAprovacao.count({ where: { entidadeTipo: "HIRA", entidadeId: l.id } })) === 0) {
      const f = await prisma.fluxoAprovacao.create({
        data: {
          empresaId, entidadeTipo: "HIRA", entidadeId: l.id, tipoAlteracao: "INCLUSAO", modo: "SEQUENCIAL", solicitanteId: seg,
          resumo: `Inclusão HIRA ${codigoHira(l)} — ${s[2]}`,
          payload: { linhaId: l.id, versao: 0, dados: { ...entrada, probabilidade: s[8], severidade: s[9], probabilidadeResidual: s[12], severidadeResidual: s[13] } },
        },
      });
      await prisma.etapaAprovacao.create({ data: { empresaId, fluxoId: f.id, ordem: 1, aprovadorId: adminId, status: "PENDENTE" } });
      await prisma.historicoAprovacao.create({ data: { empresaId, fluxoId: f.id, usuarioId: seg, acao: "SOLICITADO" } });
    }
  }
}

/** LAIA da Monto: 10 linhas em 2 obras, aprovação exigida (aprovador: admin), 1 plano. Idempotente. */
async function semearLaia(empresaId: string) {
  const usuario = async (email: string) => (await prisma.usuario.findUniqueOrThrow({ where: { email } })).id;
  const amb = await usuario("meioambiente@monto.com.br");
  const adminId = await usuario("admin@monto.com.br");
  const emp = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
  await prisma.empresa.update({ where: { id: empresaId }, data: { config: mesclarConfigAprovacao(emp.config, "laia", { exigir: true, aprovadorIds: [adminId], modo: "SEQUENCIAL" }) as object } });
  const obra = async (nome: string) => (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome } })).id;
  const alfa = await obra("Obra Alfa");
  const beta = await obra("Obra Beta");
  const pf03 = (await prisma.processo.findUniqueOrThrow({ where: { empresaId_codigo: { empresaId, codigo: "PF-03" } } })).id;
  type Sit = "NORMAL" | "ANORMAL" | "EMERGENCIA";
  type Semente = [string, string, string, string, Sit, "PASSADA" | "ATUAL" | "FUTURA", "DIRETA" | "INDIRETA", number, number, number, boolean, boolean, string];
  const S: Semente[] = [
    [alfa, "Concretagem", "Lavagem de caminhões betoneira", "Contaminação do solo e da água por efluente alcalino", "NORMAL", "ATUAL", "DIRETA", 2, 3, 1, false, false, "Bacia de decantação e reúso da água"],
    [alfa, "Canteiro", "Geração de resíduos classe A (entulho)", "Ocupação de aterros; esgotamento de recursos", "NORMAL", "ATUAL", "DIRETA", 2, 3, 2, false, false, "PGRCC; baias segregadas; destinação a ATT licenciada"],
    [alfa, "Terraplenagem", "Emissão de material particulado", "Alteração da qualidade do ar; incômodo à vizinhança", "NORMAL", "ATUAL", "DIRETA", 2, 2, 3, false, true, "Umectação de vias duas vezes ao dia"],
    [alfa, "Canteiro", "Ruído de equipamentos (bate-estaca, serra)", "Incômodo à comunidade do entorno", "NORMAL", "ATUAL", "DIRETA", 1, 3, 2, false, true, "Horário restrito 7h–17h; enclausuramento da serra"],
    [alfa, "Manutenção", "Vazamento de óleo de máquinas", "Contaminação do solo", "ANORMAL", "ATUAL", "DIRETA", 3, 1, 1, true, false, "Bandejas de contenção; kit de mitigação"],
    [beta, "Pintura", "Descarte de latas e solventes", "Contaminação do solo por resíduo classe D", "NORMAL", "ATUAL", "DIRETA", 3, 2, 1, true, false, "Armazenamento coberto; coleta por empresa licenciada"],
    [beta, "Canteiro", "Consumo de água potável", "Esgotamento de recurso natural", "NORMAL", "ATUAL", "DIRETA", 1, 3, 1, false, false, "Medição mensal e redutores de vazão"],
    [beta, "Supressão", "Supressão de vegetação para acesso", "Perda de habitat", "NORMAL", "PASSADA", "DIRETA", 3, 1, 2, true, false, "Autorização de supressão e compensação ambiental"],
    [beta, "Suprimentos", "Transporte de materiais por fornecedores", "Emissão de gases de efeito estufa", "NORMAL", "ATUAL", "INDIRETA", 1, 3, 3, false, false, "Critério de proximidade na seleção de fornecedores"],
    [beta, "Almoxarifado", "Incêndio no depósito de inflamáveis", "Emissões atmosféricas e contaminação por água de combate", "EMERGENCIA", "FUTURA", "DIRETA", 3, 1, 3, true, true, "Plano de emergência; brigada; contenção"],
  ];
  const config = PADRAO_ASPECTO_IMPACTO;
  for (const [n, s] of S.entries()) {
    const numero = n + 1;
    const p = pontuarLaia(config, { severidade: s[7], frequencia: s[8], abrangencia: s[9], requisitoLegal: s[10], partesInteressadas: s[11] });
    const dados = {
      obraId: s[0], processoId: pf03, atividade: s[1], aspecto: s[2], impacto: s[3], situacao: s[4], temporalidade: s[5], incidencia: s[6],
      severidade: s[7], frequencia: s[8], abrangencia: s[9], requisitoLegal: s[10], partesInteressadas: s[11], controles: s[12],
      score: p.score, faixa: p.faixa, significativo: p.significativo, responsavelId: amb, modoReavaliacao: numero > 5 ? ("GERAL" as const) : ("ITEM" as const),
      periodicidadeMeses: 12, proximaReavaliacaoEm: new Date(numero === 1 ? "2026-10-08T00:00:00.000Z" : "2027-07-31T00:00:00.000Z"), status: "VIGENTE" as const,
    };
    const l = await prisma.linhaLaia.upsert({ where: { empresaId_numero: { empresaId, numero } }, update: dados, create: { ...dados, empresaId, numero, criadoPorId: amb } });
    if ((await prisma.historicoLinhaLaia.count({ where: { linhaId: l.id } })) === 0) {
      await prisma.historicoLinhaLaia.create({
        data: { empresaId, linhaId: l.id, acao: "INCLUSAO", versao: 0, dados: { ...dados, proximaReavaliacaoEm: null, codigo: codigoLaia(l) }, observacao: "Cadastro inicial (seed).", usuarioId: amb },
      });
    }
    if (numero === 2 && !l.planoAcaoId) {
      const plano = await prisma.planoAcao.create({
        data: { empresaId, origemTipo: "LAIA", origemId: l.id, titulo: "Reduzir entulho enviado a aterro na Obra Alfa", descricao: "Plano de ação da linha LAIA A-002.", obraId: alfa, criadoPorId: amb },
      });
      await prisma.itemAcao.create({ data: { empresaId, planoAcaoId: plano.id, ciclo: 1, ordem: 1, oQue: "Contratar britagem móvel para reaproveitar entulho classe A", quemId: amb, quando: new Date("2026-12-15T00:00:00.000Z") } });
      await prisma.linhaLaia.update({ where: { id: l.id }, data: { planoAcaoId: plano.id } });
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
