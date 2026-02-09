import { test, expect } from '@playwright/test';

test.describe('Reports & Analytics', () => {
    const OWNER_ID = 'user_owner_fixed_id';
    const TENANT_SLUG = 'test-studio';

    test.use({
        extraHTTPHeaders: {
            'Cookie': `__e2e_bypass_user_id=${OWNER_ID}`
        }
    });

    test('should allow admin to view analytics dashboard and charts', async ({ page }) => {
        await page.context().addCookies([
            { name: '__e2e_bypass_user_id', value: OWNER_ID, domain: 'localhost', path: '/' }
        ]);

        await page.goto(`/studio/${TENANT_SLUG}/analytics/financials`);

        // Wait for charts to render
        await expect(page.getByText(/financials|revenue/i)).toBeVisible();

        // Check for chart elements (Recharts often uses SVG)
        const svgChart = page.locator('svg.recharts-surface');
        await expect(svgChart).toBeVisible({ timeout: 15000 });
    });
});
