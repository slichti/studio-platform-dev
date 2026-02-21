import { describe, expect, it, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { setupTestDb } from './test-utils';
import * as schema from '@studio/db/src/schema';

describe('Courses Integration - LMS Features', () => {
    let tenantId = 'integration-studio';
    let adminUserId = 'admin-user';
    let studentId = 'student-user';
    let db: any;

    beforeAll(async () => {
        // Setup database
        db = await setupTestDb(env.DB as any);

        // Seed Tenant
        await db.insert(schema.tenants).values({
            id: tenantId,
            name: 'Test Studio',
            slug: 'integration-studio',
            status: 'active'
        }).run();

        // Seed Admin User & Member & Role
        await db.insert(schema.users).values({
            id: adminUserId,
            email: 'admin@test.com',
            role: 'user'
        }).run();
        await db.insert(schema.tenantMembers).values({
            id: 'admin_member_id', tenantId, userId: adminUserId, status: 'active'
        }).run();
        await db.insert(schema.tenantRoles).values({
            id: 'owner_role', memberId: 'admin_member_id', role: 'owner'
        }).run();

        // Seed Student User & Member
        await db.insert(schema.users).values({
            id: studentId,
            email: 'student@test.com',
            role: 'user'
        }).run();
        await db.insert(schema.tenantMembers).values({
            id: 'student_member_id', tenantId, userId: studentId, status: 'active'
        }).run();
    });

    it('should operate a full LMS course lifecycle', async () => {
        // 1. Create course
        let res = await SELF.fetch('https://api.studio.local/courses', {
            method: 'POST',
            headers: { 'TEST-AUTH': adminUserId, 'X-Tenant-Slug': 'integration-studio', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Integration Test Course',
                description: 'A test course',
                status: 'active',
                isPublic: true,
                deliveryMode: 'self_paced'
            })
        });

        expect(res.status).toBe(201);
        const course = await res.json() as any;
        const courseId = course.id;

        // 2. Add an Article
        res = await SELF.fetch('https://api.studio.local/courses/articles', {
            method: 'POST',
            headers: { 'TEST-AUTH': adminUserId, 'X-Tenant-Slug': 'integration-studio', 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Test Article', html: '<p>Content</p>' })
        });
        expect(res.status).toBe(201);
        const articleId = (await res.json() as any).id;

        // 3. Add Article to Curriculum
        res = await SELF.fetch(`https://api.studio.local/courses/${courseId}/curriculum`, {
            method: 'POST',
            headers: { 'TEST-AUTH': adminUserId, 'X-Tenant-Slug': 'integration-studio', 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentType: 'article', articleId, order: 1 })
        });
        expect(res.status).toBe(201);
        const curriculumItemArticle = await res.json() as any;

        // 4. Add an Assignment
        res = await SELF.fetch('https://api.studio.local/courses/assignments', {
            method: 'POST',
            headers: { 'TEST-AUTH': adminUserId, 'X-Tenant-Slug': 'integration-studio', 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Test Assignment', description: 'Do the test' })
        });
        expect(res.status).toBe(201);
        const assignmentId = (await res.json() as any).id;

        res = await SELF.fetch(`https://api.studio.local/courses/${courseId}/curriculum`, {
            method: 'POST',
            headers: { 'TEST-AUTH': adminUserId, 'X-Tenant-Slug': 'integration-studio', 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentType: 'assignment', assignmentId, order: 2 })
        });
        expect(res.status).toBe(201);

        // 5. Fetch course as student to see curriculum
        res = await SELF.fetch(`https://api.studio.local/courses/${courseId}`, {
            headers: { 'TEST-AUTH': studentId, 'X-Tenant-Slug': 'integration-studio' }
        });
        expect(res.status).toBe(200);
        let studentCourseData = await res.json() as any;
        expect(studentCourseData.curriculum.length).toBe(2);

        // 6. Submit Assignment
        res = await SELF.fetch(`https://api.studio.local/courses/assignments/${assignmentId}/submit`, {
            method: 'POST',
            headers: { 'TEST-AUTH': studentId, 'X-Tenant-Slug': 'integration-studio', 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'My homework submission text' })
        });
        expect(res.status).toBe(201);
        expect((await res.json() as any).status).toBe('submitted');

        // 7. Post a Comment on the Article
        res = await SELF.fetch(`https://api.studio.local/courses/comments`, {
            method: 'POST',
            headers: { 'TEST-AUTH': studentId, 'X-Tenant-Slug': 'integration-studio', 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, collectionItemId: curriculumItemArticle.id, content: 'Great article!' })
        });
        expect(res.status).toBe(201);

        // Fetch comments to verify
        res = await SELF.fetch(`https://api.studio.local/courses/comments/${curriculumItemArticle.id}`, {
            headers: { 'TEST-AUTH': studentId, 'X-Tenant-Slug': 'integration-studio' }
        });
        expect(res.status).toBe(200);
        const comments = await res.json() as any[];
        expect(comments.length).toBe(1);
        expect(comments[0].content).toBe('Great article!');
    });
});
