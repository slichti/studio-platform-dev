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
});
