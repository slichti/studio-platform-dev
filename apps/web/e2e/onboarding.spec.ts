import { test, expect } from '@playwright/test';

test.describe('Onboarding', () => {
    test('should prevent access to protected routes without auth', async ({ page }) => {
        await page.goto('/studio/test-studio/onboarding');
        // Should redirect to login
        await expect(page).toHaveURL(/.*sign-in/);
    });
});
