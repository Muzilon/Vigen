/**
 * Seed de Treinamentos (P7) — Monto: 5 treinamentos (Integração, NR-35, NR-18, Brigada de incêndio, Gestão de resíduos)
 * com 1-3 sessões cada e participações dos usuários de teste, em datas relativas a hoje para que a matriz tenha
 * sempre casos vencidos, a vencer (≤ 30 dias), em dia e não realizados; uma reciclagem que resolve um vencido e
 * certificados PDF em algumas participações. Feito pelo serviço. Idempotente: só cria se não houver treinamentos.
 */
import type { PrismaClient, TipoTreinamento } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { hojeNoFuso, somarDias } from "../src/lib/datas";
import { criarDbTenant } from "../src/lib/db-tenant";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { anexarCertificado, criarTreinamento, lancarPresencas, registrarSessao } from "../src/lib/treinamentos/servico";
import { gerarPdfExemplo } from "../scripts/pdf-exemplo";

async function ator(prisma: PrismaClient, email: string): Promise<Ator> {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { email }, include: { perfil: true, acessosObra: true } });
  const permissoes = permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []);
  const todas = u.escopoObras === "TODAS" || permissoes.includes("VER_TODAS_OBRAS");
  return { db: criarDbTenant(u.empresaId, prisma), empresaId: u.empresaId, usuarioId: u.id, permissoes, obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId) };
}

type Email = "admin" | "qualidade" | "inspetor" | "colaborador" | "seguranca" | "meioambiente";
interface SessaoSeed {
  /** Dias antes de hoje. */
  diasAtras: number;
  instrutor: string;
  obra?: "Obra Alfa" | "Obra Beta";
  presentes: Email[];
  ausentes?: Email[];
  certificados?: Email[];
  aproveitamento?: Partial<Record<Email, string>>;
}

export async function semearTreinamentos(prisma: PrismaClient, empresaId: string) {
  if ((await prisma.treinamento.count({ where: { empresaId } })) > 0) return;
  const q = await ator(prisma, "qualidade@monto.com.br");
  const hoje = hojeNoFuso("America/Sao_Paulo");
  const ids = Object.fromEntries(
    await Promise.all(
      (["admin", "qualidade", "inspetor", "colaborador", "seguranca", "meioambiente"] as Email[]).map(async (e) => [e, (await prisma.usuario.findUniqueOrThrow({ where: { email: `${e}@monto.com.br` } })).id] as const),
    ),
  ) as Record<Email, string>;
  const nomes = Object.fromEntries(await Promise.all(Object.entries(ids).map(async ([e, id]) => [e, (await prisma.usuario.findUniqueOrThrow({ where: { id } })).nome]))) as Record<Email, string>;
  const setor = async (nome: string) => (await prisma.setor.findUniqueOrThrow({ where: { empresaId_nome: { empresaId, nome } } })).id;
  const [segSetor, ambSetor] = await Promise.all([setor("Segurança"), setor("Meio Ambiente")]);
  const obra = async (nome: string) => (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome } })).id;

  const catalogo: { nome: string; tipo: TipoTreinamento; cargaHoraria: number; validadeMeses: number | null; obrigatorioTodos?: boolean; setores?: string[]; descricao: string; sessoes: SessaoSeed[] }[] = [
    {
      nome: "Integração de segurança e SGI", tipo: "INTEGRACAO", cargaHoraria: 4, validadeMeses: 12, obrigatorioTodos: true,
      descricao: "Política do SGI, riscos da obra, uso de EPI, plano de emergência, canais para relatar incidentes e quase-acidentes.",
      sessoes: [
        { diasAtras: 381, instrutor: "Técnico de Segurança (interno)", obra: "Obra Alfa", presentes: ["colaborador"], ausentes: ["admin"] },
        { diasAtras: 346, instrutor: "Técnico de Segurança (interno)", obra: "Obra Alfa", presentes: ["inspetor", "seguranca"], certificados: ["inspetor"] },
        { diasAtras: 208, instrutor: "Gestora da Qualidade", presentes: ["qualidade", "meioambiente", "admin"], certificados: ["meioambiente"] },
      ],
    },
    {
      nome: "NR-35 — Trabalho em altura", tipo: "NR", cargaHoraria: 8, validadeMeses: 24, setores: [segSetor],
      descricao: "Análise de risco, permissão de trabalho, sistemas de proteção contra quedas, resgate. Reciclagem bienal (NR-35 item 35.3.3).",
      sessoes: [
        { diasAtras: 840, instrutor: "Altura Segura Treinamentos Ltda.", obra: "Obra Alfa", presentes: ["seguranca"] },
        { diasAtras: 721, instrutor: "Altura Segura Treinamentos Ltda.", obra: "Obra Alfa", presentes: ["inspetor", "colaborador"], certificados: ["inspetor", "colaborador"], aproveitamento: { inspetor: "9,0", colaborador: "7,5" } },
        { diasAtras: 37, instrutor: "Altura Segura Treinamentos Ltda.", obra: "Obra Beta", presentes: ["seguranca"], ausentes: ["colaborador"], certificados: ["seguranca"], aproveitamento: { seguranca: "10,0" } },
      ],
    },
    {
      nome: "NR-18 — Segurança na construção civil", tipo: "NR", cargaHoraria: 6, validadeMeses: 12, setores: [segSetor, ambSetor],
      descricao: "Treinamento admissional/periódico da NR-18: condições e meio ambiente de trabalho na indústria da construção.",
      sessoes: [
        { diasAtras: 420, instrutor: "SESI — Construção", presentes: ["inspetor"] },
        { diasAtras: 137, instrutor: "SESI — Construção", obra: "Obra Beta", presentes: ["seguranca", "meioambiente"], certificados: ["seguranca"] },
      ],
    },
    {
      nome: "Brigada de incêndio", tipo: "TECNICO", cargaHoraria: 16, validadeMeses: 12,
      descricao: "Formação de brigadistas (NBR 14276): prevenção, combate a princípio de incêndio, primeiros socorros e abandono de área.",
      sessoes: [
        { diasAtras: 341, instrutor: "Corpo de Bombeiros — curso credenciado", presentes: ["admin"], aproveitamento: { admin: "apto" } },
        { diasAtras: 218, instrutor: "Corpo de Bombeiros — curso credenciado", presentes: ["seguranca", "qualidade"], aproveitamento: { seguranca: "apto", qualidade: "apto" } },
      ],
    },
    {
      nome: "Gestão de resíduos da construção (PGRCC)", tipo: "TECNICO", cargaHoraria: 4, validadeMeses: null, setores: [ambSetor],
      descricao: "Segregação na fonte, baias, MTR, destinação licenciada (CONAMA 307/2002).",
      sessoes: [{ diasAtras: 171, instrutor: "Analista Ambiental", obra: "Obra Alfa", presentes: ["meioambiente", "colaborador"] }],
    },
  ];

  for (const c of catalogo) {
    const { id: treinamentoId } = await criarTreinamento(q, {
      nome: c.nome, tipo: c.tipo, cargaHoraria: c.cargaHoraria, validadeMeses: c.validadeMeses, descricao: c.descricao,
      obrigatorioTodos: c.obrigatorioTodos, obrigatorioSetorIds: c.setores,
    });
    for (const s of c.sessoes) {
      const data = somarDias(hoje, -s.diasAtras);
      const { id: sessaoId } = await registrarSessao(q, treinamentoId, { dataRealizacao: data, instrutor: s.instrutor, obraId: s.obra ? await obra(s.obra) : null, cargaHoraria: c.cargaHoraria });
      const linhas = [
        ...s.presentes.map((e) => ({ usuarioId: ids[e], presente: true, aproveitamento: s.aproveitamento?.[e] ?? null })),
        ...(s.ausentes ?? []).map((e) => ({ usuarioId: ids[e], presente: false })),
      ];
      const part = await lancarPresencas(q, sessaoId, linhas);
      for (const e of s.certificados ?? []) {
        const pdf = gerarPdfExemplo(`Certificado - ${c.nome}`, [`Participante: ${nomes[e]}`, `Carga horaria: ${c.cargaHoraria} h`, `Realizado em: ${data.split("-").reverse().join("/")}`, `Instrutor: ${s.instrutor}`]);
        await anexarCertificado(q, part.get(ids[e])!, { nome: `certificado-${c.tipo.toLowerCase()}-${e}.pdf`, dados: pdf });
      }
    }
  }
}
