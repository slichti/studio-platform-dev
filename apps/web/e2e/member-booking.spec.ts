import { test, expect } from '@playwright/test';

test.describe('Member Booking Flow', () => {
    const MEMBER_ID = 'user_member_fixed_id'; // Constant for E2E member
    const TENANT_SLUG = 'test-studio';

    test.use({
        extraHTTPHeaders: {
            'Cookie': `__e2e_bypass_user_id=${MEMBER_ID}`
        }
    });

    test('should allow a member to book a class from the portal', async ({ page }) => {
        // Set cookie for bypass
        await page.context().addCookies([
            { name: '__e2e_bypass_user_id', value: MEMBER_ID, domain: 'localhost', path: '/' }
        ]);

        // Navigate to the portal classes - SSR will hit the mock API on 8787
        await page.goto(`/portal/${TENANT_SLUG}/classes`, { waitUntil: 'networkidle' });

        // Verify the mocked class is visible
        const classTitle = 'Member Yoga Flow';
        await expect(page.getByText(classTitle)).toBeVisible({ timeout: 15000 });

        // Click the Book Class button
        const bookButton = page.getByRole('button', { name: /book class/i }).first();
        await expect(bookButton).toBeVisible();
        await bookButton.click();

        // Verify that the UI updates to "Booked" state
        // This relies on the action refetching the loader, which our dynamic mock API handles
        await expect(page.getByText(/booked/i)).toBeVisible({ timeout: 15000 });
    });
});
