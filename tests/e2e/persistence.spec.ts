import { test, expect } from '@playwright/test';

test.describe('Offline-first persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 27, 10, 0, 0) });
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();

    await page.getByRole('button', { name: 'Try now' }).click();
    await page.getByRole('button', { name: /Continue/ }).click();

    const input = page.getByRole('textbox').first();
    await input.fill('60000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await input.fill('20000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await input.fill('10000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await input.fill('30');
    await page.getByRole('button', { name: 'See my plan' }).click();
    await page.getByRole('button', { name: 'Start my month' }).click();
    await expect(page.getByText('You can still spend today')).toBeVisible();
  });

  async function logChai(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'Log a spend' }).click();
    await page.getByRole('button', { name: '4', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();
    await page.getByRole('button', { name: 'Chai', exact: true }).click();
    await expect(page.getByText(/₹40 spent so far/)).toBeVisible();
  }

  test('a logged spend survives a page reload', async ({ page }) => {
    await logChai(page);
    await page.reload();

    await expect(page.getByText('You can still spend today')).toBeVisible();
    await expect(page.getByText(/₹40 spent so far/)).toBeVisible();
  });

  test('a logged spend still works with the network offline', async ({ page, context }) => {
    await context.setOffline(true);
    await logChai(page);
    await expect(page.getByRole('button', { name: /Chai/ }).first()).toBeVisible();
  });
});
