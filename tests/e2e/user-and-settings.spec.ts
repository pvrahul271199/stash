import { test, expect } from '@playwright/test';

test.describe('User Tab & Preferences Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();

    // Fast setup with sample data
    await page.getByRole('button', { name: 'Or explore with sample data first' }).click();
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();

    // Navigate to User tab
    await page.getByRole('button', { name: 'User' }).click();
    await expect(page.getByRole('heading', { name: 'User Profile & Plan' })).toBeVisible();
  });

  test('displays user profile card with username and encoded ID', async ({ page }) => {
    await expect(page.getByText(/User ID:/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Display currency' })).toBeVisible();
  });

  test('switches display currency to USD and AED, updating the active token and Today numbers', async ({ page }) => {
    // Switch to USD
    await page.getByRole('button', { name: /\$ USD/i }).click();
    await expect(page.getByText('Dollar')).toBeVisible();
    await expect(page.getByText(/USD · Dollar/)).toBeVisible();

    // Verify Today tab updates with dollar currency
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(page.getByText('You can still spend today')).toBeVisible();
    await expect(page.getByText(/\$/)).toBeVisible();

    // Return to User tab and switch to AED
    await page.getByRole('button', { name: 'User' }).click();
    await page.getByRole('button', { name: /AED/i }).click();
    await expect(page.getByText(/AED · Dirham/)).toBeVisible();
  });

  test('edits budget plan and saves updated values', async ({ page }) => {
    // Scroll to Your budget plan and click Edit budget plan
    const editPlanBtn = page.getByRole('button', { name: 'Edit budget plan' });
    await editPlanBtn.scrollIntoViewIfNeeded();
    await editPlanBtn.click();

    // Opens Onboarding edit wizard
    await expect(page.getByText('What lands in your account each month?')).toBeVisible();
    const input = page.getByRole('textbox').first();
    await input.fill('95000');
    await page.getByRole('button', { name: 'Continue' }).click(); // Bills
    await page.getByRole('button', { name: 'Continue' }).click(); // Savings
    await page.getByRole('button', { name: 'See my plan' }).click(); // Summary

    // Start month with updated plan
    await page.getByRole('button', { name: 'Start my month' }).click();
    await expect(page.getByText('You can still spend today')).toBeVisible();
  });

  test('expands collapsible Categories & Types in User tab, adds category, adds type, and removes category', async ({ page }) => {
    // Scroll to Categories & Types accordion
    const accordionBtn = page.getByRole('button', { name: /Categories & Types/i });
    await accordionBtn.scrollIntoViewIfNeeded();
    await accordionBtn.click();

    // Section is now expanded
    await expect(page.getByText('Add a new category')).toBeVisible();

    // Add category "Fitness"
    await page.getByPlaceholder('e.g. Pets, Hobbies').fill('Fitness');
    await page.getByRole('button', { name: 'Add' }).last().click();
    await expect(page.getByText('Fitness')).toBeVisible();

    // Expand Fitness and add a type
    await page.getByRole('button', { name: /Fitness/i }).click();
    const typeInput = page.getByPlaceholder('Add a type to Fitness');
    await typeInput.fill('Gym');
    await page.getByRole('button', { name: 'Add' }).first().click();
    await expect(page.getByText('Gym')).toBeVisible();

    // Remove Fitness category
    await page.getByRole('button', { name: 'Remove Fitness' }).click();
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Remove Fitness' }).click();

    await expect(page.getByText('Fitness')).toHaveCount(0);
  });

  test('resets all data on device through confirmation dialog', async ({ page }) => {
    const deleteBtn = page.getByRole('button', { name: 'Delete all data on this device' });
    await deleteBtn.scrollIntoViewIfNeeded();
    await deleteBtn.click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Delete all data' }).click();

    // Redirects to Welcome screen
    await expect(page.getByRole('heading', { name: 'Know what you can spend today.' })).toBeVisible();
  });
});
