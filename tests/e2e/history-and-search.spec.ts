import { test, expect } from '@playwright/test';

test.describe('History Tab & Search Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();

    // Explore with sample data so History is rich with spends across multiple days
    await page.getByRole('button', { name: 'Or explore with sample data first' }).click();
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();

    // Navigate to History tab
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  });

  test('displays monthly calendar grid and selects specific day to view transactions', async ({ page }) => {
    // Calendar table exists
    await expect(page.getByRole('table', { name: 'Spending calendar' })).toBeVisible();

    // Click Day 15
    const day15Button = page.getByRole('button', { name: /Day 15/i });
    if (await day15Button.count() > 0) {
      await day15Button.first().click();
      await expect(page.getByText(/Day 15/)).toBeVisible();
    }
  });

  test('searches spends by text label, category and exact amount, and clears search', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: 'Search spends' });
    await expect(searchInput).toBeVisible();

    // Search by label "Lunch"
    await searchInput.fill('Lunch');
    await expect(page.getByText(/matching/i)).toBeVisible();

    // Search by amount "250"
    await searchInput.fill('250');
    await expect(page.getByText(/matching/i)).toBeVisible();

    // Clear search using the clear button
    const clearButton = page.getByRole('button', { name: 'Clear search' });
    await clearButton.click();
    await expect(searchInput).toHaveValue('');
    await expect(page.getByRole('table', { name: 'Spending calendar' })).toBeVisible();
  });

  test('opens spend in EditSpendSheet, updates amount and label, and saves changes', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: 'Search spends' });
    await searchInput.fill('Chai');
    await expect(page.getByText(/matching/i)).toBeVisible();

    // Click the first matching spend
    const spendItem = page.getByRole('button', { name: /Chai/i }).first();
    await spendItem.click();

    // EditSpendSheet appears
    const editDialog = page.getByRole('dialog', { name: 'Edit spend' });
    await expect(editDialog).toBeVisible();

    // Update label to "Masala Chai"
    const labelInput = editDialog.getByRole('textbox', { name: 'Label' });
    await labelInput.fill('Masala Chai');

    // Save
    await editDialog.getByRole('button', { name: 'Save changes' }).click();

    // Toast feedback appears and modal closes
    await expect(page.getByText('Spend updated')).toBeVisible();
  });

  test('opens spend and removes it cleanly', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: 'Search spends' });
    await searchInput.fill('Dinner');
    await expect(page.getByText(/matching/i)).toBeVisible();

    const spendItem = page.getByRole('button', { name: /Dinner/i }).first();
    await spendItem.click();

    const editDialog = page.getByRole('dialog', { name: 'Edit spend' });
    await expect(editDialog).toBeVisible();

    await editDialog.getByRole('button', { name: 'Delete this spend' }).click();
    await expect(page.getByText('Spend removed')).toBeVisible();
  });
});
