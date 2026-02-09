import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
    const OWNER_ID = 'user_owner_fixed_id';

    test('should guide a new owner through the studio creation and onboarding wizard', async ({ page }) => {
        // 1. Bypass auth
        await page.context().addCookies([
            { name: '__e2e_bypass_user_id', value: OWNER_ID, domain: 'localhost', path: '/' }
        ]);

        // 2. Start at Create Studio
        await page.goto('/create-studio');
        await expect(page.getByText(/create your studio/i)).toBeVisible();

        // 3. Fill Studio Name
        await page.fill('input[name="name"]', 'E2E Yoga');
        // Slug should auto-fill
        await expect(page.locator('input[name="slug"]')).toHaveValue('e2e-yoga');

        // 4. Submit Creation
        await page.click('button[type="submit"]');

        // 5. Verify Redirect to Onboarding Step 1 (Template)
        await expect(page).toHaveURL(/.*\/onboarding/);
        await expect(page.getByText(/choose your business type/i)).toBeVisible();

        // 6. Select Template (Yoga) and Next
        await page.click('text=Yoga / Pilates');
        await page.click('button:has-text("Next Step")');

        // 7. Step 2: Branding
        await expect(page.getByText(/set your brand/i)).toBeVisible();
        await page.click('button:has-text("Next Step")');

        // 8. Step 3: Location
        await expect(page.getByText(/create a location/i)).toBeVisible();
        await page.fill('input[name="name"]', 'Main Hall');
        await page.fill('input[name="address"]', '123 E2E Lane');
        await page.click('button:has-text("Next Step")');

        // 9. Step 4: Schedule
        await expect(page.getByText(/schedule first class/i)).toBeVisible();
        // Datetime-local is tricky to fill across browsers, we can use the default or select today
        await page.click('button:has-text("Next Step")');

        // 10. Step 5: Team (Skip)
        await expect(page.getByText(/migrate data|invite instructors/i)).toBeVisible();
        await page.click('button:has-text("Skip")');

        // 11. Step 6: Import (Skip)
        await expect(page.getByText(/migrate data/i)).toBeVisible();
        const skipImport = page.getByRole('button', { name: /skip/i });
        await skipImport.click();

        // 12. Final Step: Completion
        await expect(page.getByText(/you're all set/i)).toBeVisible();
        await expect(page.getByRole('link', { name: /go to dashboard/i })).toBeVisible();
    });
});
