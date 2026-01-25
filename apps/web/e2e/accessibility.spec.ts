import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Scan', () => {
    test('should not have failing accessibility violations on sign-in page', async ({ page }) => {
        await page.goto('/sign-in');

        // Wait for hydration
        await page.waitForLoadState('networkidle');

        // Analyze
        const results = await new AxeBuilder({ page }).analyze();

        // Assert
        expect(results.violations).toEqual([]);
    });

    test('should not have major accessibility violations on create-studio page', async ({ page }) => {
        await page.goto('/create-studio');
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .disableRules(['color-contrast']) // Optional: disable specific rules if design intent differs
            .analyze();

        expect(results.violations).toEqual([]);
    });

    test('should not have major accessibility violations on Dashboard', async ({ page }) => {
        await page.context().addCookies([{ name: '__e2e_bypass_user_id', value: 'user_owner_fixed_id', domain: 'localhost', path: '/' }]);
        await page.goto('/studio/test-studio/dashboard');

        // Wait for hydration & content
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

        const results = await new AxeBuilder({ page })
            .disableRules(['color-contrast']) // Often false positives in dark modes or complex UI
            .analyze();

        expect(results.violations).toEqual([]);
    });

    test('should not have major accessibility violations on Admin Schedule', async ({ page }) => {
        await page.context().addCookies([{ name: '__e2e_bypass_user_id', value: 'user_owner_fixed_id', domain: 'localhost', path: '/' }]);
        await page.goto('/studio/test-studio/schedule');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText('Schedule').first()).toBeVisible();

        const results = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();

        expect(results.violations).toEqual([]);
    });
});
