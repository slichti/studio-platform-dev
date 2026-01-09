import { test, expect } from '@playwright/test';

test('unauthenticated user redirected to sign-in', async ({ page }) => {
    // Attempt to access the protected diagnostics page
    await page.goto('/admin/diagnostics');

    // Should be redirected to sign-in
    // Note: The specific URL might depend on Clerk configuration, but typically it redirects to a sign-in page
    // or the URL contains 'sign-in'
    await expect(page.url()).toContain('sign-in');
    await expect(page).toHaveTitle(/Sign In/);
});
