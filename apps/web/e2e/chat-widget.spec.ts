import { test, expect } from '@playwright/test';

test.describe('Chat widget (public site)', () => {
    test('public site page with chat enabled shows chat UI', async ({ page }) => {
        await page.route('**/guest/schedule/**', async (route) => {
            await route.fulfill({ json: { classes: [] } });
        });
        await page.route('**/api/**', async (route) => {
            if (route.request().url().includes('tenant') || route.request().url().includes('page')) {
                await route.fulfill({
                    json: {
                        id: 'p1',
                        slug: 'about',
                        content: { root: { props: {}, children: [] }, zones: {} },
                        tenantSettings: { chatEnabled: true },
                    },
                }).catch(() => route.continue());
            } else {
                await route.continue();
            }
        });

        await page.goto('/site/test-studio/about');
        await page.waitForLoadState('networkidle');

        const fab = page.locator('.fixed.bottom-6.right-6 button').first();
        await expect(fab).toBeVisible({ timeout: 10000 });
    });

    test('opening chat panel shows connecting or input', async ({ page }) => {
        await page.route('**/guest/schedule/**', async (route) => {
            await route.fulfill({ json: { classes: [] } });
        });
        await page.route('**/api/**', async (route) => {
            await route.fulfill({
                json: {
                    id: 'p1',
                    slug: 'about',
                    content: { root: { props: {}, children: [] }, zones: {} },
                    tenantSettings: { chatEnabled: true },
                },
            }).catch(() => route.continue());
        });

        await page.goto('/site/test-studio/about');
        await page.waitForLoadState('networkidle');

        const fab = page.locator('.fixed.bottom-6.right-6 button').first();
        await fab.click();

        await expect(
            page.getByText(/connecting|write message|chat with us/i).first()
        ).toBeVisible({ timeout: 8000 });
    });
});
