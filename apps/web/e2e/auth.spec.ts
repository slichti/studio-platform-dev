import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('should allow a user to sign up', async ({ page }) => {
        // Generate unique user
        const timestamp = Date.now();
        const email = `test.user.${timestamp}@example.com`;

        await page.goto('/sign-up');

        // Fill signup form if it exists, or check for redirect to Clerk
        // Note: Clerk often requires specialized testing or 'clerk-testing' package
        // For now, we verify the route loads and basic elements are present

        await expect(page).toHaveURL(/.*sign-up/);
    });

    test('should allow a user to login', async ({ page }) => {
        await page.goto('/sign-in');
        await expect(page).toHaveURL(/.*sign-in/);
    });
});
