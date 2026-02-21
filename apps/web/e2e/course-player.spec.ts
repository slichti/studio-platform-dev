import { test, expect } from '@playwright/test';

test.describe('Course Player (Student Flow)', () => {

    test.beforeEach(async ({ page }) => {
        // Assume a student is logged in and enrolled
    });

    test('should allow student to view course outline', async ({ page }) => {
        // Navigate to the portal course view
        await page.goto('/portal/garden-yoga/courses/test-course');

        // Check for course title and progress tracking UI
        await expect(page.getByRole('heading')).toBeVisible();
        await expect(page.getByText(/Progress/i)).toBeVisible();
    });

    test('should load the course player curriculum item view', async ({ page }) => {
        // Navigate to a specific curriculum item
        await page.goto('/portal/garden-yoga/courses/test-course?itemId=test-item-1');

        // Check for the "Mark Complete" button
        await expect(page.getByRole('button', { name: /Mark Complete/i })).toBeVisible();
    });
});
