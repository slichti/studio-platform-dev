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

    test('should allow access to authenticated user (bypass)', async ({ context }) => {
        // Set bypass cookie
        await context.addCookies([{
            name: '__e2e_bypass_user_id',
            value: 'user_student_fixed_id',
            domain: 'localhost',
            path: '/'
        }]);

        const page = await context.newPage();
        await page.goto('/portal/test-studio');

        // Should NOT redirect to sign-in
        await expect(page).not.toHaveURL(/.*sign-in/);

        // Should show dashboard content
        await expect(page.getByText('Welcome back, Sam!')).toBeVisible();
    });
});
