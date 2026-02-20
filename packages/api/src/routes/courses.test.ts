import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import router from './courses';
import classRouter from './classes.schedules';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from '../../test/integration/test-utils';
import { StudioVariables, Bindings } from '../types';

// Setup Mock DB globally
let testDb: any;
vi.mock('../db', () => ({
    createDb: () => testDb
}));

describe('Standalone Course Management API', () => {
    let app: Hono<{ Variables: StudioVariables; Bindings: Bindings }>;
    let sqlite: Database.Database;

    const tenantId = 'course_test_tenant';
    const slug = 'course-test-studio';
    const userId = 'admin_user';

    beforeEach(async () => {
        sqlite = new Database(':memory:');
        const d1Mock: any = {
            prepare: (sql: string) => ({
                bind: (...args: any[]) => ({
                    run: async () => sqlite.prepare(sql).run(...args),
                    all: async () => sqlite.prepare(sql).all(...args),
                    get: async () => sqlite.prepare(sql).get(...args)
                }),
                run: async () => sqlite.prepare(sql).run(),
                all: async () => sqlite.prepare(sql).all(),
                get: async () => sqlite.prepare(sql).get()
            }),
            batch: async (statements: any[]) => statements.map(s => s.run()),
            exec: async (sql: string) => { sqlite.exec(sql); }
        };

        await setupTestDb(d1Mock);
        testDb = drizzle(sqlite, { schema });

        // Seed
        sqlite.prepare(`INSERT INTO tenants (id, slug, name) VALUES (?, ?, ?)`).run(tenantId, slug, 'Course Test Studio');
        sqlite.prepare(`INSERT INTO users (id, email) VALUES (?, ?)`).run(userId, 'admin@example.com');
        sqlite.prepare(`INSERT INTO tenant_members (id, tenant_id, user_id, joined_at) VALUES (?, ?, ?, ?)`).run(userId, tenantId, userId, Date.now());

        app = new Hono<{ Variables: StudioVariables; Bindings: Bindings }>();
        app.use('*', async (c, next) => {
            c.env = { DB: sqlite as any } as Bindings;
            c.set('tenant', { id: tenantId, slug: slug } as any);
            c.set('member', { userId: userId, id: userId } as any);
            await next();
        });

        app.route('/courses', router);
        app.route('/classes', classRouter);
    });

    it('should create a standalone course', async () => {
        const res = await app.request('/courses', {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Full Stack Web Dev',
                price: 9900,
                isPublic: true,
                status: 'active'
            })
        });

        const data = await res.json() as any;
        expect(res.status).toBe(201);
        expect(data.title).toBe('Full Stack Web Dev');
        expect(data.price).toBe(9900);
    });

    it('should link a class to a course', async () => {
        // 1. Create course
        const courseRes = await app.request('/courses', {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'React Masterclass', price: 5000 })
        });
        const course = await courseRes.json() as any;

        // 2. Create class linked to course
        const startTime = new Date();
        startTime.setHours(startTime.getHours() + 24);

        const classRes = await app.request('/classes', {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Session 1: Components',
                startTime: startTime.toISOString(),
                durationMinutes: 60,
                price: 0,
                courseId: course.id
            })
        });

        const session = await classRes.json() as any;
        expect(classRes.status).toBe(201);
        expect(session.courseId).toBe(course.id);

        // 3. Verify course details includes the session
        const detailRes = await app.request(`/courses/${course.id}`, {
            headers: { 'X-Tenant-Slug': slug }
        });
        const details = await detailRes.json() as any;
        expect(details.sessions).toHaveLength(1);
        expect(details.sessions[0].title).toBe('Session 1: Components');
    });

    it('should enroll a user and update progress', async () => {
        const courseRes = await app.request('/courses', {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Enrollment Test', price: 0 })
        });
        const course = await courseRes.json() as any;

        // Enroll
        const enrollRes = await app.request(`/courses/${course.id}/enroll`, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug }
        });
        expect(enrollRes.status).toBe(200);

        // Update progress
        const progressRes = await app.request(`/courses/${course.id}/progress`, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug, 'Content-Type': 'application/json' },
            body: JSON.stringify({ progress: 50 })
        });
        expect(progressRes.status).toBe(200);

        // Verify in DB directly or via detail if implemented
        const enrollment = sqlite.prepare(`SELECT * FROM course_enrollments WHERE course_id = ? AND user_id = ?`).get(course.id, userId) as any;
        expect(enrollment.progress).toBe(50);
        expect(enrollment.status).toBe('active');
    });
});
