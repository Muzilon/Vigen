import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import { Badge, Cabecalho, Cartao, cls } from "@/components/ui";
import { dadosAdministracao, MIN_SENHA, PAPEIS } from "@/lib/admin/servico";
import { getAtor } from "@/lib/ator-servidor";
import { MAX_DIAS_ALERTA } from "@/lib/notificacoes/preferencias";
import { obterPreferencias } from "@/lib/notificacoes/preferencias-servico";
import { TODAS_PERMISSOES } from "@/lib/permissoes";
import { getContexto, temPermissao } from "@/lib/tenant";
import {
  alternarUsuarioAtivoAcao,
  atualizarUsuarioAcao,
  criarUsuarioAcao,
  excluirPerfilAcao,
  redefinirSenhaAcao,
  salvarObraAcao,
  salvarPerfilAcao,
  salvarPreferenciasAcao,
  salvarSetorAcao,
} from "./actions";

const ABAS = [
  ["usuarios", "Usuários"],
  ["perfis", "Perfis"],
  ["obras", "Obras / unidades"],
  ["setores", "Setores"],
  ["preferencias", "Notificações"],
] as const;
type Aba = (typeof ABAS)[number][0];

const ROTULO_PAPEL: Record<(typeof PAPEIS)[number], string> = {
  ADMIN: "Administrador",
  GESTOR_SGI: "Gestor do SGI",
  INSPETOR: "Inspetor",
  COLABORADOR: "Colaborador",
};

const ROTULO_PERMISSAO: Record<(typeof TODAS_PERMISSOES)[number], string> = {
  RNC_ABRIR: "Abrir RNC",
  RNC_TRATAR: "Tratar RNC",
  RNC_VERIFICAR_EFICACIA: "Verificar eficácia",
  RNC_SOLICITAR_CANCELAMENTO: "Solicitar cancelamento",
  RNC_APROVAR_CANCELAMENTO: "Aprovar cancelamento",
  RNC_VER_RESTRITAS: "Ver RNCs restritas e dados sensíveis",
  PLANO_GERENCIAR: "Gerenciar planos de ação",
  ADMIN_CONFIG: "Administrar configurações",
  VER_TODAS_OBRAS: "Ver todas as obras",
};

type Dados = Awaited<ReturnType<typeof dadosAdministracao>>;
type Usuario = Dados["usuarios"][number];

function CamposUsuario({ u, d }: { u?: Usuario; d: Dados }) {
  const obrasUsuario = new Set(u?.acessosObra.map((x) => x.obraId) ?? []);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={cls.label}>Nome *</label>
        <input name="nome" required defaultValue={u?.nome} className={cls.input} />
      </div>
      <div>
        <label className={cls.label}>E-mail *</label>
        <input name="email" type="email" required defaultValue={u?.email} className={cls.input} />
      </div>
      <div>
        <label className={cls.label}>Papel *</label>
        <select name="papel" defaultValue={u?.papel ?? "COLABORADOR"} className={cls.input}>
          {PAPEIS.map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
        </select>
      </div>
      <div>
        <label className={cls.label}>Perfil (permissões adicionais)</label>
        <select name="perfilId" defaultValue={u?.perfilId ?? ""} className={cls.input}>
          <option value="">—</option>
          {d.perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      <div>
        <label className={cls.label}>Setor</label>
        <select name="setorId" defaultValue={u?.setorId ?? ""} className={cls.input}>
          <option value="">—</option>
          {d.setores.filter((s) => s.ativo || s.id === u?.setorId).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>
      <div>
        <label className={cls.label}>Escopo de obras *</label>
        <select name="escopoObras" defaultValue={u?.escopoObras ?? "SELECIONADAS"} className={cls.input}>
          <option value="TODAS">Todas as obras</option>
          <option value="SELECIONADAS">Somente as selecionadas</option>
        </select>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className={cls.label}>Obras permitidas (quando “Somente as selecionadas”)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {d.obras.filter((o) => o.ativo || obrasUsuario.has(o.id)).map((o) => (
            <label key={o.id} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" name="obraIds" value={o.id} defaultChecked={obrasUsuario.has(o.id)} />
              {o.nome}{!o.ativo && " (inativa)"}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function CamposPerfil({ p }: { p?: Dados["perfis"][number] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={cls.label}>Nome *</label>
          <input name="nome" required defaultValue={p?.nome} className={cls.input} />
        </div>
        <div>
          <label className={cls.label}>Descrição</label>
          <input name="descricao" defaultValue={p?.descricao ?? ""} className={cls.input} />
        </div>
      </div>
      <fieldset>
        <legend className={cls.label}>Permissões</legend>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {TODAS_PERMISSOES.map((perm) => (
            <label key={perm} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" name="permissoes" value={perm} defaultChecked={p?.permissoes.includes(perm)} />
              {ROTULO_PERMISSAO[perm]}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function AbaUsuarios({ d, eu }: { d: Dados; eu: string }) {
  const perfil = new Map(d.perfis.map((p) => [p.id, p.nome]));
  const obra = new Map(d.obras.map((o) => [o.id, o.nome]));
  return (
    <div className="space-y-5">
      <Cartao titulo="Novo usuário">
        <FormAcao acao={criarUsuarioAcao} botao="Criar usuário" classeBotao={cls.btn} className="space-y-3">
          <CamposUsuario d={d} />
          <div className="max-w-xs">
            <label className={cls.label}>Senha inicial * (mín. {MIN_SENHA})</label>
            <input name="senha" type="password" required minLength={MIN_SENHA} autoComplete="new-password" className={cls.input} />
          </div>
        </FormAcao>
      </Cartao>
      <Cartao titulo={`Usuários (${d.usuarios.length})`}>
        <ul className="divide-y divide-slate-100">
          {d.usuarios.map((u) => (
            <li key={u.id} className="py-3">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-slate-900">{u.nome}</span>
                  <span className="text-slate-500">{u.email}</span>
                  <Badge cor="bg-slate-50 text-slate-700 ring-slate-500/20">{ROTULO_PAPEL[u.papel]}</Badge>
                  {u.perfilId && <Badge cor="bg-sky-50 text-sky-700 ring-sky-600/20">{perfil.get(u.perfilId)}</Badge>}
                  <span className="text-xs text-slate-500">
                    {u.escopoObras === "TODAS" ? "Todas as obras" : u.acessosObra.map((x) => obra.get(x.obraId)).join(", ") || "Nenhuma obra"}
                  </span>
                  {!u.ativo && <Badge cor="bg-red-50 text-red-700 ring-red-600/20">Inativo</Badge>}
                  {u.id === eu && <Badge cor="bg-emerald-50 text-emerald-700 ring-emerald-600/20">Você</Badge>}
                </summary>
                <div className="mt-3 space-y-4 rounded-md border border-slate-200 p-3">
                  <FormAcao acao={atualizarUsuarioAcao} botao="Salvar alterações" classeBotao={cls.btn} className="space-y-3">
                    <input type="hidden" name="id" value={u.id} />
                    <CamposUsuario u={u} d={d} />
                  </FormAcao>
                  <div className="flex flex-wrap items-start gap-6 border-t border-slate-100 pt-3">
                    <FormAcao acao={redefinirSenhaAcao} botao="Redefinir senha" classeBotao={cls.btnSec} className="flex items-start gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <input name="senha" type="password" required minLength={MIN_SENHA} placeholder="Nova senha" autoComplete="new-password" className={`${cls.input} w-48`} />
                    </FormAcao>
                    {u.id !== eu && (
                      <FormAcao
                        acao={alternarUsuarioAtivoAcao}
                        botao={u.ativo ? "Desativar" : "Reativar"}
                        classeBotao={u.ativo ? cls.btnPerigo : cls.btnSec}
                        confirmar={u.ativo ? `Desativar ${u.nome}? As sessões dele serão encerradas.` : undefined}
                      >
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="ativo" value={u.ativo ? "false" : "true"} />
                      </FormAcao>
                    )}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

function AbaPerfis({ d }: { d: Dados }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        As permissões do perfil somam-se às do papel do usuário (administradores têm todas). Alterar um perfil encerra as sessões dos usuários que o utilizam.
      </p>
      <Cartao titulo="Novo perfil">
        <FormAcao acao={salvarPerfilAcao} botao="Criar perfil" classeBotao={cls.btn} className="space-y-3">
          <CamposPerfil />
        </FormAcao>
      </Cartao>
      {d.perfis.map((p) => (
        <Cartao
          key={p.id}
          titulo={
            <span className="flex items-center gap-2">
              {p.nome}
              {p.sistema && <Badge cor="bg-slate-50 text-slate-700 ring-slate-500/20">Sistema</Badge>}
              <span className="text-xs font-normal text-slate-500">{p._count.usuarios} usuário(s)</span>
            </span>
          }
        >
          <FormAcao acao={salvarPerfilAcao} botao="Salvar perfil" classeBotao={cls.btn} className="space-y-3">
            <input type="hidden" name="id" value={p.id} />
            <CamposPerfil p={p} />
          </FormAcao>
          {!p.sistema && (
            <FormAcao acao={excluirPerfilAcao} botao="Excluir perfil" classeBotao={`${cls.btnPerigo} mt-3`} confirmar={`Excluir o perfil "${p.nome}"?`}>
              <input type="hidden" name="id" value={p.id} />
            </FormAcao>
          )}
        </Cartao>
      ))}
    </div>
  );
}

function AbaObras({ d }: { d: Dados }) {
  const campos = (o?: Dados["obras"][number]) => (
    <>
      {o && <input type="hidden" name="id" value={o.id} />}
      <input name="nome" required defaultValue={o?.nome} placeholder="Nome *" aria-label="Nome" className={`${cls.input} w-56`} />
      <input name="codigo" defaultValue={o?.codigo ?? ""} placeholder="Código" aria-label="Código" className={`${cls.input} w-28`} />
      <input name="endereco" defaultValue={o?.endereco ?? ""} placeholder="Endereço" aria-label="Endereço" className={`${cls.input} w-64`} />
      <label className="flex items-center gap-1.5 self-center text-sm text-slate-700">
        <input type="checkbox" name="ativo" defaultChecked={o ? o.ativo : true} /> Ativa
      </label>
    </>
  );
  return (
    <div className="space-y-5">
      <Cartao titulo="Nova obra / unidade">
        <FormAcao acao={salvarObraAcao} botao="Criar" classeBotao={cls.btn} className="flex flex-wrap items-start gap-2">{campos()}</FormAcao>
      </Cartao>
      <Cartao titulo={`Obras / unidades (${d.obras.length})`}>
        <ul className="space-y-3">
          {d.obras.map((o) => (
            <li key={o.id}>
              <FormAcao acao={salvarObraAcao} botao="Salvar" classeBotao={cls.btnSec} className="flex flex-wrap items-start gap-2">{campos(o)}</FormAcao>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

function AbaSetores({ d }: { d: Dados }) {
  const campos = (s?: Dados["setores"][number]) => (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <input name="nome" required defaultValue={s?.nome} placeholder="Nome *" aria-label="Nome" className={`${cls.input} w-64`} />
      <label className="flex items-center gap-1.5 self-center text-sm text-slate-700">
        <input type="checkbox" name="ativo" defaultChecked={s ? s.ativo : true} /> Ativo
      </label>
    </>
  );
  return (
    <div className="space-y-5">
      <Cartao titulo="Novo setor">
        <FormAcao acao={salvarSetorAcao} botao="Criar" classeBotao={cls.btn} className="flex flex-wrap items-start gap-2">{campos()}</FormAcao>
      </Cartao>
      <Cartao titulo={`Setores (${d.setores.length})`}>
        <ul className="space-y-3">
          {d.setores.map((s) => (
            <li key={s.id}>
              <FormAcao acao={salvarSetorAcao} botao="Salvar" classeBotao={cls.btnSec} className="flex flex-wrap items-start gap-2">{campos(s)}</FormAcao>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

async function AbaPreferencias({ empresaId }: { empresaId: string }) {
  const p = await obterPreferencias(empresaId);
  return (
    <div className="max-w-2xl">
      <Cartao titulo="Notificações e alertas">
        <FormAcao acao={salvarPreferenciasAcao} botao="Salvar" classeBotao={cls.btn} className="space-y-4">
          <div>
            <label className={cls.label} htmlFor="diasAlertaPrazo">Alertar itens de ação com prazo em até (dias)</label>
            <input
              id="diasAlertaPrazo"
              name="diasAlertaPrazo"
              type="number"
              min={0}
              max={MAX_DIAS_ALERTA}
              required
              defaultValue={p.diasAlertaPrazo}
              className={`${cls.input} w-28`}
            />
            <p className="mt-1 text-xs text-slate-500">0 = alerta somente no dia do prazo. Itens atrasados geram um aviso ao executor e ao responsável.</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="resumoSemanal" defaultChecked={p.resumoSemanal} className="mt-0.5" />
            <span>
              Resumo semanal
              <span className="block text-xs text-slate-500">Toda segunda-feira, gestores do SGI e administradores recebem RNCs abertas, itens atrasados e taxa de eficácia.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="email" defaultChecked={p.email} className="mt-0.5" />
            <span>
              Enviar também por e-mail
              <span className="block text-xs text-slate-500">As notificações continuam disponíveis no sino do sistema.</span>
            </span>
          </label>
        </FormAcao>
      </Cartao>
    </div>
  );
}

export default async function Configuracoes({ searchParams }: PageProps<"/configuracoes">) {
  const ctx = await getContexto();
  if (!temPermissao(ctx, "ADMIN_CONFIG")) notFound();
  const sp = await searchParams;
  const aba: Aba = (ABAS.find(([k]) => k === sp.aba)?.[0] ?? "usuarios") as Aba;
  const d = aba === "preferencias" ? null : await dadosAdministracao(await getAtor());

  return (
    <div className="max-w-5xl">
      <Cabecalho titulo="Administração" subtitulo={ctx.usuario.empresaNome} />
      <nav className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {ABAS.map(([k, rotulo]) => (
          <Link
            key={k}
            href={`/configuracoes?aba=${k}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${k === aba ? "border-emerald-700 font-medium text-emerald-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {rotulo}
          </Link>
        ))}
      </nav>
      {aba === "usuarios" && d && <AbaUsuarios d={d} eu={ctx.usuario.id} />}
      {aba === "perfis" && d && <AbaPerfis d={d} />}
      {aba === "obras" && d && <AbaObras d={d} />}
      {aba === "setores" && d && <AbaSetores d={d} />}
      {aba === "preferencias" && <AbaPreferencias empresaId={ctx.empresaId} />}
    </div>
  );
}
