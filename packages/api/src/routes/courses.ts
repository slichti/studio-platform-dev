import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { courses, courseEnrollments, classes, videoCollectionItems, videoCollections } from '@studio/db/src/schema';
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

// GET /my-enrollments - Student's enrollments in this tenant
app.openapi(createRoute({
    method: 'get',
    path: '/my-enrollments',
    tags: ['Courses'],
    summary: 'Get my course enrollments',
    responses: {
        200: {
            description: 'My enrollments',
            content: { 'application/json': { schema: z.array(z.any()) } }
        }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const me = c.get('member') as any;
    const db = createDb(c.env.DB);

    const myEnrollments = await db.select().from(courseEnrollments)
        .where(and(eq(courseEnrollments.tenantId, tenant.id), eq(courseEnrollments.userId, me.userId)))
        .all();

    return c.json(myEnrollments);
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

// --- Curriculum Management Endpoints ---

// POST /:id/curriculum - Add a video or quiz item to the course curriculum
app.openapi(createRoute({
    method: 'post',
    path: '/{id}/curriculum',
    tags: ['Courses'],
    summary: 'Add item to course curriculum',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        contentType: z.enum(['video', 'quiz']),
                        videoId: z.string().optional().nullable(),
                        quizId: z.string().optional().nullable(),
                        order: z.number().optional()
                    })
                }
            }
        }
    },
    responses: {
        201: { description: 'Item added', content: { 'application/json': { schema: z.any() } } },
        400: { description: 'Bad request' },
        404: { description: 'Course not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const db = createDb(c.env.DB);

    // Verify course belongs to tenant
    const course = await db.select({ id: courses.id, contentCollectionId: courses.contentCollectionId })
        .from(courses)
        .where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id)))
        .get();
    if (!course) return c.json({ error: 'Course not found' }, 404);

    if (body.contentType === 'video' && !body.videoId) return c.json({ error: 'videoId required for video items' }, 400);
    if (body.contentType === 'quiz' && !body.quizId) return c.json({ error: 'quizId required for quiz items' }, 400);

    // Auto-create a video collection if none linked yet
    let collectionId = course.contentCollectionId;
    if (!collectionId) {
        collectionId = crypto.randomUUID();
        await db.insert(videoCollections).values({
            id: collectionId,
            tenantId: tenant.id,
            title: `Course: ${id}`,
            slug: `course-${id}`,
        }).run();
        await db.update(courses).set({ contentCollectionId: collectionId }).where(eq(courses.id, id)).run();
    }

    // Get current max order
    const existing = await db.select({ order: videoCollectionItems.order })
        .from(videoCollectionItems)
        .where(eq(videoCollectionItems.collectionId, collectionId))
        .orderBy(desc(videoCollectionItems.order))
        .all();
    const maxOrder = existing.length > 0 ? (existing[0].order ?? 0) : -1;

    const itemId = crypto.randomUUID();
    const newItem = {
        id: itemId,
        collectionId,
        contentType: body.contentType,
        videoId: body.videoId ?? null,
        quizId: body.quizId ?? null,
        order: body.order ?? maxOrder + 1,
    };
    await db.insert(videoCollectionItems).values(newItem).run();

    return c.json(newItem, 201);
});

// DELETE /:id/curriculum/:itemId - Remove item from curriculum
app.openapi(createRoute({
    method: 'delete',
    path: '/{id}/curriculum/{itemId}',
    tags: ['Courses'],
    summary: 'Remove item from course curriculum',
    request: {
        params: z.object({ id: z.string(), itemId: z.string() })
    },
    responses: {
        204: { description: 'Item removed' },
        404: { description: 'Not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id, itemId } = c.req.valid('param');
    const db = createDb(c.env.DB);

    const course = await db.select({ contentCollectionId: courses.contentCollectionId })
        .from(courses)
        .where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id)))
        .get();
    if (!course?.contentCollectionId) return c.json({ error: 'Course not found' }, 404);

    const item = await db.select({ id: videoCollectionItems.id })
        .from(videoCollectionItems)
        .where(and(eq(videoCollectionItems.id, itemId), eq(videoCollectionItems.collectionId, course.contentCollectionId)))
        .get();
    if (!item) return c.json({ error: 'Item not found' }, 404);

    await db.delete(videoCollectionItems).where(eq(videoCollectionItems.id, itemId)).run();
    return c.body(null, 204);
});

// PATCH /:id/curriculum/reorder - Reorder curriculum items
app.openapi(createRoute({
    method: 'patch',
    path: '/{id}/curriculum/reorder',
    tags: ['Courses'],
    summary: 'Reorder curriculum items',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        orderedIds: z.array(z.string())
                    })
                }
            }
        }
    },
    responses: {
        200: { description: 'Reordered' },
        404: { description: 'Course not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');
    const { orderedIds } = c.req.valid('json');
    const db = createDb(c.env.DB);

    const course = await db.select({ contentCollectionId: courses.contentCollectionId })
        .from(courses)
        .where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id)))
        .get();
    if (!course?.contentCollectionId) return c.json({ error: 'Course not found' }, 404);

    // Update order for each item
    await Promise.all(orderedIds.map((itemId, index) =>
        db.update(videoCollectionItems)
            .set({ order: index })
            .where(and(eq(videoCollectionItems.id, itemId), eq(videoCollectionItems.collectionId, course.contentCollectionId!)))
            .run()
    ));

    return c.json({ success: true });
});

// --- Analytics Endpoint ---

// GET /:id/analytics - Real enrollment/revenue/progress data
app.openapi(createRoute({
    method: 'get',
    path: '/{id}/analytics',
    tags: ['Courses'],
    summary: 'Get course analytics',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { description: 'Analytics', content: { 'application/json': { schema: z.any() } } },
        404: { description: 'Not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');
    const db = createDb(c.env.DB);

    const course = await db.select({ id: courses.id, price: courses.price })
        .from(courses)
        .where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id)))
        .get();
    if (!course) return c.json({ error: 'Course not found' }, 404);

    const enrollments = await db.select({
        id: courseEnrollments.id,
        status: courseEnrollments.status,
        progress: courseEnrollments.progress,
    }).from(courseEnrollments)
        .where(eq(courseEnrollments.courseId, id))
        .all();

    const totalStudents = enrollments.length;
    const totalRevenue = totalStudents * (course.price ?? 0); // Simplified; real would use payment records
    const avgProgress = totalStudents > 0
        ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress ?? 0), 0) / totalStudents)
        : 0;
    const completed = enrollments.filter(e => e.status === 'completed').length;

    return c.json({ totalStudents, totalRevenue, avgProgress, completed, enrollments });
});

export default app;
