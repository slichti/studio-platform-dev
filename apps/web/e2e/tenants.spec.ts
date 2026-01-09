import { test, expect } from '@playwright/test';

// Use environment variables for credentials
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'password';

test.describe('Tenant Management', () => {
    // Login before tests (or reuse state)
    test.beforeEach(async ({ page }) => {
        // Basic login flow - adjust based on actual Clerk login UI
        await page.goto('/sign-in');

        // Check if already logged in (if reusing state)
        const isLoginPage = await page.getByText('Sign in to your account').isVisible();
        if (isLoginPage) {
            await page.getByLabel('Email address').fill(ADMIN_EMAIL);
            await page.getByRole('button', { name: 'Continue' }).click();
            await page.getByLabel('Password').fill(ADMIN_PASSWORD);
            await page.getByRole('button', { name: 'Sign in' }).click();

            // Wait for dashboard
            await expect(page).toHaveURL(/\/admin/);
        }
    });

    test('should spin up a new tenant', async ({ page }) => {
        // 1. Navigate to Tenants page
        await page.goto('/admin/tenants');
        await expect(page.getByText('Tenant Management')).toBeVisible();

        // 2. Open Modal
        await page.getByRole('button', { name: 'Spin Up Tenant' }).click();
        await expect(page.getByText('Spin Up New Tenant')).toBeVisible();

        // 3. Fill Form
        const uniqueSlug = `test-studio-${Date.now()}`;
        await page.getByPlaceholder('e.g. Zen Garden Yoga').fill('Test Studio E2E');
        // Slug might auto-fill, but let's force it to be unique
        await page.locator('input[placeholder="zen-garden"]').fill(uniqueSlug);

        // Select Plan
        await page.locator('select').selectOption('growth'); // "Growth"

        // 4. Submit
        await page.getByRole('button', { name: 'Launch Studio' }).click();

        // 5. Verify Success
        // Wait for modal to close and toast/dialog to appear
        await expect(page.getByText(`Tenant Test Studio E2E (${uniqueSlug}) has been provisioned successfully.`)).toBeVisible();

        // 6. Verify in List
        await page.reload();
        await expect(page.getByText(uniqueSlug)).toBeVisible();
    });
});
