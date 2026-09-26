/**
 * Seed de Inspeções / checklists (P5) — Monto: 3 modelos e 5 inspeções feitas pelo próprio serviço
 * (código INSP sequencial, respostas, fotos reais em PNG), 2 delas gerando RNC de verdade (origem
 * INSPECAO, foto como evidência) e 1 gerando item de ação. Idempotente: modelos por nome; inspeções
 * só são criadas se a empresa ainda não tiver nenhuma.
 */
import type { PrismaClient, TipoChecklist, TipoRespostaChecklist } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { enviarAnexos } from "../src/lib/anexos/servico";
import { criarDbTenant } from "../src/lib/db-tenant";
import {
  abrirRncDaResposta,
  concluirInspecao,
  criarItemAcaoDaResposta,
  criarModelo,
  iniciarInspecao,
  obterInspecao,
  responder,
} from "../src/lib/inspecoes/servico";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { gerarPngExemplo } from "../scripts/png-exemplo";

type ItemSemente = [string, TipoRespostaChecklist, boolean, string?];

const MODELOS: { nome: string; tipo: TipoChecklist; descricao: string; notaMinima?: number; itens: ItemSemente[] }[] = [
  {
    nome: "Inspeção de Segurança de Obra",
    tipo: "SSO",
    descricao: "Verificação semanal das condições de segurança do canteiro (NR-18).",
    itens: [
      ["Trabalhadores usam capacete, botina e óculos na frente de serviço?", "CONFORME_NAO_CONFORME_NA", true, "Todos na frente de serviço, inclusive terceiros."],
      ["Guarda-corpos instalados em lajes e aberturas de periferia?", "CONFORME_NAO_CONFORME_NA", true, "Altura 1,20 m, rodapé 20 cm, sem vãos."],
      ["Andaimes com placa de liberação e piso completo?", "CONFORME_NAO_CONFORME_NA", true],
      ["Cinto paraquedista ancorado em linha de vida para trabalho em altura?", "CONFORME_NAO_CONFORME_NA", true],
      ["Instalações elétricas provisórias protegidas (quadros fechados, DR)?", "CONFORME_NAO_CONFORME_NA", true],
      ["Extintores sinalizados, desobstruídos e dentro da validade?", "SIM_NAO", false],
      ["Área de circulação livre e sinalizada?", "SIM_NAO", false],
      ["Observações gerais da frente de serviço", "TEXTO", false],
    ],
  },
  {
    nome: "Checklist 5S",
    tipo: "GERAL",
    descricao: "Avaliação de organização e limpeza (nota 1 a 5; abaixo de 3 = não conforme).",
    notaMinima: 3,
    itens: [
      ["Seiri — apenas materiais necessários no local", "NOTA_1A5", false],
      ["Seiton — ferramentas e materiais identificados e em seus lugares", "NOTA_1A5", false],
      ["Seiso — piso, bancadas e equipamentos limpos", "NOTA_1A5", true],
      ["Seiketsu — padrões visuais (demarcação, etiquetas) mantidos", "NOTA_1A5", false],
      ["Shitsuke — equipe segue a rotina 5S sem cobrança", "NOTA_1A5", false],
      ["Almoxarifado com controle de entrada e saída?", "SIM_NAO", false],
      ["Sugestões de melhoria", "TEXTO", false],
    ],
  },
  {
    nome: "Inspeção Ambiental de Canteiro",
    tipo: "MEIO_AMBIENTE",
    descricao: "Resíduos, efluentes e emissões no canteiro de obras.",
    itens: [
      ["Baias de resíduos segregadas e identificadas por classe?", "CONFORME_NAO_CONFORME_NA", true],
      ["Resíduos perigosos (classe D) armazenados cobertos e sobre contenção?", "CONFORME_NAO_CONFORME_NA", true],
      ["Lavagem de betoneiras direcionada à bacia de decantação?", "CONFORME_NAO_CONFORME_NA", true],
      ["Vias umectadas para controle de poeira?", "SIM_NAO", false],
      ["MTR/CTR dos resíduos destinados arquivados?", "SIM_NAO", false],
      ["Kit de mitigação de vazamentos disponível?", "SIM_NAO", false],
    ],
  },
];

async function ator(prisma: PrismaClient, email: string): Promise<Ator> {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { email }, include: { perfil: true, acessosObra: true } });
  const permissoes = permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []);
  const todas = u.escopoObras === "TODAS" || permissoes.includes("VER_TODAS_OBRAS");
  return { db: criarDbTenant(u.empresaId, prisma), empresaId: u.empresaId, usuarioId: u.id, permissoes, obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId) };
}

/** Resposta por ordem: "C"/"NC"/"NA"/"S"/"N", número (nota) ou texto livre. */
type Resp = string | number;

async function executar(
  a: Ator,
  inspecaoId: string,
  respostas: Resp[],
  extras: { comentarios?: Record<number, string>; fotos?: number[]; ate?: number } = {},
) {
  const i = (await obterInspecao(a, inspecaoId))!;
  const mapa: Record<string, string> = { C: "CONFORME", NC: "NAO_CONFORME", NA: "NAO_APLICAVEL", S: "SIM", N: "NAO" };
  for (const r of i.respostas) {
    if (extras.ate && r.ordem > extras.ate) break;
    const v = respostas[r.ordem - 1];
    if (v === undefined) continue;
    const d =
      r.tipoResposta === "NOTA_1A5" ? { nota: Number(v) } : r.tipoResposta === "TEXTO" ? { texto: String(v) } : { resposta: mapa[String(v)] };
    await responder(a, r.id, { ...d, comentario: extras.comentarios?.[r.ordem] ?? null });
    if (extras.fotos?.includes(r.ordem)) {
      await enviarAnexos(a, { tipo: "RESPOSTA_INSPECAO", entidadeId: r.id }, [{ nome: `foto-pergunta-${r.ordem}.png`, dados: gerarPngExemplo([190, 70, 40]) }]);
    }
  }
  return (await obterInspecao(a, inspecaoId))!;
}

export async function semearInspecoes(prisma: PrismaClient, empresaId: string) {
  const qualidade = await ator(prisma, "qualidade@monto.com.br");
  const seg = await ator(prisma, "seguranca@monto.com.br");
  const amb = await ator(prisma, "meioambiente@monto.com.br");
  const inspetor = await ator(prisma, "inspetor@monto.com.br");

  const modelos: Record<string, string> = {};
  for (const m of MODELOS) {
    const existente = await prisma.modeloChecklist.findUnique({ where: { empresaId_nome: { empresaId, nome: m.nome } } });
    modelos[m.nome] =
      existente?.id ??
      (
        await criarModelo(
          qualidade,
          { nome: m.nome, tipo: m.tipo, descricao: m.descricao, notaMinima: m.notaMinima },
          m.itens.map(([pergunta, tipoResposta, obrigatorioFoto, ajuda]) => ({ pergunta, tipoResposta, obrigatorioFoto, ajuda })),
        )
      ).id;
  }

  if ((await prisma.inspecao.count({ where: { empresaId } })) > 0) return;
  const obra = async (nome: string) => (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome } })).id;
  const alfa = await obra("Obra Alfa");
  const beta = await obra("Obra Beta");
  const setor = async (nome: string) => (await prisma.setor.findFirstOrThrow({ where: { empresaId, nome } })).id;
  const pf03 = (await prisma.processo.findUnique({ where: { empresaId_codigo: { empresaId, codigo: "PF-03" } } }))?.id ?? null;
  const tecnicoSeg = seg.usuarioId;

  // 1) Segurança — Obra Alfa: guarda-corpo ausente vira RNC real (foto como evidência).
  const i1 = await iniciarInspecao(seg, { modeloId: modelos["Inspeção de Segurança de Obra"], obraId: alfa, setorId: await setor("Segurança"), processoId: pf03, dataInspecao: "2026-09-02" });
  const r1 = await executar(seg, i1.id, ["C", "NC", "C", "C", "C", "S", "S", "Frente de alvenaria do 4º pavimento."], {
    comentarios: { 2: "Periferia da laje do 5º pavimento sem guarda-corpo em 12 m, lado norte." },
    fotos: [2],
  });
  await abrirRncDaResposta(seg, r1.respostas[1].id, { gravidade: "ALTA", responsavelId: tecnicoSeg });
  await concluirInspecao(seg, i1.id, { observacoes: "Frente paralisada até a instalação do guarda-corpo." });

  // 2) 5S — Obra Alfa: limpeza com nota baixa vira só item de ação.
  const i2 = await iniciarInspecao(qualidade, { modeloId: modelos["Checklist 5S"], obraId: alfa, setorId: await setor("Qualidade"), dataInspecao: "2026-09-10" });
  const r2 = await executar(qualidade, i2.id, [4, 3, 2, 3, 4, "S", "Criar rotina de limpeza no fim do turno."], {
    comentarios: { 3: "Resto de argamassa nas bancadas e piso do almoxarifado." },
    fotos: [3],
  });
  await criarItemAcaoDaResposta(qualidade, r2.respostas[2].id, { oQue: "Implantar rotina de limpeza no fim de cada turno", quemId: inspetor.usuarioId, quando: "2026-10-10", como: "Checklist diário assinado pelo encarregado" });
  await concluirInspecao(qualidade, i2.id);

  // 3) Ambiental — Obra Beta: tudo conforme.
  const i3 = await iniciarInspecao(amb, { modeloId: modelos["Inspeção Ambiental de Canteiro"], obraId: beta, setorId: await setor("Meio Ambiente"), dataInspecao: "2026-09-15" });
  await executar(amb, i3.id, ["C", "C", "NA", "S", "S", "S"]);
  await concluirInspecao(amb, i3.id);

  // 4) Segurança — Obra Beta: extintor vencido (SIM/NÃO) e EPI → RNC de EPI.
  const i4 = await iniciarInspecao(seg, { modeloId: modelos["Inspeção de Segurança de Obra"], obraId: beta, dataInspecao: "2026-09-20" });
  const r4 = await executar(seg, i4.id, ["NC", "C", "C", "NA", "C", "N", "S", "Equipe terceirizada de pintura."], {
    comentarios: { 1: "Dois pintores terceirizados sem óculos de proteção.", 6: "Extintor do almoxarifado vencido em 08/2026." },
    fotos: [1],
  });
  await abrirRncDaResposta(seg, r4.respostas[0].id, { gravidade: "MEDIA" });
  await concluirInspecao(seg, i4.id);

  // 5) 5S — Obra Alfa, pelo inspetor de campo: em andamento (metade respondida).
  const i5 = await iniciarInspecao(inspetor, { modeloId: modelos["Checklist 5S"], obraId: alfa, dataInspecao: "2026-09-25" });
  await executar(inspetor, i5.id, [4, 4, 3], { ate: 3 });
}
