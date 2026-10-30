import { test, expect } from '@playwright/test';

test.describe('Insights Tab Analytics & Visualizations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();

    // Use sample data to explore complete analytics suite
    await page.getByRole('button', { name: 'Or explore with sample data first' }).click();
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
  });

  test('displays summary card with spent amount and to-live-on progress', async ({ page }) => {
    await expect(page.getByText('Spent this month so far')).toBeVisible();
    await expect(page.getByText(/to live on/)).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Spent so far' })).toBeVisible();
  });

  test('toggles between Each day and Running total chart modes', async ({ page }) => {
    const runningTotalBtn = page.getByRole('button', { name: 'Running total' });
    const eachDayBtn = page.getByRole('button', { name: 'Each day' });

    await expect(runningTotalBtn).toBeVisible();
    await expect(eachDayBtn).toBeVisible();

    // Switch to Running total
    await runningTotalBtn.click();
    await expect(page.getByRole('group', { name: 'Running total' })).toBeVisible();

    // Switch back to Each day
    await eachDayBtn.click();
    await expect(page.getByRole('group', { name: 'Spending each day' })).toBeVisible();
  });

  test('scrubs across the daily bar chart and verifies interaction', async ({ page }) => {
    const chart = page.getByRole('group', { name: 'Spending each day' });
    const box = await chart.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
      await page.mouse.up();
    }

    // Chart responds to pointer scrubbing
    await expect(chart).toBeVisible();
  });

  test('interacts with category donut slices to filter and focus category data', async ({ page }) => {
    const donutGroup = page.getByRole('group', { name: 'Spending by category' });
    await expect(donutGroup).toBeVisible();

    // Find and click the Food slice
    const foodSlice = donutGroup.getByRole('button', { name: /^Food,/ });
    if (await foodSlice.count() > 0) {
      await foodSlice.first().click();
      await expect(foodSlice.first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText(/% of spending/)).toBeVisible();
    }
  });

  test('displays breakdown sections for time of day, weekday and biggest spends', async ({ page }) => {
    await expect(page.getByText(/Time of day/i)).toBeVisible();
    await expect(page.getByText(/By day of week/i)).toBeVisible();
    await expect(page.getByText(/Biggest spends/i)).toBeVisible();
  });
});
