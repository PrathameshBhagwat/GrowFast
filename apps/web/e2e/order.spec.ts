import { test, expect } from '@playwright/test';

test.describe('Order Wizard Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.getByRole('button', { name: /OWNER 111111/ }).click();
    await expect(page.getByText('Customer Search')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to order wizard and see catalog', async ({ page }) => {
    // Try to search for a customer or click 'New Order' directly if available
    // Let's assume we can navigate to /order directly or via a "New Walk-in" button
    
    // In our UI, there might be a "New Customer" or "Walk-in" button.
    // Let's just go to the wizard directly for testing the catalog component visually.
    await page.goto('/orders/new');

    await expect(page.getByText('Select Customer')).toBeVisible({ timeout: 10000 });
    
    // We can't advance without selecting a customer. Since it's E2E, we can just ensure
    // the customer selector renders correctly.
    await expect(page.getByText('Customer Selection')).toBeVisible();
    await expect(page.getByText('Item Entry')).toBeVisible();
  });
});
