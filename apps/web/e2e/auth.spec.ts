import { test, expect } from '@playwright/test';

test('auth page loads', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveTitle(/Sign In/);
});
