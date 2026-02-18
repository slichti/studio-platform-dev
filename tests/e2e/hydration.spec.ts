
import { test, expect } from '@playwright/test';

test.describe('Hydration Guard', () => {
    const hydrationErrors: string[] = [];

    test.beforeEach(({ page }) => {
        // Clear errors before each test
        hydrationErrors.length = 0;

        // Listen for console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Capture React hydration errors (Error #418, #423, etc.)
                if (text.includes('Hydration') || text.includes('minified-react.js/error/418')) {
                    console.log('Detected Hydration Error:', text);
                    hydrationErrors.push(text);
                }
            }
        });

        // Also catch uncaught exceptions which might be hydration related
        page.on('pageerror', error => {
            if (error.message.includes('Hydration')) {
                hydrationErrors.push(error.message);
            }
        });
    });

    test('homepage should have no hydration errors', async ({ page }) => {
        await page.goto('/');

        // Wait for potential hydration to finish
        await page.waitForTimeout(1000);

        expect(hydrationErrors, `Found hydration errors: ${JSON.stringify(hydrationErrors)}`).toHaveLength(0);
    });

    test('admin tenants page should have no hydration errors', async ({ page }) => {
        // Note: This might require auth if not handled by global setup
        // For a smoke test, we check if the shell loads without hydration artifacts
        await page.goto('/admin/tenants');

        await page.waitForTimeout(1000);

        expect(hydrationErrors, `Found hydration errors: ${JSON.stringify(hydrationErrors)}`).toHaveLength(0);
    });
});
