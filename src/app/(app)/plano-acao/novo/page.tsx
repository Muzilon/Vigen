import Link from "next/link";
import { Cabecalho, cls } from "@/components/ui";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { exigirPermissao, getDb } from "@/lib/tenant";
import { FormNovoPlano } from "./form-novo";

export default async function NovoPlano() {
  const ctx = await exigirPermissao("PLANO_GERENCIAR");
  const db = await getDb();
  const [obras, ativos] = await Promise.all([
    db.obraUnidade.findMany({
      where: { ativo: true, ...(ctx.obrasPermitidas ? { id: { in: ctx.obrasPermitidas } } : {}) },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    usuariosAtivos(db),
  ]);
  // O formulário filtra o "quem" pela obra escolhida; o serviço valida de novo.
  const usuarios = ativos
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"))
    .map((u) => ({ id: u.id, nome: u.nome, obras: u.obras }));

  return (
    <div className="max-w-6xl">
      <Cabecalho
        titulo="Novo plano de ação"
        subtitulo="Plano avulso, sem RNC de origem (ex.: melhoria, reunião, requisito legal)."
        acoes={<Link href="/plano-acao" className={cls.btnSec}>Voltar</Link>}
      />
      <FormNovoPlano obras={obras} usuarios={usuarios} />
    </div>
  );
}
