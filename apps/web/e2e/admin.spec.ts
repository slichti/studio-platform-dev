import { test, expect } from '@playwright/test';

test.describe('Studio Admin', () => {
    // Standard Owner ID from fixed seed
    const OWNER_ID = 'user_owner_fixed_id';
    const TENANT_SLUG = 'test-studio';

    test.use({
        extraHTTPHeaders: {
            'Cookie': `__e2e_bypass_user_id=${OWNER_ID}`
        }
    });

    test('should allow owner to access dashboard', async ({ page }) => {
        // Set cookie in browser context since Loader reads Cookie header from request
        await page.context().addCookies([
            { name: '__e2e_bypass_user_id', value: OWNER_ID, domain: 'localhost', path: '/' }
        ]);

        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err));

        await page.goto(`/studio/${TENANT_SLUG}`);
        console.log('Current URL:', page.url());

        // Wait for potential redirect
        await page.waitForLoadState('networkidle');
        console.log('URL after idle:', page.url());

        const text = await page.locator('body').innerText();
        console.log('PAGE TEXT DUMP:', text);

        // Should NOT be redirected to sign-in
        await expect(page).toHaveURL(new RegExp(`/studio/${TENANT_SLUG}`));

        // Should find "Dashboard" link in sidebar
        await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

        // Visual Regression Snapshot
        await expect(page).toHaveScreenshot('dashboard.png');
    });

    test('should load schedule page', async ({ page }) => {
        await page.context().addCookies([
            { name: '__e2e_bypass_user_id', value: OWNER_ID, domain: 'localhost', path: '/' }
        ]);

        await page.goto(`/studio/${TENANT_SLUG}/schedule`); // Correct URL is /schedule not /classes for the view causing "Add Class" maybe? 
        // /classes is "Classes" management?
        // Let's check sidebar: 
        // <NavItem to={`/studio/${slug}/schedule`} ...>Schedule</NavItem>
        // <NavItem to={`/studio/${slug}/classes`} ...>Classes</NavItem>

        // Let's try to verify Schedule page load
        await expect(page.getByText('Schedule').first()).toBeVisible();
        await expect(page).toHaveURL(/.*\/schedule/);
    });
});
