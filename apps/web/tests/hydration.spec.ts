import { test, expect } from '@playwright/test';

test('should have no hydration errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('Hydration failed')) {
            errors.push(msg.text());
        }
    });

    await page.goto('/');

    // Wait for React to hydrate and any initial effects to run
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
});
