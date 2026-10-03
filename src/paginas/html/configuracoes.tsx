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
  salvarFuncaoAcao,
  criarFeriadoAcao,
  editarFeriadoAcao,
  inativarFeriadoAcao,
  reativarFeriadoAcao,
} from "@/app/(app)/configuracoes/actions";
import { salvarTipoDocumentoAcao } from "@/app/(app)/documentos/actions";
import { listarTipos } from "@/lib/documentos/servico";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Alerta } from "@/paginas/html/componentes/alerta";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormularioFeriado } from "@/paginas/html/feriados-formulario";
import { formatarData } from "@/lib/datas";
import { ErroNegocio } from "@/lib/erros";
import { faltaFeriadoNoAnoCorrente, listarFeriados } from "@/lib/feriados/servico";
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

// As abas da administração (chave usada na URL `?aba=...` e o nome mostrado na tela).
const ABAS = [
  ["usuarios", "Usuários"],
  ["perfis", "Perfis"],
  ["obras", "Unidades"],
  ["setores", "Setores"],
  ["funcoes", "Funções"],
  ["modulos", "Módulos"],
  ["escalas", "Escalas"],
  ["aprovacoes", "Aprovações"],
  ["tipos-documento", "Tipos de documento"],
  ["feriados", "Feriados"],
  ["preferencias", "Notificações"],
] as const;
// Tipo que só aceita as chaves acima, para o TypeScript avisar se escrevermos uma aba que não existe.
type Aba = (typeof ABAS)[number][0];

// Nome amigável de cada tipo de escala de pontuação de risco.
const ROTULO_TIPO_ESCALA: Record<"RISCO_OPORTUNIDADE" | "HIRA" | "ASPECTO_IMPACTO", string> = {
  RISCO_OPORTUNIDADE: "Ameaças e Oportunidades",
  HIRA: "HIRA",
  ASPECTO_IMPACTO: "Aspecto e impacto (LAIA)",
};

// Nome amigável de cada papel de usuário (o papel define as permissões básicas).
const ROTULO_PAPEL: Record<(typeof PAPEIS)[number], string> = {
  ADMIN: "Administrador",
  GESTOR_SGI: "Gestor do SGI",
  INSPETOR: "Inspetor",
  COLABORADOR: "Colaborador",
};

// Descrição em português de cada permissão que pode ser dada a um perfil.
const ROTULO_PERMISSAO: Record<(typeof TODAS_PERMISSOES)[number], string> = {
  RNC_ABRIR: "Abrir RNC",
  RNC_TRATAR: "Tratar RNC",
  RNC_VERIFICAR_EFICACIA: "Verificar eficácia",
  RNC_SOLICITAR_CANCELAMENTO: "Solicitar cancelamento",
  RNC_APROVAR_CANCELAMENTO: "Aprovar cancelamento",
  RNC_VER_RESTRITAS: "Ver RNCs restritas e dados sensíveis",
  PLANO_GERENCIAR: "Gerenciar planos de ação",
  PROCESSO_GERENCIAR: "Gerenciar mapa de processos",
  RISCO_GERENCIAR: "Gerenciar ameaças e oportunidades",
  RISCO_TRATAR: "Tratar ameaças e oportunidades",
  SWOT_GERENCIAR: "Gerenciar SWOT e partes interessadas",
  HIRA_GERENCIAR: "Gerenciar HIRA (perigos e riscos SST)",
  LAIA_GERENCIAR: "Gerenciar LAIA (aspectos e impactos)",
  DOCUMENTO_ELABORAR: "Elaborar documentos (lista mestra, revisões)",
  DOCUMENTO_GERENCIAR: "Gerenciar documentos (tipos, publicar, obsoletar)",
  INSPECAO_GERENCIAR: "Gerenciar inspeções (modelos de checklist, qualquer inspeção)",
  INSPECAO_REALIZAR: "Realizar inspeções de campo",
  AUDITORIA_GERENCIAR: "Planejar auditorias (programa, auditorias, cancelar)",
  AUDITORIA_REALIZAR: "Executar auditorias como auditor líder",
  INCIDENTE_GERENCIAR: "Gerenciar incidentes (investigação, responsável, plano, conclusão)",
  INCIDENTE_VER_RESTRITOS: "Ver incidentes restritos e dados pessoais de envolvidos (LGPD)",
  INDICADOR_GERENCIAR: "Cadastrar indicadores e lançar resultados de qualquer indicador",
  TREINAMENTO_GERENCIAR: "Cadastrar treinamentos e sessões, lançar presença/certificados e ver a matriz de competências",
  ADMIN_CONFIG: "Administrar configurações",
  VER_TODAS_OBRAS: "Ver todas as unidades",
};

// Formato dos dados da administração (usuários, perfis, unidades, setores, funções), deduzido do que o serviço devolve.
type Dados = Awaited<ReturnType<typeof dadosAdministracao>>;
// Formato de um usuário dentro desses dados.
type Usuario = Dados["usuarios"][number];

/**
 * Campos do formulário de usuário (nome, e-mail, papel, perfil, setor, função e unidades permitidas).
 * Sem `u`, é um usuário novo; com `u`, vêm preenchidos os dados atuais.
 */
function CamposUsuario({ u, d }: { u?: Usuario; d: Dados }) {
  // Conjunto das unidades que o usuário já pode acessar (para marcar as caixinhas).
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
        <Rotulo>Função</Rotulo>
        <Selecao name="funcaoId" defaultValue={u?.funcaoId ?? ""} className={styles.selecaoFormulario}>
          <option value="">—</option>
          {d.funcoes.filter((f) => f.ativo || f.id === u?.funcaoId).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </Selecao>
      </div>
      <div>
        <Rotulo>Escopo de unidades *</Rotulo>
        <Selecao name="escopoObras" defaultValue={u?.escopoObras ?? "SELECIONADAS"} className={styles.selecaoFormulario}>
          <option value="TODAS">Todas as unidades</option>
          <option value="SELECIONADAS">Somente as selecionadas</option>
        </Selecao>
      </div>
      <fieldset className={`${styles.grupoOpcoes} ${styles.linhaInteira}`}>
        <legend className={styles.legenda}>Unidades permitidas (quando “Somente as selecionadas”)</legend>
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

/** Campos do formulário de perfil: nome, descrição e a lista de permissões para marcar. Sem `p`, é um perfil novo. */
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

/** Aba "Usuários": formulário de novo usuário e a lista de usuários, cada um com edição, redefinição de senha e ativar/desativar. */
function AbaUsuarios({ d, eu }: { d: Dados; eu: string }) {
  // Dicionário id do perfil → nome.
  const perfil = new Map(d.perfis.map((p) => [p.id, p.nome]));
  // Dicionário id da unidade → nome.
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
                    {u.escopoObras === "TODAS" ? "Todas as unidades" : u.acessosObra.map((x) => obra.get(x.obraId)).join(", ") || "Nenhuma unidade"}
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

/** Aba "Perfis": criar perfis e editar as permissões de cada um (perfis do sistema não podem ser excluídos). */
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

/** Aba "Unidades": criar e editar as unidades (obras) da empresa. */
function AbaObras({ d }: { d: Dados }) {
  // Monta os campos de uma unidade (nome, código, endereço, ativa); reaproveitado no formulário de nova e no de edição.
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
      <Cartao titulo="Nova unidade">
        <FormAcao acao={salvarObraAcao} botao="Criar" classeBotao={styles.botaoPrimario} className={styles.formEmLinha}>{campos()}</FormAcao>
      </Cartao>
      <Cartao titulo={`Unidades (${d.obras.length})`}>
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

/** Aba "Setores": criar e editar os setores da empresa. */
function AbaSetores({ d }: { d: Dados }) {
  // Monta os campos de um setor (nome e ativo); reaproveitado no formulário de novo e no de edição.
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

/** Aba "Funções": criar e editar funções/cargos, usadas para definir treinamentos obrigatórios por função. */
function AbaFuncoes({ d }: { d: Dados }) {
  // Monta os campos de uma função (nome e ativa); reaproveitado no formulário de nova e no de edição.
  const campos = (f?: Dados["funcoes"][number]) => (
    <>
      {f && <input type="hidden" name="id" value={f.id} />}
      <Entrada name="nome" required defaultValue={f?.nome} placeholder="Nome *" aria-label="Nome" className={styles.entradaNomeSetor} />
      <label className={styles.opcaoEmLinha}>
        <input type="checkbox" name="ativo" defaultChecked={f ? f.ativo : true} /> Ativa
      </label>
    </>
  );
  return (
    <div className={styles.secoesAba}>
      <Cartao titulo="Nova função">
        <FormAcao acao={salvarFuncaoAcao} botao="Criar" classeBotao={styles.botaoPrimario} className={styles.formEmLinha}>{campos()}</FormAcao>
        <p className={styles.ajuda}>Funções/cargos (ex.: Eletricista, Montador de andaime) definem treinamentos obrigatórios por função.</p>
      </Cartao>
      <Cartao titulo={`Funções (${d.funcoes.length})`}>
        <ul className={styles.listaRegistros}>
          {d.funcoes.map((f) => (
            <li key={f.id}>
              <FormAcao acao={salvarFuncaoAcao} botao="Salvar" classeBotao={styles.botaoSecundario} className={styles.formEmLinha}>{campos(f)}</FormAcao>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

/** Aba "Módulos": escolher quais módulos a empresa contratou (RNC e Plano de Ação ficam sempre ativos). */
async function AbaModulos({ empresaId }: { empresaId: string }) {
  // Busca os módulos hoje ativos na empresa.
  const { modulosAtivos } = await dadosModulos(await getAtor());
  // Conjunto dos módulos ativos, para marcar as caixinhas.
  const ativos = new Set(modulosAtivos);
  // Os grupos em que os módulos são apresentados (Qualidade, Segurança, Meio ambiente, Gestão).
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

/** Aba "Escalas": configurar a escala de pontuação de risco (padrão da empresa ou por unidade) e listar/excluir as configurações. */
function AbaEscalas({ d }: { d: Awaited<ReturnType<typeof dadosEscalas>> }) {
  const obra = new Map(d.obras.map((o) => [o.id, o.nome]));
  return (
    <div className={styles.secoesAba}>
      <p className={styles.explicacao}>
        Escala (P×S) usada para calcular o nível de risco/perigos e riscos/aspecto-impacto. Uma configuração sem unidade é o padrão
        da empresa; escolha uma unidade para sobrescrever apenas naquele local. Sem nenhuma configuração cadastrada, o
        sistema usa um padrão embutido (5x5 para Riscos/Perigos e Riscos, 3x3 para Aspecto/Impacto).
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
              <Rotulo>Unidade (sobrescrita opcional)</Rotulo>
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
                  {ROTULO_TIPO_ESCALA[c.tipo]} — {c.obraId ? (obra.get(c.obraId) ?? "unidade removida") : "padrão da empresa"} ({c.tamanho}x{c.tamanho})
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

// Módulos cujas linhas podem exigir aprovação (Perigos e Riscos e LAIA): chave interna, código do módulo e título exibido.
const MODULOS_APROVACAO: { m: ModuloAprovavel; modulo: "HIRA" | "LAIA"; titulo: string }[] = [
  { m: "hira", modulo: "HIRA", titulo: "Perigos e Riscos — SST" },
  { m: "laia", modulo: "LAIA", titulo: "LAIA — aspectos e impactos ambientais" },
];

/** Fluxo de aprovação de inclusão/alteração/exclusão de linhas de Perigos e Riscos/LAIA (decisão 5). */
async function AbaAprovacoes() {
  const a = await getAtor();
  // Busca em paralelo a configuração e os módulos ativos da empresa, e os usuários ativos (candidatos a aprovador).
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
        de documentos&quot; para que cada aprovação registre uma nova revisão da planilha controlada da unidade (código e revisão, com
        snapshot das linhas vigentes) na lista mestra.
      </p>
      {MODULOS_APROVACAO.map(({ m, modulo, titulo }) => {
        // Configuração de aprovação atual deste módulo (se exige, modo, aprovadores).
        const c = lerConfigAprovacao(empresa?.config, m);
        // A empresa contratou o módulo Documentos? (necessário para usar a tramitação de documentos)
        const docs = !!empresa?.modulosAtivos.includes("DOCUMENTOS");
        // O módulo (Perigos e Riscos ou LAIA) está contratado?
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
                    {docs ? "Cada inclusão/alteração/exclusão aprovada gera nova revisão do documento-planilha da unidade (tipo PL)." : "Requer o módulo Documentos contratado."}
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
  // Busca os tipos de documento, inclusive os inativos.
  const tipos = await listarTipos(await getAtor(), { incluirInativos: true });
  // Monta os campos de um tipo de documento (sigla, nome, periodicidade de revisão, ativo); a sigla fica travada se já há documentos do tipo.
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

/**
 * Aba "Feriados": calendário de feriados da empresa, usado na contagem de prazos em dias úteis.
 * Mostra aviso se o ano corrente não tem nenhum feriado ativo, o formulário de cadastro e a lista
 * (cada feriado pode ser editado, inativado ou, se inativo, reativado).
 */
async function AbaFeriados() {
  const a = await getAtor();
  // Busca a lista (com inativos) e o aviso do ano corrente; sem permissão, mostra o estado de "sem permissão".
  let feriados: Awaited<ReturnType<typeof listarFeriados>>;
  let semFeriadoNoAno: boolean;
  try {
    [feriados, semFeriadoNoAno] = await Promise.all([listarFeriados(a, { incluirInativos: true }), faltaFeriadoNoAnoCorrente(a)]);
  } catch (e) {
    if (e instanceof ErroNegocio) return <Alerta variante="erro" role="alert">{e.message}</Alerta>;
    throw e;
  }
  return (
    <div className={styles.secoesAba}>
      <p className={styles.explicacao}>
        Sábados e domingos nunca contam como dia útil e não precisam ser cadastrados. Os feriados abaixo também não contam nos prazos
        em dias úteis. Cadastrar, alterar ou inativar um feriado não muda prazos que já foram calculados.
      </p>
      {semFeriadoNoAno && (
        <Alerta variante="aviso" role="status">
          <strong>Nenhum feriado cadastrado para este ano.</strong> Sem feriados cadastrados, o prazo em dias úteis fica mais curto do
          que o real, porque só sábados e domingos são descontados. Cadastre os feriados do ano abaixo.
        </Alerta>
      )}
      <Cartao titulo="Novo feriado">
        <FormularioFeriado acao={criarFeriadoAcao} botao="Cadastrar feriado" limpar />
      </Cartao>
      <Cartao titulo={`Feriados (${feriados.length})`}>
        {feriados.length === 0 ? (
          <EstadoVazio>
            Nenhum feriado cadastrado ainda. Para cadastrar o primeiro, preencha a data e a descrição em “Novo feriado” e use
            “Cadastrar feriado”.
          </EstadoVazio>
        ) : (
          <ul className={styles.listaFeriados}>
            {feriados.map((f) => (
              <li key={f.id} className={styles.itemFeriado}>
                <div className={styles.resumoFeriado}>
                  <span className={styles.dataFeriado}>{formatarData(f.data)}</span>
                  <span className={styles.descricaoFeriado}>{f.descricao}</span>
                  <span className={`${styles.etiqueta} ${f.ativo ? styles.etiquetaVoce : styles.etiquetaInativo}`}>
                    {f.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className={styles.acoesFeriado}>
                  {f.ativo ? (
                    <>
                      <details className={styles.edicaoFeriado}>
                        <summary className={`${styles.resumoEditar} ${styles.alvoToque}`}>Editar</summary>
                        <FormularioFeriado
                          key={f.versao}
                          acao={editarFeriadoAcao}
                          botao="Salvar alterações"
                          id={f.id}
                          versao={f.versao}
                          inicial={{ data: f.data, descricao: f.descricao }}
                        />
                      </details>
                      <FormAcao
                        acao={inativarFeriadoAcao}
                        botao="Inativar"
                        textoPendente="Inativando…"
                        classeBotao={`${styles.botaoPerigo} ${styles.alvoToque}`}
                        confirmar={`Inativar o feriado “${f.descricao}” (${formatarData(f.data)})? Prazos já calculados não mudam.`}
                      >
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="versao" value={f.versao} />
                      </FormAcao>
                    </>
                  ) : (
                    <FormAcao
                      acao={reativarFeriadoAcao}
                      botao="Reativar"
                      textoPendente="Reativando…"
                      classeBotao={`${styles.botaoSecundario} ${styles.alvoToque}`}
                    >
                      <input type="hidden" name="data" value={f.data} />
                      <input type="hidden" name="descricao" value={f.descricao} />
                    </FormAcao>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

/** Aba "Notificações": dias de antecedência do alerta de prazo, resumo semanal e envio por e-mail. */
async function AbaPreferencias({ empresaId }: { empresaId: string }) {
  // Busca as preferências de notificação atuais da empresa.
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

/**
 * Página "Administração" (só para quem tem a permissão ADMIN_CONFIG): mostra uma das abas — usuários, perfis, unidades,
 * setores, funções, módulos, escalas, aprovações, tipos de documento, feriados ou notificações. `?aba=` escolhe a aba.
 */
/** Administração (usuários, perfis, obras, setores, funções e preferências de notificação). Exige ADMIN_CONFIG. */
export default async function Configuracoes({ searchParams }: PageProps<"/configuracoes">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Sem a permissão de administrar, a página responde 404 (não revela que ela existe).
  if (!temPermissao(ctx, "ADMIN_CONFIG")) notFound();
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Aba ativa: a da URL, se for válida; senão, "usuarios".
  const aba: Aba = (ABAS.find(([k]) => k === sp.aba)?.[0] ?? "usuarios") as Aba;
  // Só busca os dados gerais de administração nas abas que precisam deles (as outras buscam os seus).
  const d = aba === "preferencias" || aba === "feriados" || aba === "modulos" || aba === "escalas" || aba === "aprovacoes" || aba === "tipos-documento" ? null : await dadosAdministracao(await getAtor());
  // Só busca as escalas quando a aba Escalas está aberta.
  const escalas = aba === "escalas" ? await dadosEscalas(await getAtor()) : null;

  return (
    <div className={`${styles.pagina} fonteBase`}>
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
      {aba === "funcoes" && d && <AbaFuncoes d={d} />}
      {aba === "modulos" && <AbaModulos empresaId={ctx.empresaId} />}
      {aba === "escalas" && escalas && <AbaEscalas d={escalas} />}
      {aba === "aprovacoes" && <AbaAprovacoes />}
      {aba === "tipos-documento" && <AbaTiposDocumento ativo={ctx.modulosAtivos.includes("DOCUMENTOS")} />}
      {aba === "feriados" && <AbaFeriados />}
      {aba === "preferencias" && <AbaPreferencias empresaId={ctx.empresaId} />}
    </div>
  );
}
