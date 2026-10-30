import { test, expect } from '@playwright/test';

test.describe('Welcome & Onboarding Page Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
  });

  test('completes full onboarding wizard with custom user, itemized bills and savings', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Know what you can spend today.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set up my month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Or explore with sample data first' })).toBeVisible();

    // 1. Enter user flow
    await page.getByRole('button', { name: 'Set up my month' }).click();
    await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible();

    const usernameInput = page.getByRole('textbox', { name: /username/i });
    await usernameInput.fill('Alex');
    await page.getByRole('button', { name: 'Continue' }).click();

    // 2. Step 0: Income
    await expect(page.getByText('What lands in your account each month?')).toBeVisible();
    const amountInput = page.getByRole('textbox').first();

    // Validation check: 0 or empty should show error
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await amountInput.fill('75000');
    await page.getByRole('button', { name: 'Continue' }).click();

    // 3. Step 1: Fixed Bills with itemized items
    await expect(page.getByText('What goes out no matter what?')).toBeVisible();
    await page.getByRole('button', { name: 'Rent' }).click();
    const itemAmtInput = page.getByRole('textbox', { name: 'Item amount' });
    await itemAmtInput.fill('20000');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Rent')).toBeVisible();

    await page.getByRole('button', { name: 'Phone & Wi-Fi' }).click();
    await itemAmtInput.fill('2000');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Phone & Wi-Fi')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();

    // 4. Step 2: Savings with itemized items
    await expect(page.getByText('What do you put away first?')).toBeVisible();
    await page.getByRole('button', { name: 'SIP' }).click();
    await itemAmtInput.fill('15000');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('SIP')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();

    // 5. Step 3: Days until next salary
    await expect(page.getByText('How many days until your next salary?')).toBeVisible();
    await amountInput.fill('30');
    await page.getByRole('button', { name: 'See my plan' }).click();

    // 6. Plan summary check:
    // Income (75,000) - Bills (22,000) - Savings (15,000) = 38,000 to live on
    await expect(page.getByRole('heading', { name: 'Your plan for this month' })).toBeVisible();
    await expect(page.getByText('Your money to live on')).toBeVisible();
    await expect(page.getByText('38,000')).toBeVisible();

    // Start month
    await page.getByRole('button', { name: 'Start my month' }).click();

    // Verifies arrival on Today tab
    await expect(page.getByText('You can still spend today')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log a spend' })).toBeVisible();
  });

  test('explores directly with sample data from Welcome screen', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Or explore with sample data first' })).toBeVisible();
    await page.getByRole('button', { name: 'Or explore with sample data first' }).click();

    // Lands on Insights tab with sample month populated
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
    await expect(page.getByText('Spent this month so far')).toBeVisible();
  });
});
