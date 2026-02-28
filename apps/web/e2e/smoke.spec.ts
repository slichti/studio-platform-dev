import { test, expect } from '@playwright/test';

test.describe('Platform Smoke Tests', () => {
    test('landing page loads', async ({ page }) => {
        // Go to the base URL (platform landing page)
        await page.goto('/');

        // Check for a known element or title on the landing page
        // Assuming the title contains "Studio" or similar. adjusting based on likely content
        await expect(page).toHaveTitle(/Studio|Platform|Home/i);
    });

    test('tenant subdomain resolves correctly', async ({ page }) => {
        // Navigate to a tenant subdomain
        // We'll use the "garden-yoga" tenant we saw in previous steps
        // Note: In a real environment, we'd need to ensure this tenant exists or use a seeded one.
        // For this smoke test, we assume the dev environment has this data or we mock it if possible,
        // but Playwright hitting a real dev server traverses the real network/stacks.
        // If running against localhost, we might need to rely on the "preview" or "staging" logic,
        // but the `subdomain.server.ts` logic we tested handles the routing.

        const tenantUrl = 'https://garden-yoga.studio-platform-dev.slichti.org';

        // We will use the full URL here because the baseURL in config might be the main platform
        // and subdomains are different origins in some configs, but let's try.
        // However, if we are testing against localhost, subdomains are tricky without /etc/hosts entries.
        // The previous browser_subagent test used `https://studio-platform-web.pages.dev` and `https://garden-yoga.studio-platform-dev.slichti.org`
        // Let's assume the test runner has access to these or we skip if unreachable.

        // For robustness in this specific dev environment where we might not have full DNS control locally:
        // We can test that the routing logic *would* work or test a simulated path if supported.
        // But since the user wants E2E, let's try the real deployed preview URL pattern or a known reachable one.
        // The user's previous successful browser test verified `garden-yoga.studio-platform-dev.slichti.org`.

        await page.goto(tenantUrl);

        // Expect the tenant name to be present
        await expect(page.getByText('Garden Yoga')).toBeVisible();
    });

    test('admin pages are protected', async ({ page }) => {
        await page.goto('/admin');
        // Should redirect to login or show unauthorized
        await expect(page).toHaveURL(/.*sign-in.*/);
    });

    test('sign-in page loads', async ({ page }) => {
        await page.goto('/sign-in');
        await expect(page).toHaveURL(/.*sign-in/);
    });

    test('sign-up page loads', async ({ page }) => {
        await page.goto('/sign-up');
        await expect(page).toHaveURL(/.*sign-up/);
    });

    test('documentation redirects to sign-in when not authenticated', async ({ page }) => {
        await page.goto('/documentation');
        await expect(page).toHaveURL(/.*sign-in.*/);
    });
});
