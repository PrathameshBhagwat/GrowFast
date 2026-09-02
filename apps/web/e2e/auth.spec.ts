import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should shake on invalid PIN and lockout after 5 attempts', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('GrowFast Laundry')).toBeVisible();

    
    for (let i = 0; i < 5; i++) {
      const responsePromise = page.waitForResponse(response => 
        response.url().includes('/auth/login')
      );

      for (let j = 0; j < 6; j++) {
        await page.getByRole('button', { name: '9', exact: true }).click();
      }
      
      await page.getByRole('button', { name: 'Unlock' }).click();
      
      await responsePromise;

      if (i < 4) {
        await expect(page.getByText(new RegExp(`Attempt ${i + 1}/5`))).toBeVisible();
      }
    }

    await expect(page.getByText('Too many failed attempts')).toBeVisible();
  });

  test('should login successfully with correct PIN', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /OWNER 111111/ }).click();
    await expect(page.getByText('Customer Search')).toBeVisible({ timeout: 10000 });
  });
});
