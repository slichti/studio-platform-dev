import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import router from './classes.schedules';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from '../../test/integration/test-utils';

// Setup Mock DB globally so vi.mock can see it
let testDb: any;
vi.mock('../db', () => ({
    createDb: () => testDb
}));

// Mock UsageService to bypass quota checks
vi.mock('../services/pricing', () => ({
    UsageService: vi.fn().mockImplementation(() => ({
        checkLimit: async () => true
    }))
}));

describe('Course Management API', () => {
    let app: Hono;
    let sqlite: Database.Database;

    const tenantId = 'course_test_tenant';
    const slug = 'course-test-studio';
    const userId = 'admin_user';

    beforeEach(async () => {
        // Setup In-Memory SQLite DB
        sqlite = new Database(':memory:');

        // Mock D1 wrapper for better-sqlite3
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
            batch: async (statements: any[]) => {
                return statements.map(s => s.run());
            },
            exec: async (sql: string) => {
                sqlite.exec(sql);
            }
        };

        // Use the official setup utility
        await setupTestDb(d1Mock);

        // Now use drizzle-orm/better-sqlite3 for the app logic
        testDb = drizzle(sqlite, { schema });

        // Seed tenant
        sqlite.prepare(`INSERT INTO tenants (id, slug, name) VALUES (?, ?, ?)`).run(tenantId, slug, 'Course Test Studio');
        sqlite.prepare(`INSERT INTO users (id, email) VALUES (?, ?)`).run(userId, 'admin@example.com');
        sqlite.prepare(`INSERT INTO tenant_members (id, tenant_id, user_id, joined_at) VALUES (?, ?, ?, ?)`).run(userId, tenantId, userId, Date.now());

        app = new Hono();

        app.use('*', async (c, next) => {
            c.env = { DB: sqlite as any };
            c.set('tenant', { id: tenantId, slug: slug, tier: 'launch' });
            c.set('auth', { userId: userId });
            c.set('member', { id: userId });
            c.set('can', (p: string) => true); // Grant all permissions
            await next();
        });

        app.route('/classes', router);
    });

    it('should create a class with course fields', async () => {
        const startTime = new Date();
        startTime.setHours(startTime.getHours() + 24);

        const res = await app.request('/classes', {
            method: 'POST',
            headers: {
                'X-Tenant-Slug': slug,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: 'Premium Yoga Course',
                startTime: startTime.toISOString(),
                durationMinutes: 45,
                price: 50,
                isCourse: true,
                recordingPrice: 20
            })
        });

        const data = await res.json() as any;
        if (res.status !== 201) {
            console.error('Test Fail Details:', data);
        }

        expect(res.status).toBe(201);
        expect(data.isCourse).toBe(true);
        expect(data.recordingPrice).toBe(20);
    });

    it('should filter classes by isCourse', async () => {
        const startTime = new Date();

        // Create a regular class
        let res = await app.request('/classes', {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Regular Class',
                startTime: startTime.toISOString(),
                durationMinutes: 60,
                price: 15,
                isCourse: false
            })
        });
        expect(res.status).toBe(201);

        // Create a course
        res = await app.request('/classes', {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Premium Course',
                startTime: new Date(startTime.getTime() + 3600000).toISOString(),
                durationMinutes: 60,
                price: 100,
                isCourse: true
            })
        });
        expect(res.status).toBe(201);

        // Test filtering: isCourse=true
        const resTrue = await app.request(`/classes?isCourse=true`, {
            headers: { 'X-Tenant-Slug': slug }
        });
        expect(resTrue.status).toBe(200); // GET is 200
        const courses = await resTrue.json() as any[];
        expect(courses).toHaveLength(1);
        expect(courses[0].title).toBe('Premium Course');

        // Test filtering: isCourse=false
        const resFalse = await app.request(`/classes?isCourse=false`, {
            headers: { 'X-Tenant-Slug': slug }
        });
        expect(resFalse.status).toBe(200); // GET is 200
        const nonCourses = await resFalse.json() as any[];
        expect(nonCourses).toHaveLength(1);
        expect(nonCourses[0].title).toBe('Regular Class');
    });
});
