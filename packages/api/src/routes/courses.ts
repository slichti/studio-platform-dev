import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { StudioVariables } from '../types';
import { createDb } from '../db';
import { courses, courseEnrollments, classes, videoCollectionItems, videoCollections, courseModules, courseAccessCodes } from '@studio/db/src/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

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
    // H3: Cohort mode
    deliveryMode: z.enum(['self_paced', 'cohort']).default('self_paced'),
    cohortStartDate: z.string().datetime().optional().nullable(),
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

// --- H1: Course Modules (section grouping) ---

// GET /:id/modules - List modules for a course
app.openapi(createRoute({
    method: 'get',
    path: '/{id}/modules',
    tags: ['Courses'],
    summary: 'List course modules',
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: { description: 'Modules list', content: { 'application/json': { schema: z.array(z.any()) } } } }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');
    const db = createDb(c.env.DB);

    const course = await db.select({ id: courses.id })
        .from(courses).where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id))).get();
    if (!course) return c.json({ error: 'Course not found' }, 404);

    const modules = await db.select().from(courseModules)
        .where(eq(courseModules.courseId, id))
        .orderBy(asc(courseModules.order))
        .all();

    return c.json(modules);
});

// POST /:id/modules - Create a module
app.openapi(createRoute({
    method: 'post',
    path: '/{id}/modules',
    tags: ['Courses'],
    summary: 'Create a course module',
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: z.object({ title: z.string(), description: z.string().optional(), order: z.number().optional() }) } } }
    },
    responses: { 201: { description: 'Module created', content: { 'application/json': { schema: z.any() } } } }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const db = createDb(c.env.DB);

    const course = await db.select({ id: courses.id })
        .from(courses).where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id))).get();
    if (!course) return c.json({ error: 'Course not found' }, 404);

    const existing = await db.select({ order: courseModules.order })
        .from(courseModules).where(eq(courseModules.courseId, id))
        .orderBy(desc(courseModules.order)).all();
    const maxOrder = existing.length > 0 ? (existing[0].order ?? 0) : -1;

    const newModule = { id: crypto.randomUUID(), courseId: id, title: body.title, description: body.description ?? null, order: body.order ?? maxOrder + 1 };
    await db.insert(courseModules).values(newModule).run();
    return c.json(newModule, 201);
});

// DELETE /:id/modules/:moduleId
app.openapi(createRoute({
    method: 'delete',
    path: '/{id}/modules/{moduleId}',
    tags: ['Courses'],
    summary: 'Delete a course module',
    request: { params: z.object({ id: z.string(), moduleId: z.string() }) },
    responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id, moduleId } = c.req.valid('param');
    const db = createDb(c.env.DB);

    const course = await db.select({ id: courses.id })
        .from(courses).where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id))).get();
    if (!course) return c.json({ error: 'Course not found' }, 404);

    await db.delete(courseModules).where(and(eq(courseModules.id, moduleId), eq(courseModules.courseId, id))).run();
    return c.body(null, 204);
});

// --- H2: Drip / Release Scheduling ---

// PATCH /:id/curriculum/:itemId/config - Set releaseAfterDays and isRequired
app.openapi(createRoute({
    method: 'patch',
    path: '/{id}/curriculum/{itemId}/config',
    tags: ['Courses'],
    summary: 'Update curriculum item release config',
    request: {
        params: z.object({ id: z.string(), itemId: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        releaseAfterDays: z.number().min(0).nullable().optional(),
                        isRequired: z.boolean().optional(),
                        moduleId: z.string().nullable().optional(),
                    })
                }
            }
        }
    },
    responses: { 200: { description: 'Updated', content: { 'application/json': { schema: z.any() } } }, 404: { description: 'Not found' } }
}), async (c) => {
    const tenant = c.get('tenant');
    const { id, itemId } = c.req.valid('param');
    const body = c.req.valid('json');
    const db = createDb(c.env.DB);

    const course = await db.select({ contentCollectionId: courses.contentCollectionId })
        .from(courses).where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id))).get();
    if (!course?.contentCollectionId) return c.json({ error: 'Course not found' }, 404);

    const item = await db.select({ id: videoCollectionItems.id })
        .from(videoCollectionItems)
        .where(and(eq(videoCollectionItems.id, itemId), eq(videoCollectionItems.collectionId, course.contentCollectionId)))
        .get();
    if (!item) return c.json({ error: 'Item not found' }, 404);

    const updateSet: any = {};
    if (body.releaseAfterDays !== undefined) updateSet.releaseAfterDays = body.releaseAfterDays;
    if (body.isRequired !== undefined) updateSet.isRequired = body.isRequired;
    if (body.moduleId !== undefined) updateSet.moduleId = body.moduleId;

    await db.update(videoCollectionItems).set(updateSet).where(eq(videoCollectionItems.id, itemId)).run();
    return c.json({ success: true });
});

// --- H4: Completion Certificates ---

// GET /:id/certificate - Generate a printable HTML certificate for a completed enrollment
app.openapi(createRoute({
    method: 'get',
    path: '/{id}/certificate',
    tags: ['Courses'],
    summary: 'Get completion certificate (printable HTML)',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { description: 'Printable HTML certificate page' },
        403: { description: 'Course not completed' },
        404: { description: 'Course or enrollment not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const me = c.get('member') as any;
    const { id } = c.req.valid('param');
    const db = createDb(c.env.DB);

    const course = await db.select({ id: courses.id, title: courses.title })
        .from(courses).where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id))).get();
    if (!course) return c.json({ error: 'Course not found' }, 404);

    const enrollment = await db.select({
        status: courseEnrollments.status,
        completedAt: courseEnrollments.completedAt,
        progress: courseEnrollments.progress,
    }).from(courseEnrollments)
        .where(and(eq(courseEnrollments.courseId, id), eq(courseEnrollments.userId, me.userId)))
        .get();

    if (!enrollment) return c.json({ error: 'Enrollment not found' }, 404);
    if (enrollment.status !== 'completed' && (enrollment.progress ?? 0) < 100) {
        return c.json({ error: 'Course not completed yet' }, 403);
    }

    const completedDate = enrollment.completedAt
        ? new Date(enrollment.completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Certificate of Completion — ${course.title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: #f8f7f4; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .cert {
    width: 860px; background: #fff; border: 2px solid #c8a96e;
    padding: 60px 80px; text-align: center; position: relative;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  }
  .cert::before, .cert::after {
    content: ''; position: absolute; inset: 8px; border: 1px solid #e8d5a3; pointer-events: none;
  }
  .cert-badge { font-size: 48px; margin-bottom: 16px; }
  .cert-header { font-family: 'Playfair Display', serif; font-size: 13px; letter-spacing: 4px; text-transform: uppercase; color: #9b7f3e; margin-bottom: 24px; }
  .cert-title { font-family: 'Playfair Display', serif; font-size: 42px; color: #1a1a1a; margin-bottom: 16px; }
  .cert-body { font-size: 16px; color: #555; line-height: 1.8; margin-bottom: 28px; }
  .cert-name { font-family: 'Playfair Display', serif; font-style: italic; font-size: 34px; color: #2c2c2c; border-bottom: 2px solid #c8a96e; display: inline-block; padding-bottom: 8px; margin: 12px 0; }
  .cert-course { font-family: 'Playfair Display', serif; font-size: 22px; color: #9b7f3e; font-weight: 700; margin: 8px 0; }
  .cert-date { font-size: 14px; color: #888; letter-spacing: 1px; margin-top: 36px; }
  .cert-studio { font-size: 15px; font-weight: 600; color: #333; margin-top: 8px; }
  .print-btn { margin-top: 32px; padding: 12px 28px; background: #9b7f3e; color: #fff; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; font-family: 'Inter', sans-serif; }
  @media print {
    body { background: #fff; }
    .print-btn { display: none; }
    .cert { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="cert">
    <div class="cert-badge">🎓</div>
    <div class="cert-header">Certificate of Completion</div>
    <div class="cert-title">This certifies that</div>
    <div class="cert-name">${me.userId}</div>
    <div class="cert-body">has successfully completed the course</div>
    <div class="cert-course">${course.title}</div>
    <div class="cert-date">Completed on ${completedDate}</div>
    <div class="cert-studio">Issued by ${tenant.name}</div>
    <br>
    <button class="print-btn" onclick="window.print()">🖨 Download / Print Certificate</button>
  </div>
  <script>
    // Auto-open print dialog after a short delay for seamless download experience
    // (disabled on load — user clicks button instead for better UX)
  </script>
</body>
</html>`;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
});

// --- N4: Content Protection — Enrollment-gated video URL ---

// GET /:id/video/:videoId/url - Return a signed video URL only if enrolled
app.openapi(createRoute({
    method: 'get',
    path: '/{id}/video/{videoId}/url',
    tags: ['Courses'],
    summary: 'Get enrollment-gated video URL',
    request: { params: z.object({ id: z.string(), videoId: z.string() }) },
    responses: {
        200: { description: 'Video URL', content: { 'application/json': { schema: z.any() } } },
        403: { description: 'Not enrolled' },
        404: { description: 'Not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const me = c.get('member') as any;
    const { id, videoId } = c.req.valid('param');
    const db = createDb(c.env.DB);

    // Verify enrollment
    const enrollment = await db.select({ status: courseEnrollments.status })
        .from(courseEnrollments)
        .where(and(eq(courseEnrollments.courseId, id), eq(courseEnrollments.userId, me.userId), eq(courseEnrollments.tenantId, tenant.id)))
        .get();

    if (!enrollment) return c.json({ error: 'Not enrolled in this course' }, 403);

    // Return the video record — actual signed URL generation is handled by the videos route
    // This endpoint confirms authorization; the client can then call /videos/:videoId for the stream URL
    return c.json({ authorized: true, videoId, courseId: id });
});

// --- N1: Access Codes / Free Enrollment ---

// POST /:id/access-codes - Admin generates an access code
app.openapi(createRoute({
    method: 'post',
    path: '/{id}/access-codes',
    tags: ['Courses'],
    summary: 'Generate a course access code (admin)',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        code: z.string().optional(),       // custom or auto-generated
                        maxUses: z.number().optional(),    // null = unlimited
                        expiresAt: z.string().datetime().optional()
                    })
                }
            }
        }
    },
    responses: { 201: { description: 'Code created', content: { 'application/json': { schema: z.any() } } } }
}), async (c) => {
    const tenant = c.get('tenant');
    const can = c.get('can') as any;
    if (!can?.('manage', 'courses')) return c.json({ error: 'Forbidden' }, 403);

    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const db = createDb(c.env.DB);

    const course = await db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id))).get();
    if (!course) return c.json({ error: 'Course not found' }, 404);

    // Auto-generate code if not provided
    const code = body.code || Math.random().toString(36).substring(2, 10).toUpperCase();
    const newCode = {
        id: crypto.randomUUID(),
        courseId: id,
        tenantId: tenant.id,
        code,
        maxUses: body.maxUses ?? null,
        usedCount: 0,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    };
    await db.insert(courseAccessCodes).values(newCode).run();
    return c.json(newCode, 201);
});

// POST /:id/redeem - Student redeems an access code for free enrollment
app.openapi(createRoute({
    method: 'post',
    path: '/{id}/redeem',
    tags: ['Courses'],
    summary: 'Redeem access code for free course enrollment',
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: z.object({ code: z.string() }) } } }
    },
    responses: {
        200: { description: 'Enrolled via access code' },
        400: { description: 'Invalid or expired code' },
        404: { description: 'Course not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const me = c.get('member') as any;
    const { id } = c.req.valid('param');
    const { code } = c.req.valid('json');
    const db = createDb(c.env.DB);

    const course = await db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, id), eq(courses.tenantId, tenant.id))).get();
    if (!course) return c.json({ error: 'Course not found' }, 404);

    const accessCode = await db.select().from(courseAccessCodes)
        .where(and(eq(courseAccessCodes.courseId, id), eq(courseAccessCodes.code, code.toUpperCase())))
        .get();

    if (!accessCode) return c.json({ error: 'Invalid access code' }, 400);
    if (accessCode.expiresAt && new Date(accessCode.expiresAt) < new Date()) {
        return c.json({ error: 'Access code has expired' }, 400);
    }
    if (accessCode.maxUses !== null && accessCode.usedCount >= accessCode.maxUses) {
        return c.json({ error: 'Access code has reached its usage limit' }, 400);
    }

    // Enroll the student
    await db.insert(courseEnrollments).values({
        id: crypto.randomUUID(),
        courseId: id,
        userId: me.userId,
        tenantId: tenant.id,
        status: 'active',
        progress: 0,
        enrolledAt: new Date(),
    }).run().catch(() => { }); // Ignore duplicate enrollment errors

    // Increment usage count
    await db.update(courseAccessCodes)
        .set({ usedCount: accessCode.usedCount + 1 })
        .where(eq(courseAccessCodes.id, accessCode.id))
        .run();

    return c.json({ success: true, message: 'Enrolled successfully via access code' });
});

export default app;
