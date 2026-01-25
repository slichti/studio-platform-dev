import { test, expect } from '@playwright/test';

test.describe('Student Portal', () => {
    test.beforeEach(async ({ page }) => {
        // We know 'student0@test-studio.com' exists from the seed
        // But we can't login easily.
        // So we will test the redirection logic for unauthenticated users
    });

    test('should redirect unauthenticated user to login', async ({ page }) => {
        await page.goto('/portal/test-studio');
        await expect(page).toHaveURL(/.*sign-in/);
    });

    // TODO: Add authenticated tests once we have a bypass mechanism
});
