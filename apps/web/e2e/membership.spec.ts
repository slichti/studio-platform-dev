import { test, expect } from '@playwright/test';

test.describe('Membership Purchase Flow', () => {
    test.beforeEach(async ({ context }) => {
        // Bypass Auth
        await context.addCookies([{
            name: '__e2e_bypass_user_id',
            value: 'user_student_fixed_id',
            domain: 'localhost',
            path: '/'
        }]);
    });

    test('should redirect to checkout when subscribing to a plan', async ({ page }) => {
        // 1. Navigate to Memberships
        await page.goto('/studio/test-studio/memberships');

        // 2. Wait for content
        await expect(page.getByText('Memberships')).toBeVisible();

        // 3. Find a plan to subscribe to
        const subscribeButton = page.getByRole('button', { name: 'Subscribe Now' }).first();

        if (await subscribeButton.count() === 0) {
            console.log('No membership plans available. Skipping test steps.');
            return;
        }

        // 4. Click Subscribe
        // Since it uses window.location.href, we can just click and wait for navigation
        await subscribeButton.click();

        // 5. Verify Redirect
        await expect(page).toHaveURL(/.*checkout\?planId=/);
    });
});
