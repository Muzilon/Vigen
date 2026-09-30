import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Suíte de Testes Automatizados de Acessibilidade (A11y)
 * Fatia F6 - Formulário de Edição de Documento
 * Padrão: Vigen Design System (WCAG 2.1 Nível AA / AAA)
 */

test.describe('F6 - Acessibilidade do Formulário de Edição de Documento', () => {
  test.beforeEach(async ({ page }) => {
    // Carrega o componente montado na rota de teste / scratch
    await page.goto('/documentos/doc-101/editar');
  });

  test('deve passar nas validações de acessibilidade axe-core no estado padrão (zero violações)', async ({
    page
  }) => {
    const resultadosA11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(resultadosA11y.violations).toEqual([]);
  });

  test('todos os campos obrigatórios devem possuir labels associados e aria-required="true"', async ({
    page
  }) => {
    const campoTitulo = page.locator('#campo-titulo');
    await expect(campoTitulo).toHaveAttribute('aria-required', 'true');
    await expect(page.locator('label[for="campo-titulo"]')).toBeVisible();

    const campoCategoria = page.locator('#campo-categoria');
    await expect(campoCategoria).toHaveAttribute('aria-required', 'true');
    await expect(page.locator('label[for="campo-categoria"]')).toBeVisible();

    const campoDescricao = page.locator('#campo-descricao');
    await expect(campoDescricao).toHaveAttribute('aria-required', 'true');
    await expect(page.locator('label[for="campo-descricao"]')).toBeVisible();
  });

  test('deve tratar criticamente o conflito de versão com role="alert" e aria-live="assertive"', async ({
    page
  }) => {
    // Simula submissão que dispara retorno 'conflito_versao'
    await page.fill('#campo-titulo', 'Diretrizes Alteradas Concorrentemente');
    await page.click('button[data-testid="btn-salvar"]');

    const bannerConflito = page.locator('[data-testid="banner-conflito"]');
    await expect(bannerConflito).toBeVisible();
    await expect(bannerConflito).toHaveAttribute('role', 'alert');
    await expect(bannerConflito).toHaveAttribute('aria-live', 'assertive');

    // Validação da frase crítica obrigatória
    await expect(bannerConflito).toContainText('O documento foi modificado por outro usuário');

    // Validação de foco e navegação via teclado
    const btnRecarregar = bannerConflito.locator('button:has-text("Recarregar Versão Mais Recente")');
    await expect(btnRecarregar).toBeVisible();
    await btnRecarregar.focus();
    await expect(btnRecarregar).toBeFocused();

    // Verificação de acessibilidade com axe no banner de conflito
    const resultadosA11yConflito = await new AxeBuilder({ page })
      .include('[data-testid="banner-conflito"]')
      .analyze();

    expect(resultadosA11yConflito.violations).toEqual([]);
  });

  test('deve exibir indicador offline acessível com role="status"', async ({ page, context }) => {
    // Simula queda de conectividade de rede
    await context.setOffline(true);

    const bannerOffline = page.locator('[data-testid="banner-offline"]');
    await expect(bannerOffline).toBeVisible();
    await expect(bannerOffline).toHaveAttribute('role', 'status');
    await expect(bannerOffline).toContainText('Você está sem conexão com a internet');

    // Botão de salvar deve estar desabilitado
    const btnSalvar = page.locator('button[data-testid="btn-salvar"]');
    await expect(btnSalvar).toBeDisabled();
  });

  test('deve apresentar estado de carregamento acessível com aria-busy="true"', async ({ page }) => {
    // Rota com carregamento inicial ativo
    await page.goto('/documentos/doc-101/editar?loading=true');

    const estadoCarregando = page.locator('[data-testid="estado-carregando"]');
    await expect(estadoCarregando).toBeVisible();
    await expect(estadoCarregando).toHaveAttribute('aria-busy', 'true');
    await expect(estadoCarregando).toHaveAttribute('aria-live', 'polite');
  });

  test('deve apresentar feedback inline acessível para erros de validação', async ({ page }) => {
    await page.fill('#campo-titulo', 'a'); // Título muito curto (<3 chars)
    await page.click('button[data-testid="btn-salvar"]');

    const campoTitulo = page.locator('#campo-titulo');
    await expect(campoTitulo).toHaveAttribute('aria-invalid', 'true');
    await expect(campoTitulo).toHaveAttribute('aria-describedby', 'erro-campo-titulo');

    const msgErro = page.locator('#erro-campo-titulo');
    await expect(msgErro).toBeVisible();
    await expect(msgErro).toHaveAttribute('role', 'alert');
  });
});
