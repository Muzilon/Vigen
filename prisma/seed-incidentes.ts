/**
 * Seed de Incidentes e Acidentes (P6) — Monto: 6 registros (3 quase-acidentes, 2 típicos — 1 com afastamento —,
 * 1 de trajeto; nenhuma fatalidade), 1 restrito com dados sensíveis reais (envolvido colaborador), 1 com plano de ação de
 * investigação, 2 concluídos com causa raiz e fotos. Feito pelo serviço. Idempotente: só cria se a empresa não tiver incidentes.
 */
import type { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { enviarAnexos } from "../src/lib/anexos/servico";
import { criarDbTenant } from "../src/lib/db-tenant";
import {
  concluirIncidente,
  definirResponsavel,
  gerarPlanoIncidente,
  iniciarInvestigacao,
  registrarIncidente,
  salvarInvestigacao,
} from "../src/lib/incidentes/servico";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { gerarPngExemplo } from "../scripts/png-exemplo";

async function ator(prisma: PrismaClient, email: string): Promise<Ator> {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { email }, include: { perfil: true, acessosObra: true } });
  const permissoes = permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []);
  const todas = u.escopoObras === "TODAS" || permissoes.includes("VER_TODAS_OBRAS");
  return { db: criarDbTenant(u.empresaId, prisma), empresaId: u.empresaId, usuarioId: u.id, permissoes, obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId) };
}

/** Instante de N dias atrás às HH:mm (UTC-3 aproximado para o seed). */
const diasAtras = (n: number, hora: string) => new Date(`${new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)}T${hora}:00.000-03:00`);

export async function semearIncidentes(prisma: PrismaClient, empresaId: string) {
  if ((await prisma.incidente.count({ where: { empresaId } })) > 0) return;
  const seg = await ator(prisma, "seguranca@monto.com.br");
  const insp = await ator(prisma, "inspetor@monto.com.br");
  const colab = await prisma.usuario.findUniqueOrThrow({ where: { email: "colaborador@monto.com.br" } });
  const alfa = (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome: "Obra Alfa" } })).id;
  const beta = (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome: "Obra Beta" } })).id;
  const setorSeg = (await prisma.setor.findFirst({ where: { empresaId, nome: "Segurança" } }))?.id ?? null;
  const prazo = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

  // 1) Quase-acidente concluído (queda de material) — com foto e 5 porquês.
  const i1 = await registrarIncidente(insp, {
    tipo: "QUASE_ACIDENTE", gravidade: "SEM_AFASTAMENTO", dataHora: diasAtras(70, "09:40"), obraId: alfa, local: "Torre A, 5º pavimento, borda da laje",
    descricaoFatos: "Martelo caiu da laje do 5º pavimento durante a desforma e atingiu a área de circulação no térreo, sem ninguém no local. Não havia tela de proteção nem rodapé na borda.",
  });
  await enviarAnexos(insp, { tipo: "INCIDENTE", entidadeId: i1.id }, [{ nome: "borda-sem-rodape.png", dados: gerarPngExemplo([150, 120, 80]) }]);
  await iniciarInvestigacao(seg, i1.id);
  await salvarInvestigacao(seg, i1.id, {
    metodo: "CINCO_PORQUES",
    analise: { porques: ["A ferramenta caiu da borda da laje.", "Não havia rodapé nem tela na periferia.", "A proteção foi retirada para a desforma.", "O procedimento de desforma não previa recolocar a proteção.", "O PGR não tratava a etapa de desforma."] },
    causaRaiz: "Procedimento de desforma sem etapa de reinstalação da proteção periférica (rodapé e tela).",
  });
  await concluirIncidente(seg, i1.id, { conclusao: "Procedimento de desforma revisado (IT-012 Rev. 02) com reinstalação imediata de rodapé; DDS realizado com as equipes de carpintaria." });

  // 2) Quase-acidente aberto (talude) — Obra Beta.
  await registrarIncidente(seg, {
    tipo: "QUASE_ACIDENTE", gravidade: "SEM_AFASTAMENTO", dataHora: diasAtras(3, "15:10"), obraId: beta, setorId: setorSeg, local: "Escavação do subsolo, face leste",
    descricaoFatos: "Desprendimento de solo na face leste da escavação após chuva, a 1,5 m de onde a equipe trabalhava minutos antes. Escoramento previsto ainda não instalado nesse trecho.",
  });

  // 3) Acidente típico sem afastamento — RESTRITO com dados sensíveis reais (colaborador envolvido).
  const i3 = await registrarIncidente(insp, {
    tipo: "ACIDENTE_TIPICO", gravidade: "SEM_AFASTAMENTO", dataHora: diasAtras(12, "10:25"), obraId: alfa, local: "Central de armação",
    descricaoFatos: "Corte superficial na mão esquerda ao manusear vergalhão com rebarba durante o corte na policorte. Atendimento no ambulatório da obra e retorno à atividade no mesmo dia.",
    envolvidoId: colab.id,
    testemunhas: "Encarregado da armação; ajudante da central de armação",
    sensiveis: {
      nomeEnvolvido: "Colaborador Monto",
      documentoEnvolvido: "123.456.789-09",
      funcaoEnvolvido: "Armador",
      relato: "Estava cortando o vergalhão de 10 mm e a luva de raspa estava furada na palma; a rebarba entrou pelo furo.",
      lesaoDescricao: "Corte superficial de 2 cm na palma da mão esquerda; curativo, sem sutura.",
      testemunhasRelato: "O encarregado confirmou que a luva estava danificada e que não havia luva reserva na central.",
    },
  });
  await iniciarInvestigacao(seg, i3.id);

  // 4) Acidente típico COM afastamento — terceiro (restrito), CAT, plano de ação de investigação.
  const i4 = await registrarIncidente(seg, {
    tipo: "ACIDENTE_TIPICO", gravidade: "COM_AFASTAMENTO", dataHora: diasAtras(20, "14:05"), obraId: beta, local: "Bloco 2, escada de acesso provisória",
    descricaoFatos: "Queda da escada de mão ao acessar o mezanino, altura aproximada de 1,8 m, com entorse do tornozelo. Escada sem amarração no topo e sem sapatas antiderrapantes.",
    terceiroNome: "Servente da empreiteira de alvenaria",
    terceiroFuncao: "Servente — Empreiteira Paredão",
    diasPerdidos: 12,
    geraCat: true,
    numeroCat: "2026.09.0001234-5",
  });
  await enviarAnexos(seg, { tipo: "INCIDENTE", entidadeId: i4.id }, [{ nome: "escada-sem-amarracao.png", dados: gerarPngExemplo([90, 140, 90]) }]);
  await iniciarInvestigacao(seg, i4.id);
  await salvarInvestigacao(seg, i4.id, {
    metodo: "ISHIKAWA",
    analise: { ishikawa: { metodo: "Não havia permissão/checklist para uso de escada de mão.", material: "Escada sem sapatas antiderrapantes e sem amarração.", maoDeObra: "Terceiro sem integração de segurança completa (NR-18/NR-35)." } },
    causaRaiz: "Uso de escada de mão sem inspeção e amarração, por terceiro sem integração completa.",
  });
  await gerarPlanoIncidente(seg, i4.id, {
    itens: [
      { oQue: "Substituir escadas de mão de acesso ao mezanino por escada fixa com guarda-corpo", quemId: seg.usuarioId, quando: prazo(15), onde: "Obra Beta, Bloco 2", porQue: "Eliminar o risco de queda (hierarquia de controle)" },
      { oQue: "Incluir inspeção de escadas no checklist diário e integração obrigatória de terceiros", quemId: seg.usuarioId, quando: prazo(10) },
    ],
  });

  // 5) Acidente de trajeto sem afastamento (sem envolvido identificado no registro).
  await registrarIncidente(seg, {
    tipo: "ACIDENTE_TRAJETO", gravidade: "SEM_AFASTAMENTO", dataHora: diasAtras(35, "06:50"), obraId: alfa,
    descricaoFatos: "Colisão leve de motocicleta a caminho da obra; escoriações leves tratadas no pronto atendimento, sem afastamento.",
  });

  // 6) Quase-acidente concluído (elétrico).
  const i6 = await registrarIncidente(insp, {
    tipo: "QUASE_ACIDENTE", gravidade: "SEM_AFASTAMENTO", dataHora: diasAtras(45, "11:30"), obraId: alfa, local: "Quadro provisório do 2º pavimento",
    descricaoFatos: "Extensão com isolamento danificado encontrada energizada sobre piso molhado; desligada antes do uso.",
  });
  await definirResponsavel(seg, i6.id, seg.usuarioId);
  await iniciarInvestigacao(seg, i6.id);
  await salvarInvestigacao(seg, i6.id, { metodo: "OUTRO", analise: { texto: "Extensões montadas na obra sem inspeção periódica nem identificação." }, causaRaiz: "Ausência de inspeção periódica de extensões e ferramentas elétricas." });
  await concluirIncidente(seg, i6.id, { conclusao: "Instituída etiqueta de inspeção mensal por cor para extensões e ferramentas elétricas." });
}
