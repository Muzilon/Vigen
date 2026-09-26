/* Executar: npm run test:anexos (requer seed). Usa armazenamento local em pasta temporária. */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { definirArmazenamento } from "../src/lib/armazenamento";
import { criarArmazenamentoLocal } from "../src/lib/armazenamento/local";
import { abrirAnexo, enviarAnexos, excluirAnexo, listarAnexos } from "../src/lib/anexos/servico";
import type { Ator } from "../src/lib/ator";
import { hojeNoFuso } from "../src/lib/datas";
import { criarDbTenant } from "../src/lib/db-tenant";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { adicionarItensRnc } from "../src/lib/plano-acao/servico";
import { assumirAnalise, criarRnc } from "../src/lib/rnc/servico";

const admin = new PrismaClient();
const dir = mkdtempSync(path.join(tmpdir(), "vigen-anexos-"));
definirArmazenamento(criarArmazenamentoLocal(dir));

let ok = 0;
async function caso(nome: string, fn: () => Promise<void>) {
  await fn();
  ok++;
  console.log("  OK", nome);
}

async function ator(email: string): Promise<Ator> {
  const u = await admin.usuario.findUniqueOrThrow({ where: { email }, include: { perfil: true, acessosObra: true } });
  const permissoes = permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []);
  const todas = u.escopoObras === "TODAS" || permissoes.includes("VER_TODAS_OBRAS");
  return {
    db: criarDbTenant(u.empresaId, admin),
    empresaId: u.empresaId,
    usuarioId: u.id,
    permissoes,
    obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId),
  };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n%fake\n"));
const EXE = new Uint8Array(Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1"));

async function lerTudo(s: ReadableStream<Uint8Array>) {
  return new Uint8Array(await new Response(s).arrayBuffer());
}

async function main() {
  const inspetor = await ator("inspetor@monto.com.br");
  const qualidade = await ator("qualidade@monto.com.br");
  const colaborador = await ator("colaborador@monto.com.br");
  const outraEmpresa = await ator("admin@demo.com.br");
  assert.ok(!inspetor.permissoes.includes("RNC_VER_RESTRITAS"), "pré-condição: inspetor sem RNC_VER_RESTRITAS");
  assert.ok(qualidade.permissoes.includes("RNC_VER_RESTRITAS"), "pré-condição: qualidade com RNC_VER_RESTRITAS");

  const rnc = await criarRnc(inspetor, {
    titulo: "Teste anexos — evidência fotográfica",
    descricao: "RNC para testes de anexos",
    tipo: "QUALIDADE",
    origem: "INSPECAO",
    gravidade: "MEDIA",
    obraId: inspetor.obrasPermitidas![0],
  });
  const alvoRnc = { tipo: "RNC" as const, entidadeId: rnc.id };

  console.log("Anexos:");
  let anexoId = "";
  await caso("upload ok (PNG) e download pelo autor com o mesmo conteúdo", async () => {
    const [a] = await enviarAnexos(inspetor, alvoRnc, [{ nome: "foto da obra.png", dados: PNG }]);
    anexoId = a.id;
    assert.equal(a.mimeType, "image/png");
    assert.equal(a.url, null);
    assert.equal(a.sensivel, false);
    assert.match(a.chaveArmazenamento, new RegExp(`^${inspetor.empresaId}/RNC/[0-9a-f-]{36}-foto_da_obra\\.png$`));
    const r = await abrirAnexo(inspetor, a.id);
    assert.ok(r);
    assert.deepEqual(await lerTudo(r.stream), PNG);
    assert.equal((await listarAnexos(qualidade, alvoRnc)).length, 1);
  });

  await caso("tipo proibido: executável renomeado para .pdf e extensão .exe são rejeitados", async () => {
    await assert.rejects(enviarAnexos(inspetor, alvoRnc, [{ nome: "laudo.pdf", dados: EXE }]), /não corresponde/);
    await assert.rejects(enviarAnexos(inspetor, alvoRnc, [{ nome: "setup.exe", dados: EXE }]), /não permitido/);
    await assert.rejects(enviarAnexos(inspetor, alvoRnc, [{ nome: "foto.jpg", dados: PNG }]), /extensão não corresponde/);
  });

  await caso("tamanho acima do limite é rejeitado", async () => {
    const grande = new Uint8Array(10 * 1024 * 1024 + 1);
    grande.set(PDF);
    await assert.rejects(enviarAnexos(inspetor, alvoRnc, [{ nome: "grande.pdf", dados: grande }]), /limite/);
  });

  await caso("outra empresa não baixa nem lista", async () => {
    assert.equal(await abrirAnexo(outraEmpresa, anexoId), null);
    assert.deepEqual(await listarAnexos(outraEmpresa, alvoRnc), []);
    await assert.rejects(excluirAnexo(outraEmpresa, anexoId), /não encontrado/);
  });

  await caso("usuário sem acesso à RNC não baixa nem envia", async () => {
    assert.equal(await abrirAnexo(colaborador, anexoId), null);
    await assert.rejects(enviarAnexos(colaborador, alvoRnc, [{ nome: "x.pdf", dados: PDF }]), /sem acesso/);
  });

  let sensivelId = "";
  await caso("sensível: sem RNC_VER_RESTRITAS não envia/baixa; com permissão marca sensivel=true", async () => {
    const alvoS = { tipo: "RNC_DADOS_SENSIVEIS" as const, entidadeId: rnc.id };
    await assert.rejects(enviarAnexos(inspetor, alvoS, [{ nome: "atestado.pdf", dados: PDF }]), /sem acesso/);
    const [s] = await enviarAnexos(qualidade, alvoS, [{ nome: "atestado.pdf", dados: PDF }]);
    sensivelId = s.id;
    assert.equal(s.sensivel, true);
    assert.equal(await abrirAnexo(inspetor, s.id), null); // vê a RNC, mas não o anexo sensível
    assert.deepEqual(await listarAnexos(inspetor, alvoS), []);
    assert.ok(await abrirAnexo(qualidade, s.id));
  });

  await caso("item de ação: 'quem' anexa evidência ao próprio item; terceiro sem acesso não", async () => {
    await assumirAnalise(inspetor, rnc.id);
    await adicionarItensRnc(inspetor, rnc.id, [
      { oQue: "Refazer concretagem", quemId: colaborador.usuarioId, quando: hojeNoFuso("America/Sao_Paulo") },
    ]);
    const item = await admin.itemAcao.findFirstOrThrow({ where: { planoAcao: { rnc: { id: rnc.id } } } });
    const alvoI = { tipo: "ITEM_ACAO" as const, entidadeId: item.id };
    const [e] = await enviarAnexos(colaborador, alvoI, [{ nome: "evidencia.pdf", dados: PDF }]);
    assert.ok(await abrirAnexo(colaborador, e.id));
    assert.ok(await abrirAnexo(inspetor, e.id)); // gerencia o plano
    assert.equal(await abrirAnexo(outraEmpresa, e.id), null);
  });

  await caso("exclusão: só autor/gestor; soft delete + evento no histórico da RNC", async () => {
    // colaborador não tem acesso à RNC → nem enxerga o anexo
    await assert.rejects(excluirAnexo(colaborador, anexoId), /não encontrado/);
    await excluirAnexo(inspetor, anexoId);
    const a = await admin.anexo.findUniqueOrThrow({ where: { id: anexoId } });
    assert.ok(a.excluidoEm);
    assert.equal(a.excluidoPorId, inspetor.usuarioId);
    assert.equal(await abrirAnexo(inspetor, anexoId), null);
    const h = await admin.historicoStatusRnc.findMany({ where: { rncId: rnc.id } });
    assert.ok(h.some((x) => (x.metadados as { evento?: string } | null)?.evento === "ANEXO_EXCLUIDO"));
    // anexo sensível: histórico não expõe o nome do arquivo
    await excluirAnexo(qualidade, sensivelId);
    await assert.rejects(excluirAnexo(qualidade, sensivelId), /não encontrado/);
  });

  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error("FALHOU:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await admin.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });
