/* Utilitários compartilhados pelos scripts de teste de integração (requer seed). */
import bcrypt from "bcryptjs";
import type { PapelUsuario, PrismaClient } from "@prisma/client";

/**
 * Garante (idempotente) um usuário de teste na empresa do usuário `modeloEmail`, SEM acesso a
 * obras (escopo SELECIONADAS vazio). Os testes não dependem de o seed dar ou não obra ao
 * colaborador.
 */
export async function garantirUsuarioSemObra(
  admin: PrismaClient,
  email: string,
  modeloEmail = "colaborador@monto.com.br",
  papel: PapelUsuario = "COLABORADOR",
) {
  const modelo = await admin.usuario.findUniqueOrThrow({ where: { email: modeloEmail } });
  const u = await admin.usuario.upsert({
    where: { email },
    update: { ativo: true, papel, escopoObras: "SELECIONADAS", perfilId: null },
    create: {
      empresaId: modelo.empresaId,
      email,
      nome: `Teste ${email.split("@")[0]}`,
      papel,
      escopoObras: "SELECIONADAS",
      senhaHash: await bcrypt.hash("vigen123", 10),
    },
  });
  await admin.usuarioAcessoObra.deleteMany({ where: { usuarioId: u.id } });
  return u;
}
