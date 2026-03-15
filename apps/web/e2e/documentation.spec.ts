import { test, expect } from '@playwright/test';

test.describe('Internal Documentation', () => {
    test('documentation redirects to sign-in when not logged in', async ({ page }) => {
        await page.goto('/documentation');
        await expect(page).toHaveURL(/.*sign-in.*/);
    });

    test('documentation platform architecture route redirects to sign-in when not logged in', async ({ page }) => {
        await page.goto('/documentation/platform/architecture');
        await expect(page).toHaveURL(/.*sign-in.*/);
    });

    test('documentation platform clerk route redirects to sign-in when not logged in', async ({ page }) => {
        await page.goto('/documentation/platform/clerk');
        await expect(page).toHaveURL(/.*sign-in.*/);
    });

    test('documentation and platform architecture load when authenticated (E2E bypass)', async ({ page }) => {
        await page.context().addCookies([
            { name: '__e2e_bypass_user_id', value: 'user_owner_fixed_id', domain: 'localhost', path: '/' },
        ]);
        await page.goto('/documentation');
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/documentation/);
        await expect(page.getByRole('link', { name: /documentation|platform|architecture/i }).first()).toBeVisible({ timeout: 10000 });

        await page.goto('/documentation/platform/architecture');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/request flow|architecture|overview/i).first()).toBeVisible({ timeout: 10000 });
    });
});
