import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Testes Automatizados de Acessibilidade (Playwright + axe-core)
 * Componente: UploadAnexo
 * Padrão: Vigen Design System (WCAG 2.1 Nível AA)
 */

test.describe('UploadAnexo - Acessibilidade e Estados (Axe + Playwright)', () => {
  const COMPONENT_URL = '/upload-anexo'; // Rota de montagem do componente em ambiente de testes/Storybook

  test.beforeEach(async ({ page }) => {
    // Carrega a página do componente
    await page.goto(COMPONENT_URL);
    await page.waitForSelector('[data-testid="upload-container"]');
  });

  test('Deve ser 100% livre de violações WCAG AA no Estado Vazio (Empty State)', async ({ page }) => {
    // Verifica presença visual do estado vazio da dropzone
    await expect(page.locator('[data-testid="dropzone-empty"]')).toBeVisible();

    // Scan de acessibilidade com AxeBuilder
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="upload-container"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Deve manter o botão Enviar desabilitado quando a justificativa tiver menos de 10 caracteres', async ({ page }) => {
    const submitBtn = page.locator('[data-testid="submit-button"]');
    const textarea = page.locator('[data-testid="justificativa-input"]');

    // Botão deve iniciar desabilitado
    await expect(submitBtn).toBeDisabled();

    // Digita apenas 5 caracteres
    await textarea.fill('Curto');
    await textarea.blur();

    // Alerta de erro acessível exibido
    const errorAlert = page.locator('[data-testid="justificativa-error"]');
    await expect(errorAlert).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Scan axe no estado de validação de erro
    const scanResults = await new AxeBuilder({ page })
      .include('[data-testid="upload-container"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(scanResults.violations).toEqual([]);
  });

  test('Deve habilitar o botão Enviar somente com arquivo e justificativa >= 10 caracteres', async ({ page }) => {
    const fileInput = page.locator('[data-testid="file-input"]');
    const textarea = page.locator('[data-testid="justificativa-input"]');
    const submitBtn = page.locator('[data-testid="submit-button"]');

    // Simula anexo de arquivo PDF
    await fileInput.setInputFiles({
      name: 'documento_auditoria.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 Mock PDF content'),
    });

    // Card do arquivo deve ser exibido
    await expect(page.locator('[data-testid="file-card"]')).toBeVisible();

    // Justificativa válida (>= 10 chars)
    await textarea.fill('Substituição de relatório com correções da auditoria fiscal');

    // Botão deve ficar habilitado
    await expect(submitBtn).toBeEnabled();

    // Verificação de acessibilidade no estado preenchido
    const scanResults = await new AxeBuilder({ page })
      .include('[data-testid="upload-container"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(scanResults.violations).toEqual([]);
  });

  test('Deve garantir acessibilidade no Estado Carregando (Loading State)', async ({ page }) => {
    const fileInput = page.locator('[data-testid="file-input"]');
    const textarea = page.locator('[data-testid="justificativa-input"]');
    const submitBtn = page.locator('[data-testid="submit-button"]');

    await fileInput.setInputFiles({
      name: 'laudo_tecnico.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 Mock'),
    });

    await textarea.fill('Justificativa válida com mais de dez caracteres para upload.');

    // Clica em enviar e verifica estado carregando
    await submitBtn.click();

    const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
    await expect(loadingIndicator).toBeVisible();

    // Scan de acessibilidade durante o estado de carregamento
    const scanResults = await new AxeBuilder({ page })
      .include('[data-testid="upload-container"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(scanResults.violations).toEqual([]);
  });

  test('Deve exibir banner acessível no Estado Offline e desabilitar ações', async ({ page, context }) => {
    // Simula conexão offline no navegador
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    const offlineBanner = page.locator('[data-testid="offline-banner"]');
    await expect(offlineBanner).toBeVisible();

    const submitBtn = page.locator('[data-testid="submit-button"]');
    await expect(submitBtn).toBeDisabled();

    // Scan de acessibilidade no estado offline
    const scanResults = await new AxeBuilder({ page })
      .include('[data-testid="upload-container"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(scanResults.violations).toEqual([]);
  });

  test('Navegação e ativação por teclado (WCAG 2.1.1 Keyboard Accessible)', async ({ page }) => {
    const dropzone = page.locator('[data-testid="dropzone"]');
    const textarea = page.locator('[data-testid="justificativa-input"]');

    // Foca na dropzone via Tab
    await page.keyboard.press('Tab');
    await expect(dropzone).toBeFocused();

    // Navega para a textarea via Tab
    await page.keyboard.press('Tab');
    await expect(textarea).toBeFocused();
  });
});
