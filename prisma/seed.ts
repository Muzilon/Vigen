import { PrismaClient, type Modulo, type Permissao } from "@prisma/client";
import bcrypt from "bcryptjs";

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
  "REQUISITOS_LEGAIS",
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
      permissoes: ["RNC_VERIFICAR_EFICACIA", "RNC_APROVAR_CANCELAMENTO", "PLANO_GERENCIAR", "RNC_VER_RESTRITAS", "PROCESSO_GERENCIAR"],
    },
    { nome: "Segurança", descricao: "Equipe de SSO", permissoes: ["RNC_TRATAR", "PLANO_GERENCIAR", "RNC_VER_RESTRITAS"] },
    { nome: "Meio Ambiente", descricao: "Equipe de Meio Ambiente", permissoes: ["RNC_TRATAR", "PLANO_GERENCIAR"] },
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

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
