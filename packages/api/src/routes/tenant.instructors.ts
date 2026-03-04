import { createOpenAPIApp } from '../lib/openapi';
import { createDb } from '../db';
import { tenantMembers, tenantRoles, users, classes, reviews, tenants } from '@studio/db/src/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import type { Variables } from '../types';

const app = createOpenAPIApp<Variables>();

// GET /instructors — Public list of all instructors for a tenant
app.get('/', async (c) => {
    const slug = c.req.header('X-Tenant-Slug') || c.req.query('slug');
    if (!slug) return c.json({ error: 'Missing tenant slug' }, 400);

    const db = createDb(c.env.DB);
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) });
    if (!tenant) return c.json({ error: 'Studio not found' }, 404);

    // Find instructors: members with 'instructor' role
    const instructorRoles = await db.select({
        memberId: tenantRoles.memberId
    })
        .from(tenantRoles)
        .innerJoin(tenantMembers, eq(tenantRoles.memberId, tenantMembers.id))
        .where(and(
            eq(tenantMembers.tenantId, tenant.id),
            eq(tenantRoles.role, 'instructor'),
            eq(tenantMembers.status, 'active')
        ))
        .all();

    if (instructorRoles.length === 0) return c.json({ instructors: [] });

    const memberIds = instructorRoles.map(r => r.memberId);

    const members = await db.select({
        memberId: tenantMembers.id,
        profile: tenantMembers.profile,
        userId: tenantMembers.userId,
        userName: users.profile,
        email: users.email,
        portraitUrl: sql<string>`json_extract(${users.profile}, '$.portraitUrl')`
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(sql`${tenantMembers.id} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`)
        .all();

    const instructors = members.map(m => {
        const userProfile = (m.userName as any) || {};
        const memberProfile = (m.profile as any) || {};
        return {
            id: m.memberId,
            firstName: userProfile.firstName || memberProfile.firstName || '',
            lastName: userProfile.lastName || memberProfile.lastName || '',
            email: m.email,
            portraitUrl: m.portraitUrl || userProfile.portraitUrl || null,
            bio: memberProfile.bio || userProfile.bio || null,
            specialties: memberProfile.specialties || []
        };
    });

    return c.json({ instructors });
});

// GET /instructors/:id — Public detail for a specific instructor
app.get('/:id', async (c) => {
    const slug = c.req.header('X-Tenant-Slug') || c.req.query('slug');
    if (!slug) return c.json({ error: 'Missing tenant slug' }, 400);

    const db = createDb(c.env.DB);
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) });
    if (!tenant) return c.json({ error: 'Studio not found' }, 404);

    const instructorId = c.req.param('id');

    // Verify this member is an instructor
    const role = await db.query.tenantRoles.findFirst({
        where: and(eq(tenantRoles.memberId, instructorId), eq(tenantRoles.role, 'instructor'))
    });
    if (!role) return c.json({ error: 'Instructor not found' }, 404);

    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.id, instructorId), eq(tenantMembers.tenantId, tenant.id)),
        with: { user: true }
    });
    if (!member) return c.json({ error: 'Not found' }, 404);

    const userProfile = (member.user?.profile as any) || {};
    const memberProfile = (member.profile as any) || {};

    // Upcoming classes this instructor teaches
    const upcomingClasses = await db.select({
        id: classes.id,
        title: classes.title,
        startTime: classes.startTime
    })
        .from(classes)
        .where(and(
            eq(classes.tenantId, tenant.id),
            eq(classes.instructorId, instructorId),
            gte(classes.startTime, new Date())
        ))
        .orderBy(classes.startTime)
        .limit(10)
        .all();

    // Approved reviews
    const instructorReviews = await db.select()
        .from(reviews)
        .where(and(
            eq(reviews.tenantId, tenant.id),
            eq(reviews.targetType, 'instructor'),
            eq(reviews.targetId, instructorId),
            eq(reviews.isApproved, true),
            eq(reviews.isPublic, true)
        ))
        .orderBy(desc(reviews.createdAt))
        .limit(10)
        .all();

    return c.json({
        instructor: {
            id: member.id,
            firstName: userProfile.firstName || memberProfile.firstName || '',
            lastName: userProfile.lastName || memberProfile.lastName || '',
            email: member.user?.email,
            portraitUrl: userProfile.portraitUrl || null,
            bio: memberProfile.bio || userProfile.bio || null,
            specialties: memberProfile.specialties || []
        },
        upcomingClasses,
        reviews: instructorReviews
    });
});

export default app;
