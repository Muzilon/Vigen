import Link from "next/link";
import { notFound } from "next/navigation";
import {
  alternarUsuarioAtivoAcao,
  atualizarUsuarioAcao,
  criarUsuarioAcao,
  excluirConfiguracaoEscalaAcao,
  excluirPerfilAcao,
  redefinirSenhaAcao,
  salvarConfigAprovacaoAcao,
  salvarConfiguracaoEscalaAcao,
  salvarModulosAtivosAcao,
  salvarObraAcao,
  salvarPerfilAcao,
  salvarPreferenciasAcao,
  salvarSetorAcao,
} from "@/app/(app)/configuracoes/actions";
import { salvarTipoDocumentoAcao } from "@/app/(app)/documentos/actions";
import { listarTipos } from "@/lib/documentos/servico";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { dadosAdministracao, dadosEscalas, dadosModulos, MIN_SENHA, PAPEIS } from "@/lib/admin/servico";
import { lerConfigAprovacao, type ModuloAprovavel } from "@/lib/aprovacao/config-modulo";
import { getAtor } from "@/lib/ator-servidor";
import { GRUPO_MODULO, GRUPO_POR_MODULO, ROTULO_MODULO, TODOS_MODULOS } from "@/lib/modulos";
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
  ["modulos", "Módulos"],
  ["escalas", "Escalas"],
  ["aprovacoes", "Aprovações"],
  ["tipos-documento", "Tipos de documento"],
  ["preferencias", "Notificações"],
] as const;
type Aba = (typeof ABAS)[number][0];

const ROTULO_TIPO_ESCALA: Record<"RISCO_OPORTUNIDADE" | "HIRA" | "ASPECTO_IMPACTO", string> = {
  RISCO_OPORTUNIDADE: "Riscos e oportunidades",
  HIRA: "HIRA",
  ASPECTO_IMPACTO: "Aspecto e impacto (LAIA)",
};

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
  PROCESSO_GERENCIAR: "Gerenciar mapa de processos",
  RISCO_GERENCIAR: "Gerenciar riscos e oportunidades",
  RISCO_TRATAR: "Tratar riscos e oportunidades",
  SWOT_GERENCIAR: "Gerenciar SWOT e partes interessadas",
  HIRA_GERENCIAR: "Gerenciar HIRA (perigos e riscos SST)",
  LAIA_GERENCIAR: "Gerenciar LAIA (aspectos e impactos)",
  DOCUMENTO_ELABORAR: "Elaborar documentos (lista mestra, revisões)",
  DOCUMENTO_GERENCIAR: "Gerenciar documentos (tipos, publicar, obsoletar)",
  INSPECAO_GERENCIAR: "Gerenciar inspeções (modelos de checklist, qualquer inspeção)",
  INSPECAO_REALIZAR: "Realizar inspeções de campo",
  AUDITORIA_GERENCIAR: "Planejar auditorias (programa, auditorias, cancelar)",
  AUDITORIA_REALIZAR: "Executar auditorias como auditor líder",
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

async function AbaModulos({ empresaId }: { empresaId: string }) {
  const { modulosAtivos } = await dadosModulos(await getAtor());
  const ativos = new Set(modulosAtivos);
  const grupos = [GRUPO_MODULO.QUALIDADE, GRUPO_MODULO.SEGURANCA, GRUPO_MODULO.MEIO_AMBIENTE, GRUPO_MODULO.GESTAO];
  return (
    <div className={styles.abaEstreita}>
      <p className={styles.explicacao}>
        Módulos contratados por esta empresa. RNC e Plano de Ação são a base do sistema e ficam sempre ativos.
        Desligar um módulo esconde seus itens do menu (quando implementados); não apaga dados existentes.
      </p>
      <Cartao titulo="Módulos contratados">
        <FormAcao acao={salvarModulosAtivosAcao} botao="Salvar" classeBotao={styles.botaoPrimario} className={styles.pilhaLarga}>
          <input type="hidden" name="empresaId" value={empresaId} />
          {grupos.map((grupo) => (
            <fieldset key={grupo} className={styles.grupoOpcoes}>
              <legend className={styles.legenda}>{grupo}</legend>
              <div className={styles.opcoesEmGrade}>
                {TODOS_MODULOS.filter((m) => GRUPO_POR_MODULO[m] === grupo && m !== "RNC" && m !== "PLANO_ACAO").map((m) => (
                  <label key={m} className={styles.opcao}>
                    <input type="checkbox" name="modulos" value={m} defaultChecked={ativos.has(m)} />
                    {ROTULO_MODULO[m]}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </FormAcao>
      </Cartao>
    </div>
  );
}

function AbaEscalas({ d }: { d: Awaited<ReturnType<typeof dadosEscalas>> }) {
  const obra = new Map(d.obras.map((o) => [o.id, o.nome]));
  return (
    <div className={styles.secoesAba}>
      <p className={styles.explicacao}>
        Escala (P×S) usada para calcular o nível de risco/HIRA/aspecto-impacto. Uma configuração sem obra é o padrão
        da empresa; escolha uma obra para sobrescrever apenas naquele local. Sem nenhuma configuração cadastrada, o
        sistema usa um padrão embutido (5x5 para Riscos/HIRA, 3x3 para Aspecto/Impacto).
      </p>
      <Cartao titulo="Nova configuração de escala">
        <FormAcao acao={salvarConfiguracaoEscalaAcao} botao="Salvar" classeBotao={styles.botaoPrimario} className={styles.pilha}>
          <div className={styles.gradeCampos}>
            <div>
              <Rotulo>Tipo *</Rotulo>
              <Selecao name="tipo" required className={styles.selecaoFormulario}>
                {Object.entries(ROTULO_TIPO_ESCALA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
              </Selecao>
            </div>
            <div>
              <Rotulo>Obra (sobrescrita opcional)</Rotulo>
              <Selecao name="obraId" className={styles.selecaoFormulario}>
                <option value="">— Padrão da empresa —</option>
                {d.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </Selecao>
            </div>
            <div>
              <Rotulo>Tamanho *</Rotulo>
              <Selecao name="tamanho" required className={styles.selecaoFormulario} defaultValue="5">
                <option value="3">3x3</option>
                <option value="5">5x5</option>
              </Selecao>
            </div>
          </div>
          <div>
            <Rotulo>Eixos (JSON)</Rotulo>
            <textarea name="eixos" required className={styles.areaTexto} rows={4} placeholder='[{"chave":"probabilidade","rotulo":"Probabilidade","niveis":[{"valor":1,"rotulo":"Baixa"}]}]' />
          </div>
          <div>
            <Rotulo>Faixas (JSON)</Rotulo>
            <textarea name="faixas" required className={styles.areaTexto} rows={3} placeholder='[{"limite":4,"nivel":"BAIXO","cor":"baixa"}]' />
          </div>
          <div>
            <Rotulo>Critérios extras (JSON, opcional)</Rotulo>
            <textarea name="criteriosExtras" className={styles.areaTexto} rows={2} placeholder='[{"chave":"requisitoLegal","rotulo":"Requisito legal não atendido","elevaPara":"CRITICO"}]' />
          </div>
        </FormAcao>
      </Cartao>
      <Cartao titulo={`Configurações cadastradas (${d.configuracoes.length})`}>
        {d.configuracoes.length === 0 ? (
          <p className={styles.explicacao}>Nenhuma — todos os tipos usam o padrão do sistema.</p>
        ) : (
          <ul className={styles.listaRegistros}>
            {d.configuracoes.map((c) => (
              <li key={c.id}>
                <span className={styles.tituloPerfil}>
                  {ROTULO_TIPO_ESCALA[c.tipo]} — {c.obraId ? (obra.get(c.obraId) ?? "obra removida") : "padrão da empresa"} ({c.tamanho}x{c.tamanho})
                </span>
                <FormAcao
                  acao={excluirConfiguracaoEscalaAcao}
                  botao="Excluir"
                  classeBotao={styles.botaoPerigo}
                  confirmar="Excluir esta configuração de escala? Volta a usar o padrão."
                >
                  <input type="hidden" name="id" value={c.id} />
                </FormAcao>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

const MODULOS_APROVACAO: { m: ModuloAprovavel; modulo: "HIRA" | "LAIA"; titulo: string }[] = [
  { m: "hira", modulo: "HIRA", titulo: "HIRA — perigos e riscos de SST" },
  { m: "laia", modulo: "LAIA", titulo: "LAIA — aspectos e impactos ambientais" },
];

/** Fluxo de aprovação de inclusão/alteração/exclusão de linhas HIRA/LAIA (decisão 5). */
async function AbaAprovacoes() {
  const a = await getAtor();
  const [empresa, usuarios] = await Promise.all([
    a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { config: true, modulosAtivos: true } }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return (
    <div className={styles.abaEstreita}>
      <p className={styles.explicacao}>
        Quando exigido, toda inclusão, alteração e exclusão de linha da planilha gera uma solicitação de aprovação para os aprovadores
        padrão (o solicitante nunca aprova o próprio pedido). A linha nova fica &quot;pendente de aprovação&quot; até a última assinatura.
        Sem exigência, as mudanças são aplicadas direto, com histórico. Com o módulo Documentos contratado, marque &quot;usar tramitação
        de documentos&quot; para que cada aprovação registre uma nova revisão da planilha controlada da obra (código e revisão, com
        snapshot das linhas vigentes) na lista mestra.
      </p>
      {MODULOS_APROVACAO.map(({ m, modulo, titulo }) => {
        const c = lerConfigAprovacao(empresa?.config, m);
        const docs = !!empresa?.modulosAtivos.includes("DOCUMENTOS");
        const ativo = empresa?.modulosAtivos.includes(modulo);
        return (
          <Cartao key={m} titulo={titulo}>
            {!ativo && <p className={styles.ajuda}>Módulo não contratado — a configuração vale quando ele for ativado.</p>}
            <FormAcao acao={salvarConfigAprovacaoAcao} botao="Salvar" classeBotao={styles.botaoPrimario} className={styles.pilhaLarga}>
              <input type="hidden" name="modulo" value={m} />
              <label className={styles.opcaoDescrita}>
                <input type="checkbox" name="exigir" defaultChecked={c.exigir} />
                <span>
                  Exigir aprovação para incluir, alterar e excluir linhas
                  <span className={styles.ajudaOpcao}>Reavaliações e revisões gerais continuam diretas (com histórico).</span>
                </span>
              </label>
              <div>
                <Rotulo htmlFor={`modo-${m}`}>Modo</Rotulo>
                <Selecao id={`modo-${m}`} name="modo" defaultValue={c.modo}>
                  <option value="SEQUENCIAL">Sequencial (na ordem abaixo)</option>
                  <option value="PARALELO">Simultâneo</option>
                </Selecao>
              </div>
              <label className={styles.opcaoDescrita}>
                <input type="checkbox" name="usarTramitacao" defaultChecked={c.usarTramitacao} disabled={!docs} />
                <span>
                  Usar tramitação de documentos (revisão da planilha controlada)
                  <span className={styles.ajudaOpcao}>
                    {docs ? "Cada inclusão/alteração/exclusão aprovada gera nova revisão do documento-planilha da obra (tipo PL)." : "Requer o módulo Documentos contratado."}
                  </span>
                </span>
              </label>
              <fieldset className={styles.grupoOpcoes}>
                <legend className={styles.legenda}>Aprovadores padrão</legend>
                <div className={styles.opcoesEmGrade}>
                  {usuarios.map((u) => (
                    <label key={u.id} className={styles.opcao}>
                      <input type="checkbox" name="aprovadorIds" value={u.id} defaultChecked={c.aprovadorIds.includes(u.id)} />
                      {u.nome}
                    </label>
                  ))}
                </div>
              </fieldset>
            </FormAcao>
          </Cartao>
        );
      })}
    </div>
  );
}

/** Tipos de documento da Tramitação de Documentos (sigla compõe o código; periodicidade padrão de revisão). */
async function AbaTiposDocumento({ ativo }: { ativo: boolean }) {
  if (!ativo) return <p className={styles.explicacao}>Módulo Documentos não contratado.</p>;
  const tipos = await listarTipos(await getAtor(), { incluirInativos: true });
  const campos = (t?: (typeof tipos)[number]) => (
    <>
      {t && <input type="hidden" name="id" value={t.id} />}
      <Entrada name="sigla" required defaultValue={t?.sigla} placeholder="Sigla *" aria-label="Sigla" maxLength={6} className={styles.entradaCodigo} readOnly={!!t && t._count.documentos > 0} />
      <Entrada name="nome" required defaultValue={t?.nome} placeholder="Nome *" aria-label="Nome" className={styles.entradaNomeSetor} />
      <label className={styles.opcaoEmLinha}>
        Revisão a cada
        <Entrada name="periodicidadeRevisaoMeses" type="number" min={1} max={120} required defaultValue={t?.periodicidadeRevisaoMeses ?? 24} aria-label="Periodicidade de revisão (meses)" className={styles.entradaCodigo} />
        meses
      </label>
      {t && (
        <label className={styles.opcaoEmLinha}>
          <input type="checkbox" name="ativo" defaultChecked={t.ativo} /> Ativo
        </label>
      )}
      {t && <span className={styles.ajuda}>{t._count.documentos} documento(s)</span>}
    </>
  );
  return (
    <div className={styles.secoesAba}>
      <p className={styles.explicacao}>
        O código do documento é gerado automaticamente com a sigla do tipo e uma sequência própria do tipo (ex.: PR-001, IT-004). A sigla
        não muda depois que houver documentos. A periodicidade é o padrão sugerido para novos documentos do tipo.
      </p>
      <Cartao titulo="Novo tipo de documento">
        <FormAcao acao={salvarTipoDocumentoAcao} botao="Criar" classeBotao={styles.botaoPrimario} className={styles.formEmLinha}>{campos()}</FormAcao>
      </Cartao>
      <Cartao titulo={`Tipos de documento (${tipos.length})`}>
        <ul className={styles.listaRegistros}>
          {tipos.map((t) => (
            <li key={t.id}>
              <FormAcao acao={salvarTipoDocumentoAcao} botao="Salvar" classeBotao={styles.botaoSecundario} className={styles.formEmLinha}>{campos(t)}</FormAcao>
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
  const d = aba === "preferencias" || aba === "modulos" || aba === "escalas" || aba === "aprovacoes" || aba === "tipos-documento" ? null : await dadosAdministracao(await getAtor());
  const escalas = aba === "escalas" ? await dadosEscalas(await getAtor()) : null;

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
      {aba === "modulos" && <AbaModulos empresaId={ctx.empresaId} />}
      {aba === "escalas" && escalas && <AbaEscalas d={escalas} />}
      {aba === "aprovacoes" && <AbaAprovacoes />}
      {aba === "tipos-documento" && <AbaTiposDocumento ativo={ctx.modulosAtivos.includes("DOCUMENTOS")} />}
      {aba === "preferencias" && <AbaPreferencias empresaId={ctx.empresaId} />}
    </div>
  );
}
