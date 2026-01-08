import { test, expect } from '@playwright/test';

test.describe('Critical Paths', () => {

    test('Public Landing Page loads', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Studio Platform/i);
        await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    });

    test('Login Page loads', async ({ page }) => {
        await page.goto('/sign-in');

        // Use a more specific selector to avoid ambiguity
        // Clerk usually has a heading level 1
        await expect(page.getByRole('heading', { name: /Sign in/i }).first()).toBeVisible();
    });

    test('Pricing Page loads', async ({ page }) => {
        await page.goto('/pricing');
        // Update based on actual content. Assuming 'Simple, transparent pricing' or similar based on file view.
        // Or just check for the main pricing header or specific plan names.
        // Let's use a generic visible check for now, or the specific header found in file.
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByText(/pricing/i).first()).toBeVisible();
    });

});
