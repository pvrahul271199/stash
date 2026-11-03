import { test, expect } from '@playwright/test';

test.describe('Spread switch only on non-today days', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 27, 10, 0, 0) });
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();

    // Standard fast onboarding setup
    await page.getByRole('button', { name: 'Try without an account' }).click();
    await page.getByRole('button', { name: /Continue/ }).click();

    const input = page.getByRole('textbox').first();
    await input.fill('60000'); // Income
    await page.getByRole('button', { name: 'Continue' }).click();

    await input.fill('20000'); // Bills
    await page.getByRole('button', { name: 'Continue' }).click();

    await input.fill('10000'); // Savings
    await page.getByRole('button', { name: 'Continue' }).click();

    await input.fill('30'); // 30 days -> Pool: 30,000 (1,000/day)
    await page.getByRole('button', { name: 'See my plan' }).click();
    await page.getByRole('button', { name: 'Start my month' }).click();

    await expect(page.getByText('You can still spend today')).toBeVisible();
  });

  test('spread switch is hidden when logging into today', async ({ page }) => {
    await page.getByRole('button', { name: 'Log a spend' }).click();
    await expect(page.getByRole('dialog', { name: 'Log a spend' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Spread over remaining days' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'What does this do?' })).toHaveCount(0);
  });

  test('tapping today in the week row also shows no spread switch', async ({ page }) => {
    await page.getByRole('button', { name: /Open day 1,/ }).click();
    await page.getByRole('button', { name: 'Log a spend on this day' }).click();
    await expect(page.getByRole('switch', { name: 'Spread over remaining days' })).toHaveCount(0);
  });

  test('spread switch and info icon appear for an upcoming day', async ({ page }) => {
    await page.getByRole('button', { name: /Open day 3,/ }).click();
    await page.getByRole('button', { name: 'Log a spend on this day' }).click();

    const toggle = page.getByRole('switch', { name: 'Spread over remaining days' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await page.getByRole('button', { name: 'What does this do?' }).click();
    await expect(page.getByRole('dialog', { name: 'About spreading a spend' })).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(page.getByRole('dialog', { name: 'About spreading a spend' })).toHaveCount(0);
  });

  test('note field is labelled "Note"', async ({ page }) => {
    await page.getByRole('button', { name: 'Log a spend' }).click();
    await page.getByRole('button', { name: 'Add a note' }).click();
    await expect(page.getByPlaceholder('Note')).toBeVisible();
  });
});
