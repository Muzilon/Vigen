const CABECALHOS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;

const PAGINA = `<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arquivo não encontrado</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
  main { max-width: 440px; padding: 24px; text-align: center; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 0; color: #475569; line-height: 1.5; }
</style>
<main>
  <h1>Arquivo não encontrado</h1>
  <p>O arquivo não existe, foi removido ou você não tem acesso a ele. Pode fechar esta aba e voltar ao sistema.</p>
</main>
`;

/**
 * Resposta 404 das rotas de download. Quando quem chamou é o navegador abrindo o link (Accept: text/html),
 * mostra uma página legível em vez do texto cru "Não encontrado" (que aparecia como uma tela preta);
 * para qualquer outro chamador, mantém o texto simples.
 */
export function arquivoNaoEncontrado(req: Request) {
  const navegador = req.headers.get("accept")?.includes("text/html") ?? false;
  if (!navegador) return new Response("Não encontrado", { status: 404, headers: CABECALHOS });
  return new Response(PAGINA, {
    status: 404,
    headers: { ...CABECALHOS, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" },
  });
}
