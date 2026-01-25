import { test, expect } from '@playwright/test';

test.describe('Challenges & Engagement', () => {
    test('should load leaderboard on public page (or redirect)', async ({ page }) => {
        // Challenges might be protected or visible.
        // Assuming /studio/test-studio/challenges structure
        await page.goto('/studio/test-studio/challenges');

        // If protected, should redirect
        const isRedirected = await page.url().includes('sign-in');

        if (isRedirected) {
            await expect(page).toHaveURL(/.*sign-in/);
        } else {
            // If public, assert title
            await expect(page.getByText('Leaderboard')).toBeVisible();
        }
    });
});
