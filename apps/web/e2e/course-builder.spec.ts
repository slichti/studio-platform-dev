import { test, expect } from '@playwright/test';

test.describe('Course Builder (Instructor Flow)', () => {

    test.beforeEach(async ({ page }) => {
        // Assume instructor is logged in and is in the admin dashboard
        // We will mock this or rely on global setup in a real environment
        // For now, testing the UI elements exist on the route
    });

    test('should allow navigating to the course list', async ({ page }) => {
        // 1. Go to the tenant's admin courses page
        await page.goto('/admin/courses');

        // Verify the page title or headers
        await expect(page.getByRole('heading', { name: /Courses/i })).toBeVisible();

        // Verify the Create Course button is visible
        await expect(page.getByRole('button', { name: /Create Course/i })).toBeVisible();
    });

    test('should load the course builder UI', async ({ page }) => {
        // Navigate directly to a mock course builder URL (assuming a seeded course 'test-course')
        await page.goto('/admin/courses/test-course/build');

        // Check for curriculum elements
        await expect(page.getByText(/Curriculum/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /Add Item/i })).toBeVisible();
    });
});
