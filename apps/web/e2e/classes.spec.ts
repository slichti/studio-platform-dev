import { test, expect } from '@playwright/test';

test.describe('Class Management', () => {
    const OWNER_ID = 'user_owner_fixed_id';
    const TENANT_SLUG = 'test-studio';

    test.use({
        extraHTTPHeaders: {
            'Cookie': `__e2e_bypass_user_id=${OWNER_ID}`
        }
    });

    test('should allow owner to create a new class', async ({ page }) => {
        // Set cookie for client-side bypass if needed (mostly for root loader check, though we have real keys now)
        await page.context().addCookies([
            { name: '__e2e_bypass_user_id', value: OWNER_ID, domain: 'localhost', path: '/' }
        ]);

        await page.goto(`/studio/${TENANT_SLUG}/classes`);

        // Wait for page to be ready
        await page.waitForLoadState('networkidle');

        // Open Modal
        await page.getByText('Create Class').click({ force: true });

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible({ timeout: 10000 });
        await expect(modal.getByRole('heading', { name: 'Schedule Class' })).toBeVisible();

        // Fill Form
        const className = `E2E Test Class ${Date.now()}`;
        await page.getByLabel('Class Name').fill(className);

        // Select Instructor (first one usually)
        await page.getByLabel('Instructor').selectOption({ index: 1 }); // Index 0 is placeholder

        // Set Time
        // Set to tomorrow 10am
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        // Format for datetime-local: YYYY-MM-DDTHH:mm
        const timeStr = tomorrow.toISOString().slice(0, 16);
        await page.getByLabel('Start Time').fill(timeStr);

        await page.getByLabel('Duration (min)').fill('60');
        await page.getByLabel('Capacity').fill('15');
        await page.getByLabel('Price ($)').fill('20');

        // Submit
        await page.getByRole('button', { name: 'Schedule Class' }).click();

        // Verify Success
        // Modal should close
        await expect(page.getByText('Schedule Class', { exact: true })).toBeHidden();

        // Class should appear in list
        // Note: The list is grouped by Date. We need to find the text.
        await expect(page.getByText(className)).toBeVisible();
    });
});
