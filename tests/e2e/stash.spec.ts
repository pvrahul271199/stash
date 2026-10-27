import { test, expect } from '@playwright/test';

test.describe('Stash E2E flows', () => {
  test('setup -> log 3 spends (chip, Save, More with a type) -> close day -> check tomorrow amount', async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 27, 10, 0, 0) });
    await page.goto('/');

    // Welcome -> Onboarding
    await expect(page.getByRole('heading', { name: 'Know what you can spend today.' })).toBeVisible();
    await page.getByRole('button', { name: 'Set up my month' }).click();

    // 1. Income: 50,000
    const input = page.getByRole('textbox');
    await input.fill('50000');
    await page.getByRole('button', { name: 'Continue' }).click();

    // 2. Bills: 18,000
    await input.fill('18000');
    await page.getByRole('button', { name: 'Continue' }).click();

    // 3. Savings: 10,000
    await input.fill('10000');
    await page.getByRole('button', { name: 'Continue' }).click();

    // 4. Days: 30
    await input.fill('30');
    await page.getByRole('button', { name: 'See my plan' }).click();

    // Plan summary: 50000 - 18000 - 10000 = 22,000 (733/day)
    await expect(page.getByText('Your money to live on')).toBeVisible();
    await expect(page.getByLabel('₹22,000')).toBeVisible();
    await page.getByRole('button', { name: 'Start my month' }).click();

    // Today tab: ₹733
    await expect(page.getByText('You can still spend today')).toBeVisible();
    await expect(page.getByLabel('₹733')).toBeVisible();

    // Spend 1: via quick chip (₹20 Chai)
    await page.getByRole('button', { name: 'Log a spend' }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();
    await page.getByRole('button', { name: 'Chai', exact: true }).click();
    await expect(page.getByText('Chai')).toBeVisible();

    // Spend 2: via Save without chip -> Sort later (₹100)
    await page.getByRole('button', { name: 'Log a spend' }).click();
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '00', exact: true }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Sort later')).toBeVisible();

    // Spend 3: via More with a type -> Travel / Auto (₹80)
    await page.getByRole('button', { name: 'Log a spend' }).click();
    await page.getByRole('button', { name: '8', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: /Travel/ }).click();
    await page.getByRole('button', { name: 'Auto', exact: true }).click();

    // Spent 200 total today, so 733.33 - 200 = 533 left today
    await expect(page.getByLabel('₹533')).toBeVisible();

    // Close the day
    await page.getByRole('button', { name: 'Close the day' }).click();
    await expect(page.getByLabel('₹200')).toBeVisible();
    await page.getByRole('dialog', { name: 'Close the day' }).getByRole('button', { name: 'Close the day' }).click();

    // Day closed: pool is 22000 - 200 = 21800 over 29 days = ₹752
    const closedDialog = page.getByRole('dialog', { name: 'Day closed' });
    await expect(closedDialog.getByRole('heading', { name: 'Day closed' })).toBeVisible();
    await expect(closedDialog.getByText('Tomorrow you can spend')).toBeVisible();
    await expect(closedDialog.getByLabel('₹752')).toBeVisible();
    await closedDialog.getByRole('button', { name: 'Start day 2' }).click();
    await expect(page.getByText(/day 2 of 30/)).toBeVisible();
  });

  test('catch-up after moving the clock forward 3 days', async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 20, 10, 0, 0) });
    await page.goto('/');

    await page.getByRole('button', { name: 'Set up my month' }).click();
    const input = page.getByRole('textbox');
    await input.fill('50000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await input.fill('18000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await input.fill('10000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await input.fill('30');
    await page.getByRole('button', { name: 'See my plan' }).click();
    await page.getByRole('button', { name: 'Start my month' }).click();
    await expect(page.getByText(/day 1 of 30/)).toBeVisible();

    // Advance clock 3 days to 23 Oct and reload
    await page.clock.setFixedTime(new Date(2026, 9, 23, 10, 0, 0));
    await page.reload();

    await expect(page.getByText(/The last 3 days didn't get logged/)).toBeVisible();
    await page.getByRole('textbox', { name: 'Rough total spent' }).fill('1500');
    await page.getByRole('button', { name: 'Use my estimate' }).click();

    await expect(page.getByText(/day 4 of 30/)).toBeVisible();
  });

  test('category add and remove', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Or explore with sample data first' }).click();
    await page.getByRole('button', { name: 'Categories' }).click();

    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();

    // Add category "Pets"
    await page.getByLabel('New category').fill('Pets');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('button', { name: /Pets/ })).toBeVisible();

    // Expand Pets, add a type, then remove Pets
    await page.getByRole('button', { name: /Pets/ }).click();
    await page.getByLabel('Add a type to Pets').fill('Vet');
    await page.getByRole('button', { name: 'Add' }).first().click();
    await expect(page.getByText('Vet')).toBeVisible();

    await page.getByRole('button', { name: /Remove Pets/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove Pets' }).click();
    await expect(page.getByRole('button', { name: /Pets/ })).toHaveCount(0);
  });

  test('Insights interactions: switch views, focus a category from the donut, drag the chart', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Or explore with sample data first' }).click();

    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();

    // Switch views between Each day and Running total
    await page.getByRole('button', { name: 'Running total' }).click();
    await expect(page.getByRole('group', { name: 'Running total' })).toBeVisible();
    await page.getByRole('button', { name: 'Each day' }).click();

    // Drag across the chart and check tooltip updates
    const chart = page.getByRole('group', { name: 'Spending each day' });
    const box = await chart.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
      await page.mouse.up();
    }
    await expect(page.getByText(/Tap or drag across the chart/)).toHaveCount(0);

    // Focus a category from the donut
    const foodSlice = page.getByRole('group', { name: 'Spending by category' }).getByRole('button', { name: /^Food,/ });
    await foodSlice.click();
    await expect(foodSlice).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/% of spending/)).toBeVisible();
  });

  test('PWA service worker works offline after initial visit', async ({ page, context }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Or explore with sample data first' }).click();
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();

    // Wait for service worker to activate
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });

    // Go offline and reload
    await context.setOffline(true);
    await page.reload();

    // App shell and IndexedDB data load offline
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(page.getByText('You can still spend today')).toBeVisible();
    await context.setOffline(false);
  });
});
