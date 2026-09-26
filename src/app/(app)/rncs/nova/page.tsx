import Link from "next/link";
import { Cabecalho, cls } from "@/components/ui";
import { exigirPermissao, getDb } from "@/lib/tenant";
import { FormNovaRnc } from "./form-nova";

export default async function NovaRnc() {
  const ctx = await exigirPermissao("RNC_ABRIR");
  const db = await getDb();
  const [obras, setores, usuarios] = await Promise.all([
    db.obraUnidade.findMany({
      where: { ativo: true, ...(ctx.obrasPermitidas ? { id: { in: ctx.obrasPermitidas } } : {}) },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    db.setor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Nova RNC" acoes={<Link href="/rncs" className={cls.btnSec}>Voltar</Link>} />
      {obras.length === 0 ? (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Você não tem acesso a nenhuma obra/unidade. Solicite ao administrador.
        </p>
      ) : (
        <FormNovaRnc obras={obras} setores={setores} usuarios={usuarios} podeSensiveis={ctx.permissoes.includes("RNC_VER_RESTRITAS")} />
      )}
    </div>
  );
}
