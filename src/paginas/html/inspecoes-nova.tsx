import Link from "next/link";
import { notFound } from "next/navigation";
import { iniciarInspecaoAcao } from "@/app/(app)/inspecoes/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { hojeNoFuso } from "@/lib/datas";
import { ROTULO_TIPO_CHECKLIST } from "@/lib/inspecoes/regras";
import { opcoesInspecoes, podeGerenciarModelos, podeRealizarInspecao } from "@/lib/inspecoes/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/inspecoes-nova.module.css";

/**
 * Página "Nova inspeção": escolhe o modelo de checklist, a unidade, a data e (opcionais) setor e processo,
 * e abre a execução. Exige permissão de realizar inspeções.
 */
/** Nova inspeção: escolhe modelo + obra (setor/processo opcionais) e abre a execução. */
export default async function InspecoesNova() {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Inspeções, a página responde "404 - não encontrada".
  exigirModulo(ctx, "INSPECOES");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeRealizarInspecao(a)) notFound();
  // Opções dos campos (modelos, unidades, setores, processos, pessoas) e fuso horário da empresa.
  const [op, fuso] = await Promise.all([opcoesInspecoes(a), fusoDaEmpresa(a)]);
  // Só aparecem modelos que já têm pelo menos uma pergunta.
  const modelos = op.modelos.filter((m) => m.totalItens > 0);

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/inspecoes">← Inspeções</Link>
      </nav>
      <h1 className={styles.titulo}>Nova inspeção</h1>
      {modelos.length === 0 || op.obras.length === 0 ? (
        <EstadoVazio>
          {modelos.length === 0 ? "Nenhum modelo de checklist ativo com perguntas." : "Você não tem acesso a nenhuma unidade."}
          {podeGerenciarModelos(a) && modelos.length === 0 && <> <Link href="/inspecoes/modelos">Cadastrar modelo</Link></>}
        </EstadoVazio>
      ) : (
        <FormAcao acao={iniciarInspecaoAcao} botao="Iniciar inspeção" className={styles.formulario}>
          <fieldset className={styles.modelos}>
            <legend>Checklist</legend>
            {modelos.map((m, i) => (
              <label key={m.id} className={styles.opcaoModelo}>
                <input type="radio" name="modeloId" value={m.id} defaultChecked={i === 0} required />
                <span>
                  <strong>{m.nome}</strong>
                  <small>{ROTULO_TIPO_CHECKLIST[m.tipo]} · {m.totalItens} pergunta(s)</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label className={styles.campo}>
            Unidade
            <select name="obraId" required defaultValue={op.obras.length === 1 ? op.obras[0].id : ""} className={styles.entrada}>
              {op.obras.length > 1 && <option value="">Selecione…</option>}
              {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </label>
          <label className={styles.campo}>
            Data
            <input type="date" name="dataInspecao" required defaultValue={hojeNoFuso(fuso)} className={styles.entrada} />
          </label>
          <label className={styles.campo}>
            Setor (opcional)
            <select name="setorId" defaultValue="" className={styles.entrada}>
              <option value="">—</option>
              {op.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
          <label className={styles.campo}>
            Processo (opcional)
            <select name="processoId" defaultValue="" className={styles.entrada}>
              <option value="">—</option>
              {op.processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
            </select>
          </label>
          {podeGerenciarModelos(a) && (
            <label className={styles.campo}>
              Inspetor
              <select name="inspetorId" defaultValue={a.usuarioId} className={styles.entrada}>
                {op.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>
          )}
        </FormAcao>
      )}
    </div>
  );
}
