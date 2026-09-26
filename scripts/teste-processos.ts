/* Executar: npm run test:processos (requer seed). Mapa de processos: CRUD, gating, permissão, versões, isolamento. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroConflito, ErroNegocio } from "../src/lib/erros";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { decidir } from "../src/lib/aprovacao";
import "../src/lib/processos/aprovacao";
import {
  adicionarIndicador,
  adicionarInteracao,
  criarProcesso,
  definirAtivo,
  editarProcesso,
  listarProcessos,
  listarVersoes,
  moverProcesso,
  moverTipo,
  obterProcesso,
  publicarVersao,
  removerInteracao,
  solicitarPublicacao,
} from "../src/lib/processos/servico";

const admin = new PrismaClient();
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

const erro = (re: RegExp) => (e: unknown) => e instanceof ErroNegocio && re.test(e.message);

async function main() {
  const qualidade = await ator("qualidade@monto.com.br");
  const adminMonto = await ator("admin@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const adminDemo = await ator("admin@demo.com.br");
  const sufixo = randomUUID().slice(0, 6).toUpperCase();
  const cod = (n: string) => `T${n}-${sufixo}`;
  const criados: string[] = [];

  try {
    await caso("perfil Qualidade tem PROCESSO_GERENCIAR; admin também", async () => {
      assert.ok(qualidade.permissoes.includes("PROCESSO_GERENCIAR"));
      assert.ok(adminMonto.permissoes.includes("PROCESSO_GERENCIAR"));
      assert.ok(!colab.permissoes.includes("PROCESSO_GERENCIAR"));
    });

    let a1 = "";
    let a2 = "";
    await caso("CRUD: criar, listar, editar (com indicadores da planilha) e mover de tipo", async () => {
      a1 = (await criarProcesso(qualidade, { codigo: cod("a"), nome: "Teste A", tipo: "FINALISTICO", indicadores: "Prazo\nCusto", donoId: qualidade.usuarioId })).id;
      a2 = (await criarProcesso(qualidade, { codigo: cod("b"), nome: "Teste B", tipo: "FINALISTICO" })).id;
      criados.push(a1, a2);
      const lista = await listarProcessos(colab);
      const pa = lista.find((p) => p.id === a1)!;
      assert.equal(pa.codigo, cod("A"));
      assert.deepEqual(pa.indicadores.map((i) => i.nome), ["Prazo", "Custo"]);
      const pb = lista.find((p) => p.id === a2)!;
      assert.equal(pb.ordem, pa.ordem + 1, "novo processo vai para o fim da raia");

      await editarProcesso(qualidade, a1, { codigo: cod("a"), nome: "Teste A2", tipo: "FINALISTICO", entradas: "E1", indicadores: "Custo\nSatisfação" }, pa.revisao);
      const d = await obterProcesso(qualidade, a1);
      assert.equal(d?.nome, "Teste A2");
      assert.equal(d?.entradas, "E1");
      assert.deepEqual(d?.indicadores.map((i) => i.nome), ["Custo", "Satisfação"]);
      await assert.rejects(
        editarProcesso(qualidade, a1, { codigo: cod("a"), nome: "Xyz", tipo: "FINALISTICO" }, pa.revisao),
        (e: unknown) => e instanceof ErroConflito,
        "revisão antiga → conflito",
      );
    });

    await caso("reordenar ↑↓ na raia e mover de tipo", async () => {
      const ordem = async (id: string) => (await admin.processo.findUniqueOrThrow({ where: { id } })).ordem;
      const antes = [await ordem(a1), await ordem(a2)];
      await moverProcesso(qualidade, a2, "cima");
      assert.ok((await ordem(a2)) < (await ordem(a1)), `a2 sobe acima de a1 (${antes})`);
      await assert.rejects(
        (async () => {
          const raia = await admin.processo.findMany({ where: { empresaId: qualidade.empresaId, tipo: "FINALISTICO", ativo: true }, orderBy: { ordem: "asc" } });
          await moverProcesso(qualidade, raia[0].id, "cima");
        })(),
        erro(/primeiro/),
      );
      await moverTipo(qualidade, a2, "APOIO");
      const b = await admin.processo.findUniqueOrThrow({ where: { id: a2 } });
      assert.equal(b.tipo, "APOIO");
      const maxApoio = await admin.processo.aggregate({ where: { empresaId: qualidade.empresaId, tipo: "APOIO", ativo: true }, _max: { ordem: true } });
      assert.equal(b.ordem, maxApoio._max.ordem, "vai para o fim da nova raia");
    });

    await caso("código único por empresa (inclusive ignorando maiúsculas na entrada)", async () => {
      await assert.rejects(criarProcesso(qualidade, { codigo: cod("a").toLowerCase(), nome: "Duplicado", tipo: "APOIO" }), erro(/Já existe/));
      // Mesmo código em outra empresa é permitido (não há módulo na Demo; testado via admin direto).
      const demo = await admin.empresa.findFirstOrThrow({ where: { nome: "Demo" } });
      const outro = await admin.processo.create({ data: { empresaId: demo.id, codigo: cod("A"), nome: "Outro tenant", tipo: "GESTAO" } });
      await admin.processo.delete({ where: { id: outro.id } });
    });

    await caso("interações: única por par, origem ≠ destino, remover", async () => {
      await adicionarInteracao(qualidade, a1, a2, "entrega");
      await assert.rejects(adicionarInteracao(qualidade, a1, a2), erro(/já existe/));
      await assert.rejects(adicionarInteracao(qualidade, a1, a1), erro(/diferentes/));
      await assert.rejects(admin.interacaoProcesso.create({ data: { empresaId: qualidade.empresaId, origemId: a1, destinoId: a1 } }));
      const it = await admin.interacaoProcesso.findFirstOrThrow({ where: { origemId: a1, destinoId: a2 } });
      await removerInteracao(qualidade, it.id);
      await adicionarInteracao(qualidade, a2, a1, "retorno");
    });

    await caso("permissão: sem PROCESSO_GERENCIAR não escreve (mas lê)", async () => {
      await assert.rejects(criarProcesso(colab, { codigo: cod("c"), nome: "Negado", tipo: "APOIO" }), erro(/PROCESSO_GERENCIAR/));
      await assert.rejects(publicarVersao(colab, a1), erro(/PROCESSO_GERENCIAR/));
      await assert.rejects(adicionarIndicador(colab, a1, { nome: "x" }), erro(/PROCESSO_GERENCIAR/));
      assert.ok((await listarProcessos(colab)).some((p) => p.id === a1));
    });

    await caso("gating: Demo sem o módulo MAPA_PROCESSOS → negado", async () => {
      const demo = await admin.empresa.findUniqueOrThrow({ where: { id: adminDemo.empresaId } });
      assert.ok(!demo.modulosAtivos.includes("MAPA_PROCESSOS"));
      assert.ok(adminDemo.permissoes.includes("PROCESSO_GERENCIAR"), "admin tem a permissão, mas o módulo não está contratado");
      await assert.rejects(listarProcessos(adminDemo), erro(/não contratado/));
      await assert.rejects(criarProcesso(adminDemo, { codigo: "D-1", nome: "Demo", tipo: "APOIO" }), erro(/não contratado/));
    });

    await caso("isolamento: Demo não enxerga nem altera processo da Monto", async () => {
      const demo = await admin.empresa.findUniqueOrThrow({ where: { id: adminDemo.empresaId } });
      await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: [...demo.modulosAtivos, "MAPA_PROCESSOS"] } });
      try {
        assert.equal(await obterProcesso(adminDemo, a1), null);
        assert.ok(!(await listarProcessos(adminDemo)).some((p) => p.id === a1));
        await assert.rejects(editarProcesso(adminDemo, a1, { codigo: "X", nome: "Invasão", tipo: "APOIO" }), erro(/não encontrado/));
        await assert.rejects(publicarVersao(adminDemo, a1), erro(/não encontrado/));
        await assert.rejects(adicionarInteracao(adminDemo, a1, a2), erro(/inválido/));
        assert.equal((await listarVersoes(adminDemo, a1)).length, 0);
      } finally {
        await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: demo.modulosAtivos } });
      }
    });

    await caso("publicar versão: snapshot + versao++; snapshot imutável (trigger)", async () => {
      const r1 = await publicarVersao(qualidade, a1, "primeira");
      assert.equal(r1.versao, 1);
      await editarProcesso(qualidade, a1, { codigo: cod("a"), nome: "Teste A3", tipo: "FINALISTICO" });
      const r2 = await publicarVersao(qualidade, a1);
      assert.equal(r2.versao, 2);
      const vs = await listarVersoes(qualidade, a1);
      assert.deepEqual(vs.map((v) => v.versao), [2, 1]);
      const s1 = vs[1].snapshot as { nome: string; indicadores: { nome: string }[]; interacoes: { entrada: { codigo: string }[] } };
      assert.equal(s1.nome, "Teste A2", "v1 congelou o nome da época");
      assert.deepEqual(s1.indicadores.map((i) => i.nome), ["Custo", "Satisfação"]);
      assert.deepEqual(s1.interacoes.entrada.map((i) => i.codigo), [cod("B")]);
      assert.equal((vs[0].snapshot as { nome: string }).nome, "Teste A3");
      assert.equal((await admin.processo.findUniqueOrThrow({ where: { id: a1 } })).versao, 2);
      await assert.rejects(admin.versaoProcesso.update({ where: { id: vs[1].id }, data: { observacao: "alterada" } }), /imutável/);
      await assert.rejects(admin.versaoProcesso.delete({ where: { id: vs[1].id } }), /imutável/);
    });

    await caso("publicação via aprovação (handler PROCESSO) publica ao aprovar", async () => {
      const f = await solicitarPublicacao(qualidade, a1, { aprovadorIds: [adminMonto.usuarioId], modo: "SEQUENCIAL", observacao: "via fluxo" });
      assert.equal((await admin.processo.findUniqueOrThrow({ where: { id: a1 } })).versao, 2, "ainda não publicou");
      await decidir(adminMonto, f.id, { decisao: "APROVAR" });
      const p = await admin.processo.findUniqueOrThrow({ where: { id: a1 } });
      assert.equal(p.versao, 3);
      const v3 = await admin.versaoProcesso.findFirstOrThrow({ where: { processoId: a1, versao: 3 } });
      assert.equal(v3.publicadoPorId, qualidade.usuarioId);
      assert.match(v3.observacao ?? "", /via fluxo/);
    });

    await caso("inativar tira da lista padrão; inativo não publica; reativar volta", async () => {
      await definirAtivo(qualidade, a2, false);
      assert.ok(!(await listarProcessos(qualidade)).some((p) => p.id === a2));
      assert.ok((await listarProcessos(qualidade, { incluirInativos: true })).some((p) => p.id === a2));
      await assert.rejects(publicarVersao(qualidade, a2), erro(/inativo/));
      await definirAtivo(qualidade, a2, true);
      assert.ok((await listarProcessos(qualidade)).some((p) => p.id === a2));
    });
  } finally {
    // Processos com versão não podem ser apagados (histórico imutável): ficam inativos.
    for (const id of criados) {
      const temVersao = await admin.versaoProcesso.count({ where: { processoId: id } });
      if (temVersao) await admin.processo.update({ where: { id }, data: { ativo: false } });
      else await admin.processo.delete({ where: { id } }).catch(() => undefined);
    }
    await admin.$disconnect();
  }
  console.log(`\n${ok} casos OK (mapa de processos).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
