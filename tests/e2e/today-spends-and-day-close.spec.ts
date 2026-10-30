import { test, expect } from '@playwright/test';

test.describe('Today Tab Spends & Day Close Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 27, 10, 0, 0) });
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();

    // Standard fast onboarding setup
    await page.getByRole('button', { name: 'Set up my month' }).click();
    await page.getByRole('button', { name: /Continue/ }).click();

    const input = page.getByRole('textbox');
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

  test('logs quick chip spend and updates today remaining allowance', async ({ page }) => {
    await page.getByRole('button', { name: 'Log a spend' }).click();

    // Keypad: 40
    await page.getByRole('button', { name: '4', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();

    // Tap quick chip
    await page.getByRole('button', { name: 'Chai', exact: true }).click();

    // Spend appears in list and allowance is updated
    await expect(page.getByText('Chai')).toBeVisible();
    await expect(page.getByText(/You spent 40 today/)).toBeVisible();
  });

  test('logs keypad amount with Save as Sort later', async ({ page }) => {
    await page.getByRole('button', { name: 'Log a spend' }).click();

    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Sort later')).toBeVisible();
  });

  test('selects category and subcategory from picker, and switches payment mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Log a spend' }).click();

    // Switch payment mode to Card
    await page.getByRole('button', { name: 'Card' }).click();

    // Enter 250
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();

    // Open Category Picker via More
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByText('What was it for?')).toBeVisible();

    // Pick Travel -> Cab
    await page.getByRole('button', { name: /Travel/ }).click();
    await page.getByRole('button', { name: 'Cab', exact: true }).click();

    // Verify logged spend shows category
    await expect(page.getByText(/Cab/)).toBeVisible();
  });

  test('creates new category on-the-fly in picker and immediately logs spend', async ({ page }) => {
    await page.getByRole('button', { name: 'Log a spend' }).click();

    await page.getByRole('button', { name: '8', exact: true }).click();
    await page.getByRole('button', { name: '5', exact: true }).click();

    await page.getByRole('button', { name: 'More' }).click();
    await page.getByLabel('Need another category?').fill('Pharmacy');
    await page.getByRole('button', { name: 'Add' }).first().click();

    // Automatically picks Pharmacy and saves spend!
    await expect(page.getByText('Pharmacy')).toBeVisible();
  });

  test('detects big spend and provides options to spread or take from savings', async ({ page }) => {
    await page.getByRole('button', { name: 'Log a spend' }).click();

    // Enter 3500 (allowance is ~1,000, so 3,500 triggers Big Spend)
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '00', exact: true }).click();

    await page.getByRole('button', { name: 'Save' }).click();

    // Big Spend prompt
    await expect(page.getByText(/That's a bigger one/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Spread it over the month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take it from savings' })).toBeVisible();

    await page.getByRole('button', { name: 'Spread it over the month' }).click();
    await expect(page.getByText(/You can still spend today/)).toBeVisible();
  });

  test('closes the day and advances to day 2 with recalculated daily allowance', async ({ page }) => {
    // Log a 200 spend
    await page.getByRole('button', { name: 'Log a spend' }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '00', exact: true }).click();
    await page.getByRole('button', { name: 'Save' }).click();

    // Close day
    await page.getByRole('button', { name: 'Close the day' }).click();
    const closeDialog = page.getByRole('dialog', { name: 'Close the day' });
    await expect(closeDialog).toBeVisible();
    await closeDialog.getByRole('button', { name: 'Close the day' }).click();

    // Day closed screen
    const closedDialog = page.getByRole('dialog', { name: 'Day closed' });
    await expect(closedDialog.getByRole('heading', { name: 'Day closed' })).toBeVisible();
    await expect(closedDialog.getByText('Tomorrow you can spend')).toBeVisible();

    await closedDialog.getByRole('button', { name: 'Start day 2' }).click();
    await expect(page.getByText(/day 2 of 30/)).toBeVisible();
  });

  test('SyncStatusPill is clickable and displays status toast feedback', async ({ page }) => {
    const pill = page.getByRole('button', { name: /Sync/i });
    await expect(pill).toBeVisible();
    await pill.click();
    // Running locally toast feedback
    await expect(page.getByText(/Running locally|Synced/)).toBeVisible();
  });
});
