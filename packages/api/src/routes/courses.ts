import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { courses, courseEnrollments, classes, videoCollectionItems } from '@studio/db/src/schema';
import { eq, and, desc } from 'drizzle-orm';

const app = createOpenAPIApp<StudioVariables>();

// --- Schemas ---

const CourseSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    slug: z.string(),
    thumbnailUrl: z.string().nullable().optional(),
    price: z.number(),
    memberPrice: z.number().nullable().optional(),
    status: z.enum(['draft', 'active', 'archived']),
    isPublic: z.boolean(),
    contentCollectionId: z.string().nullable().optional(),
    createdAt: z.date().or(z.string()).or(z.number()).nullable().optional(),
    updatedAt: z.date().or(z.string()).or(z.number()).nullable().optional(),
}).openapi('Course');

const CreateCourseSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    slug: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    price: z.coerce.number().default(0),
    memberPrice: z.coerce.number().optional().nullable(),
    status: z.enum(['draft', 'active', 'archived']).default('draft'),
    isPublic: z.boolean().default(false),
    contentCollectionId: z.string().optional().nullable(),
}).openapi('CreateCourse');

const UpdateCourseSchema = CreateCourseSchema.partial().openapi('UpdateCourse');

// --- Routes ---

// GET / - List courses
app.openapi(createRoute({
    method: 'get',
    path: '/',
    tags: ['Courses'],
    summary: 'List courses',
    request: {
        query: z.object({
            status: z.enum(['draft', 'active', 'archived']).optional(),
            limit: z.coerce.number().optional().default(50),
            offset: z.coerce.number().optional().default(0)
        })
    },
    responses: {
        200: {
            description: 'List of courses',
            content: { 'application/json': { schema: z.array(z.any()) } }
        }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { status, limit, offset } = c.req.valid('query');
    const db = createDb(c.env.DB);

    const conditions = status
        ? and(eq(courses.tenantId, tenant.id), eq(courses.status, status))
        : eq(courses.tenantId, tenant.id);

    const results = await db.select().from(courses)
        .where(conditions)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(courses.createdAt))
        .all();
    return c.json(results);
});

// POST / - Create course
app.openapi(createRoute({
    method: 'post',
    path: '/',
    tags: ['Courses'],
    summary: 'Create a new course',
    request: {
        body: { content: { 'application/json': { schema: CreateCourseSchema } } }
    },
    responses: {
        201: {
            description: 'Course created',
            content: { 'application/json': { schema: z.any() } }
        }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const body = c.req.valid('json');
    const db = createDb(c.env.DB);

    const id = crypto.randomUUID();
    const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const newCourse = {
        id,
        tenantId: tenant.id,
        title: body.title,
        description: body.description ?? null,
        slug,
        thumbnailUrl: body.thumbnailUrl ?? null,
        price: body.price,
        memberPrice: body.memberPrice ?? null,
        status: body.status,
        isPublic: body.isPublic,
        contentCollectionId: body.contentCollectionId ?? null,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    await db.insert(courses).values(newCourse).run();
    return c.json(newCourse, 201);
});

// GET /:id - Get course details with curriculum
app.openapi(createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['Courses'],
    summary: 'Get course details',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: {
            description: 'Course details',
            content: {
                'application/json': {
                    schema: z.any()
                }
            }
        },
        404: { description: 'Course not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');
    const db = createDb(c.env.DB);

    const course = await db.select().from(courses)
        .where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id)))
        .get();

    if (!course) return c.json({ error: 'Course not found' }, 404);

    // Get live sessions linked to this course
    const sessions = await db.select().from(classes)
        .where(eq(classes.courseId, id))
        .orderBy(classes.startTime)
        .all();

    // Get curriculum via linked video collection
    const curriculum: any[] = course.contentCollectionId
        ? await db.select().from(videoCollectionItems)
            .where(eq(videoCollectionItems.collectionId, course.contentCollectionId))
            .orderBy(videoCollectionItems.order)
            .all()
        : [];

    return c.json({ ...course, sessions, curriculum });
});

// PATCH /:id - Update course
app.openapi(createRoute({
    method: 'patch',
    path: '/{id}',
    tags: ['Courses'],
    summary: 'Update course details',
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: UpdateCourseSchema } } }
    },
    responses: {
        200: {
            description: 'Course updated',
            content: { 'application/json': { schema: z.any() } }
        },
        404: { description: 'Course not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const db = createDb(c.env.DB);

    const existing = await db.select().from(courses)
        .where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id)))
        .get();

    if (!existing) return c.json({ error: 'Course not found' }, 404);

    const updateData = { ...body, updatedAt: new Date() };
    await db.update(courses).set(updateData).where(eq(courses.id, id)).run();

    return c.json({ ...existing, ...updateData });
});

// DELETE /:id - Delete course
app.openapi(createRoute({
    method: 'delete',
    path: '/{id}',
    tags: ['Courses'],
    summary: 'Delete a course',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        204: { description: 'Course deleted' },
        404: { description: 'Course not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');
    const db = createDb(c.env.DB);

    const existing = await db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id)))
        .get();

    if (!existing) return c.json({ error: 'Course not found' }, 404);

    await db.delete(courses).where(eq(courses.id, id)).run();
    return c.body(null, 204);
});

// --- Student Endpoints ---

// POST /:id/enroll - Enroll in a course
app.openapi(createRoute({
    method: 'post',
    path: '/{id}/enroll',
    tags: ['Courses'],
    summary: 'Enroll in a course',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: { description: 'Enrolled successfully' },
        404: { description: 'Course not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const me = c.get('member') as any;
    const { id } = c.req.valid('param');
    const db = createDb(c.env.DB);

    const course = await db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id)))
        .get();

    if (!course) return c.json({ error: 'Course not found' }, 404);

    await db.insert(courseEnrollments).values({
        id: crypto.randomUUID(),
        courseId: id,
        userId: me.userId,
        tenantId: tenant.id,
        status: 'active',
        progress: 0,
        enrolledAt: new Date(),
    }).run();

    return c.json({ success: true });
});

// POST /:id/progress - Update course progress
app.openapi(createRoute({
    method: 'post',
    path: '/{id}/progress',
    tags: ['Courses'],
    summary: 'Update course progress',
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: z.object({ progress: z.number().min(0).max(100) }) } } }
    },
    responses: {
        200: { description: 'Progress updated' },
        404: { description: 'Enrollment not found' }
    }
}), async (c) => {
    const me = c.get('member') as any;
    const { id } = c.req.valid('param');
    const { progress } = c.req.valid('json');
    const db = createDb(c.env.DB);

    const enrollment = await db.select({ id: courseEnrollments.id }).from(courseEnrollments)
        .where(and(eq(courseEnrollments.courseId, id), eq(courseEnrollments.userId, me.userId)))
        .get();

    if (!enrollment) return c.json({ error: 'Enrollment not found' }, 404);

    await db.update(courseEnrollments)
        .set({
            progress,
            completedAt: progress === 100 ? new Date() : null,
            status: progress === 100 ? 'completed' : 'active'
        })
        .where(eq(courseEnrollments.id, enrollment.id))
        .run();

    return c.json({ success: true });
});

export default app;
