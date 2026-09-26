import Link from "next/link";
import { notFound } from "next/navigation";
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
} from "@/app/(app)/configuracoes/actions";
import { FormAcao } from "@/components/form-acao";
import { dadosAdministracao, MIN_SENHA, PAPEIS } from "@/lib/admin/servico";
import { getAtor } from "@/lib/ator-servidor";
import { MAX_DIAS_ALERTA } from "@/lib/notificacoes/preferencias";
import { obterPreferencias } from "@/lib/notificacoes/preferencias-servico";
import { TODAS_PERMISSOES } from "@/lib/permissoes";
import { getContexto, temPermissao } from "@/lib/tenant";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Entrada, Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { Cartao } from "@/paginas/html/componentes/cartao";
import styles from "@/paginas/css/configuracoes.module.css";

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
    <div className={styles.gradeCampos}>
      <div>
        <Rotulo>Nome *</Rotulo>
        <Entrada name="nome" required defaultValue={u?.nome} />
      </div>
      <div>
        <Rotulo>E-mail *</Rotulo>
        <Entrada name="email" type="email" required defaultValue={u?.email} />
      </div>
      <div>
        <Rotulo>Papel *</Rotulo>
        <Selecao name="papel" defaultValue={u?.papel ?? "COLABORADOR"} className={styles.selecaoFormulario}>
          {PAPEIS.map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
        </Selecao>
      </div>
      <div>
        <Rotulo>Perfil (permissões adicionais)</Rotulo>
        <Selecao name="perfilId" defaultValue={u?.perfilId ?? ""} className={styles.selecaoFormulario}>
          <option value="">—</option>
          {d.perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Selecao>
      </div>
      <div>
        <Rotulo>Setor</Rotulo>
        <Selecao name="setorId" defaultValue={u?.setorId ?? ""} className={styles.selecaoFormulario}>
          <option value="">—</option>
          {d.setores.filter((s) => s.ativo || s.id === u?.setorId).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </Selecao>
      </div>
      <div>
        <Rotulo>Escopo de obras *</Rotulo>
        <Selecao name="escopoObras" defaultValue={u?.escopoObras ?? "SELECIONADAS"} className={styles.selecaoFormulario}>
          <option value="TODAS">Todas as obras</option>
          <option value="SELECIONADAS">Somente as selecionadas</option>
        </Selecao>
      </div>
      <fieldset className={`${styles.grupoOpcoes} ${styles.linhaInteira}`}>
        <legend className={styles.legenda}>Obras permitidas (quando “Somente as selecionadas”)</legend>
        <div className={styles.opcoesEmLinha}>
          {d.obras.filter((o) => o.ativo || obrasUsuario.has(o.id)).map((o) => (
            <label key={o.id} className={styles.opcao}>
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
    <div className={styles.pilha}>
      <div className={styles.gradeCampos}>
        <div>
          <Rotulo>Nome *</Rotulo>
          <Entrada name="nome" required defaultValue={p?.nome} />
        </div>
        <div>
          <Rotulo>Descrição</Rotulo>
          <Entrada name="descricao" defaultValue={p?.descricao ?? ""} />
        </div>
      </div>
      <fieldset className={styles.grupoOpcoes}>
        <legend className={styles.legenda}>Permissões</legend>
        <div className={styles.opcoesEmGrade}>
          {TODAS_PERMISSOES.map((perm) => (
            <label key={perm} className={styles.opcao}>
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
    <div className={styles.secoesAba}>
      <Cartao titulo="Novo usuário">
        <FormAcao acao={criarUsuarioAcao} botao="Criar usuário" classeBotao={styles.botaoPrimario} className={styles.pilha}>
          <CamposUsuario d={d} />
          <div className={styles.campoSenha}>
            <Rotulo>Senha inicial * (mín. {MIN_SENHA})</Rotulo>
            <Entrada name="senha" type="password" required minLength={MIN_SENHA} autoComplete="new-password" />
          </div>
        </FormAcao>
      </Cartao>
      <Cartao titulo={`Usuários (${d.usuarios.length})`}>
        <ul className={styles.listaUsuarios}>
          {d.usuarios.map((u) => (
            <li key={u.id} className={styles.itemUsuario}>
              <details>
                <summary className={styles.resumoUsuario}>
                  <span className={styles.nomeUsuario}>{u.nome}</span>
                  <span className={styles.emailUsuario}>{u.email}</span>
                  <span className={`${styles.etiqueta} ${styles.etiquetaNeutra}`}>{ROTULO_PAPEL[u.papel]}</span>
                  {u.perfilId && <span className={`${styles.etiqueta} ${styles.etiquetaPerfil}`}>{perfil.get(u.perfilId)}</span>}
                  <span className={styles.obrasUsuario}>
                    {u.escopoObras === "TODAS" ? "Todas as obras" : u.acessosObra.map((x) => obra.get(x.obraId)).join(", ") || "Nenhuma obra"}
                  </span>
                  {!u.ativo && <span className={`${styles.etiqueta} ${styles.etiquetaInativo}`}>Inativo</span>}
                  {u.id === eu && <span className={`${styles.etiqueta} ${styles.etiquetaVoce}`}>Você</span>}
                </summary>
                <div className={styles.edicaoUsuario}>
                  <FormAcao acao={atualizarUsuarioAcao} botao="Salvar alterações" classeBotao={styles.botaoPrimario} className={styles.pilha}>
                    <input type="hidden" name="id" value={u.id} />
                    <CamposUsuario u={u} d={d} />
                  </FormAcao>
                  <div className={styles.acoesUsuario}>
                    <FormAcao acao={redefinirSenhaAcao} botao="Redefinir senha" classeBotao={styles.botaoSecundario} className={styles.formEmLinha}>
                      <input type="hidden" name="id" value={u.id} />
                      <Entrada
                        name="senha"
                        type="password"
                        required
                        minLength={MIN_SENHA}
                        placeholder="Nova senha"
                        autoComplete="new-password"
                        className={styles.entradaSenha}
                      />
                    </FormAcao>
                    {u.id !== eu && (
                      <FormAcao
                        acao={alternarUsuarioAtivoAcao}
                        botao={u.ativo ? "Desativar" : "Reativar"}
                        classeBotao={u.ativo ? styles.botaoPerigo : styles.botaoSecundario}
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
    <div className={styles.secoesAba}>
      <p className={styles.explicacao}>
        As permissões do perfil somam-se às do papel do usuário (administradores têm todas). Alterar um perfil encerra as sessões dos usuários que o utilizam.
      </p>
      <Cartao titulo="Novo perfil">
        <FormAcao acao={salvarPerfilAcao} botao="Criar perfil" classeBotao={styles.botaoPrimario} className={styles.pilha}>
          <CamposPerfil />
        </FormAcao>
      </Cartao>
      {d.perfis.map((p) => (
        <Cartao
          key={p.id}
          titulo={
            <span className={styles.tituloPerfil}>
              {p.nome}
              {p.sistema && <span className={`${styles.etiqueta} ${styles.etiquetaNeutra}`}>Sistema</span>}
              <span className={styles.contagemPerfil}>{p._count.usuarios} usuário(s)</span>
            </span>
          }
        >
          <FormAcao acao={salvarPerfilAcao} botao="Salvar perfil" classeBotao={styles.botaoPrimario} className={styles.pilha}>
            <input type="hidden" name="id" value={p.id} />
            <CamposPerfil p={p} />
          </FormAcao>
          {!p.sistema && (
            <FormAcao
              acao={excluirPerfilAcao}
              botao="Excluir perfil"
              classeBotao={`${styles.botaoPerigo} ${styles.botaoExcluirPerfil}`}
              confirmar={`Excluir o perfil "${p.nome}"?`}
            >
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
      <Entrada name="nome" required defaultValue={o?.nome} placeholder="Nome *" aria-label="Nome" className={styles.entradaNomeObra} />
      <Entrada name="codigo" defaultValue={o?.codigo ?? ""} placeholder="Código" aria-label="Código" className={styles.entradaCodigo} />
      <Entrada name="endereco" defaultValue={o?.endereco ?? ""} placeholder="Endereço" aria-label="Endereço" className={styles.entradaEndereco} />
      <label className={styles.opcaoEmLinha}>
        <input type="checkbox" name="ativo" defaultChecked={o ? o.ativo : true} /> Ativa
      </label>
    </>
  );
  return (
    <div className={styles.secoesAba}>
      <Cartao titulo="Nova obra / unidade">
        <FormAcao acao={salvarObraAcao} botao="Criar" classeBotao={styles.botaoPrimario} className={styles.formEmLinha}>{campos()}</FormAcao>
      </Cartao>
      <Cartao titulo={`Obras / unidades (${d.obras.length})`}>
        <ul className={styles.listaRegistros}>
          {d.obras.map((o) => (
            <li key={o.id}>
              <FormAcao acao={salvarObraAcao} botao="Salvar" classeBotao={styles.botaoSecundario} className={styles.formEmLinha}>{campos(o)}</FormAcao>
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
      <Entrada name="nome" required defaultValue={s?.nome} placeholder="Nome *" aria-label="Nome" className={styles.entradaNomeSetor} />
      <label className={styles.opcaoEmLinha}>
        <input type="checkbox" name="ativo" defaultChecked={s ? s.ativo : true} /> Ativo
      </label>
    </>
  );
  return (
    <div className={styles.secoesAba}>
      <Cartao titulo="Novo setor">
        <FormAcao acao={salvarSetorAcao} botao="Criar" classeBotao={styles.botaoPrimario} className={styles.formEmLinha}>{campos()}</FormAcao>
      </Cartao>
      <Cartao titulo={`Setores (${d.setores.length})`}>
        <ul className={styles.listaRegistros}>
          {d.setores.map((s) => (
            <li key={s.id}>
              <FormAcao acao={salvarSetorAcao} botao="Salvar" classeBotao={styles.botaoSecundario} className={styles.formEmLinha}>{campos(s)}</FormAcao>
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
    <div className={styles.abaEstreita}>
      <Cartao titulo="Notificações e alertas">
        <FormAcao acao={salvarPreferenciasAcao} botao="Salvar" classeBotao={styles.botaoPrimario} className={styles.pilhaLarga}>
          <div>
            <Rotulo htmlFor="diasAlertaPrazo">Alertar itens de ação com prazo em até (dias)</Rotulo>
            <Entrada
              id="diasAlertaPrazo"
              name="diasAlertaPrazo"
              type="number"
              min={0}
              max={MAX_DIAS_ALERTA}
              required
              defaultValue={p.diasAlertaPrazo}
              className={styles.entradaCodigo}
            />
            <p className={styles.ajuda}>0 = alerta somente no dia do prazo. Itens atrasados geram um aviso ao executor e ao responsável.</p>
          </div>
          <label className={styles.opcaoDescrita}>
            <input type="checkbox" name="resumoSemanal" defaultChecked={p.resumoSemanal} />
            <span>
              Resumo semanal
              <span className={styles.ajudaOpcao}>Toda segunda-feira, gestores do SGI e administradores recebem RNCs abertas, itens atrasados e taxa de eficácia.</span>
            </span>
          </label>
          <label className={styles.opcaoDescrita}>
            <input type="checkbox" name="email" defaultChecked={p.email} />
            <span>
              Enviar também por e-mail
              <span className={styles.ajudaOpcao}>As notificações continuam disponíveis no sino do sistema.</span>
            </span>
          </label>
        </FormAcao>
      </Cartao>
    </div>
  );
}

/** Administração (usuários, perfis, obras, setores e preferências de notificação). Exige ADMIN_CONFIG. */
export default async function Configuracoes({ searchParams }: PageProps<"/configuracoes">) {
  const ctx = await getContexto();
  if (!temPermissao(ctx, "ADMIN_CONFIG")) notFound();
  const sp = await searchParams;
  const aba: Aba = (ABAS.find(([k]) => k === sp.aba)?.[0] ?? "usuarios") as Aba;
  const d = aba === "preferencias" ? null : await dadosAdministracao(await getAtor());

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina titulo="Administração" subtitulo={ctx.usuario.empresaNome} />
      <nav className={styles.abas} aria-label="Seções da administração">
        {ABAS.map(([k, rotulo]) => (
          <Link
            key={k}
            href={`/configuracoes?aba=${k}`}
            className={`${styles.aba} ${k === aba ? styles.abaAtiva : ""}`}
            aria-current={k === aba ? "page" : undefined}
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
