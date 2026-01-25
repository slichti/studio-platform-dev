import { test, expect } from '@playwright/test';

test.describe('RBAC & Permissions', () => {
    const STUDENT_ID = 'user_student_fixed_id';
    const INSTRUCTOR_ID = 'user_instructor_fixed_id';
    const TENANT_SLUG = 'test-studio';

    test('should redirect student from restricted admin page', async ({ page }) => {
        // Authenticate as Student
        await page.context().addCookies([
            { name: '__e2e_bypass_user_id', value: STUDENT_ID, domain: 'localhost', path: '/' }
        ]);

        // Try to access settings (Restricted to Owner/Admin)
        await page.goto(`/studio/${TENANT_SLUG}/settings`);

        // Should be redirected to Portal
        await expect(page).toHaveURL(new RegExp(`/portal/${TENANT_SLUG}`));
    });

    test('should redirect student from schedule to portal', async ({ page }) => {
        // Authenticate as Student
        await page.context().addCookies([
            { name: '__e2e_bypass_user_id', value: STUDENT_ID, domain: 'localhost', path: '/' }
        ]);

        // Access Schedule (Redirects to Portal for Students)
        await page.goto(`/studio/${TENANT_SLUG}/schedule`);

        // Should be redirected to Portal
        await expect(page).toHaveURL(new RegExp(`/portal/${TENANT_SLUG}`));
    });

    test('should allow instructor to access classes management', async ({ page }) => {
        // Authenticate as Instructor
        await page.context().addCookies([
            { name: '__e2e_bypass_user_id', value: INSTRUCTOR_ID, domain: 'localhost', path: '/' }
        ]);

        await page.goto(`/studio/${TENANT_SLUG}/classes`);

        // Should allow access (Instructor role has access)
        await expect(page).toHaveURL(new RegExp(`/studio/${TENANT_SLUG}/classes`));
        await expect(page.getByText('Class Schedule')).toBeVisible();
        // Instructors should see Create Class button
        await expect(page.getByText('Create Class')).toBeVisible();
    });
});
