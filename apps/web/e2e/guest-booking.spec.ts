import { test, expect } from '@playwright/test';

test.describe('Booking Flow (Guest Embed)', () => {
    test('should show schedule on public widget', async ({ page }) => {
        // Mock the Schedule API to avoid dependency on running backend
        await page.route('**/guest/schedule/**', async route => {
            const json = {
                classes: [
                    {
                        id: 'class_mock_1',
                        title: 'Mock Vinyasa Flow',
                        startTime: new Date().toISOString(),
                        durationMinutes: 60,
                        instructor: { user: { name: 'Yogi Bear' } },
                        tenantId: 'test-studio',
                        capacity: 10,
                        bookedCount: 0
                    }
                ]
            };
            await route.fulfill({ json });
        });

        // Use the public embed URL
        await page.goto('/embed/test-studio/book');

        // Wait for hydration and fetch
        await page.waitForLoadState('networkidle');

        // Check for mocked content
        await expect(page.getByText('Mock Vinyasa Flow')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Yogi Bear')).toBeVisible();

        // Ensure "Book" button is present
        await expect(page.getByRole('button', { name: 'Book' }).first()).toBeVisible();
    });

    test('should open guest booking modal', async ({ page }) => {
        // Mock Schedule
        await page.route('**/guest/schedule/**', async route => {
            const json = {
                classes: [
                    {
                        id: 'class_mock_2',
                        title: 'Mock Power Yoga',
                        startTime: new Date().toISOString(),
                        durationMinutes: 45,
                        instructor: { user: { name: 'Fitness Fan' } },
                        tenantId: 'test-studio',
                        capacity: 10,
                        bookedCount: 0
                    }
                ]
            };
            await route.fulfill({ json });
        });

        await page.goto('/embed/test-studio/book');
        await page.waitForLoadState('networkidle');

        // Click the first book button
        await page.getByRole('button', { name: 'Book' }).first().click();

        // Expect Modal to appear
        await expect(page.getByText('Complete Booking')).toBeVisible();
        await expect(page.getByText('Full Name')).toBeVisible();
    });
});
