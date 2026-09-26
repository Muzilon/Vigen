/**
 * Leitura do FormData enviado pelo componente <SolicitarAprovacao> (paginas/html/componentes/
 * solicitar-aprovacao.tsx). A server action do módulo chama `lerSolicitacaoDoForm(fd)` e repassa
 * o resultado a `solicitarAprovacao` — de preferência recalculando o payload no servidor.
 */
import { z } from "zod";
import type { DadosSolicitacao } from "./servico";

const json = <T extends z.ZodType>(esquema: T, msg: string) =>
  z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: msg });
        return z.NEVER;
      }
    })
    .pipe(esquema);

const esquema = z.object({
  entidadeTipo: z.enum(["PROCESSO", "HIRA", "LAIA", "DOCUMENTO", "RISCO_OPORTUNIDADE", "TESTE"]),
  entidadeId: z.string().trim().min(1, "Registro inválido."),
  tipoAlteracao: z.enum(["INCLUSAO", "ALTERACAO", "EXCLUSAO", "PUBLICACAO"]),
  modo: z.enum(["SEQUENCIAL", "PARALELO"], "Escolha o modo de aprovação."),
  aprovadorIds: json(z.array(z.uuid("Aprovador inválido.")).min(1, "Informe ao menos um aprovador."), "Aprovadores inválidos."),
  payload: json(z.json(), "Dados da alteração inválidos.").optional(),
  resumo: z.string().trim().min(1, "Informe um resumo da alteração."),
});

export function lerSolicitacaoDoForm(fd: FormData): DadosSolicitacao {
  const d = esquema.parse(Object.fromEntries(fd.entries()));
  return { ...d, payload: (d.payload ?? {}) as DadosSolicitacao["payload"] };
}
