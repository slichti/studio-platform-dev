import { Hono } from 'hono';
import { createDb } from '../db';
import { ReportService } from '../services/reports';
import { scheduledReports, locations, classes, bookings } from '@studio/db/src/schema';
import { eq, and, sql, count, gte, inArray } from 'drizzle-orm';
import { HonoContext } from '../types';
import churnRouter from './reports.churn';
import scheduledRouter from './reports.scheduled';
import { desc } from 'drizzle-orm';
import { tenantMembers } from '@studio/db/src/schema';

const app = new Hono<HonoContext>();

// Mount sub-routes
app.route('/churn', churnRouter);
app.route('/scheduled', scheduledRouter);

// GET /enrollments - Unified view of class and course enrollments
app.get('/enrollments', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const now = new Date();
    // Look back slightly so we don't instantly lose classes that just started
    const lookback = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { tenantMembers, users, courses, courseEnrollments } = await import('@studio/db/src/schema');

    // 1. Fetch upcoming/recent active classes
    const activeClasses = await db.select()
        .from(classes)
        .where(
            and(
                eq(classes.tenantId, tenant.id),
                eq(classes.status, 'active'),
                gte(classes.startTime, lookback)
            )
        )
        .orderBy(classes.startTime)
        .limit(100)
        .all();

    const classIds = activeClasses.map(c => c.id);
    let classBookings: any[] = [];
    if (classIds.length > 0) {
        // Fetch bookings for these classes, joined to get the member profile
        classBookings = await db.select({
            id: bookings.id,
            classId: bookings.classId,
            status: bookings.status,
            attendanceType: bookings.attendanceType,
            checkedInAt: bookings.checkedInAt,
            memberId: bookings.memberId,
            memberProfile: tenantMembers.profile,
            userEmail: users.email
        })
            .from(bookings)
            .innerJoin(tenantMembers, eq(bookings.memberId, tenantMembers.id))
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(inArray(bookings.classId, classIds))
            .all();
    }

    // 2. Fetch active courses
    const activeCourses = await db.select()
        .from(courses)
        .where(
            and(
                eq(courses.tenantId, tenant.id),
                eq(courses.status, 'active')
            )
        )
        .orderBy(desc(courses.createdAt))
        .all();

    const courseIds = activeCourses.map(c => c.id);
    let courseEnrollees: any[] = [];
    if (courseIds.length > 0) {
        courseEnrollees = await db.select({
            id: courseEnrollments.id,
            courseId: courseEnrollments.courseId,
            status: courseEnrollments.status,
            progress: courseEnrollments.progress,
            enrolledAt: courseEnrollments.enrolledAt,
            memberId: tenantMembers.id,
            memberProfile: tenantMembers.profile,
            userEmail: users.email
        })
            .from(courseEnrollments)
            .innerJoin(users, eq(courseEnrollments.userId, users.id))
            // Join tenant members separately since we only have userId on courseEnrollments
            .innerJoin(tenantMembers, and(eq(tenantMembers.userId, users.id), eq(tenantMembers.tenantId, tenant.id)))
            .where(inArray(courseEnrollments.courseId, courseIds))
            .all();
    }

    // Combine and structure the output
    const enrollmentsReport = [
        ...activeClasses.map(cls => ({
            id: cls.id,
            title: cls.title,
            type: cls.type || 'class', // from DB
            date: cls.startTime,
            instructorId: cls.instructorId,
            capacity: cls.capacity,
            roster: classBookings.filter(b => b.classId === cls.id).map(b => {
                const profile = typeof b.memberProfile === 'string' ? JSON.parse(b.memberProfile) : b.memberProfile;
                return {
                    bookingId: b.id,
                    memberId: b.memberId,
                    name: `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'Unknown',
                    email: b.userEmail,
                    status: b.status,
                    attendanceType: b.attendanceType,
                    checkedIn: !!b.checkedInAt
                };
            })
        })),
        ...activeCourses.map(crs => ({
            id: crs.id,
            title: crs.title,
            type: 'course',
            date: crs.createdAt, // Course doesn't have a rigid start time mostly
            isPublic: crs.isPublic,
            roster: courseEnrollees.filter(e => e.courseId === crs.id).map(e => {
                const profile = typeof e.memberProfile === 'string' ? JSON.parse(e.memberProfile) : e.memberProfile;
                return {
                    enrollmentId: e.id,
                    memberId: e.memberId,
                    name: `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'Unknown',
                    email: e.userEmail,
                    status: e.status,
                    progress: e.progress,
                    enrolledAt: e.enrolledAt
                };
            })
        }))
    ];

    // Sort by date (newest/upcoming first)
    enrollmentsReport.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    return c.json({ items: enrollmentsReport });
});

// GET /locations - Cross-location comparison
app.get('/locations', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    // Get all locations for this tenant
    const allLocations = await db.select().from(locations)
        .where(eq(locations.tenantId, tenant.id))
        .all();

    // Get stats for each location
    const locationStats = await Promise.all(allLocations.map(async (location) => {
        const activeClasses = await db.select({ count: count() })
            .from(classes)
            .where(and(
                eq(classes.locationId, location.id),
                eq(classes.status, 'active')
            ))
            .get();

        const totalBookings = await db.select({ count: count() })
            .from(bookings)
            .innerJoin(classes, eq(bookings.classId, classes.id))
            .where(and(
                eq(classes.locationId, location.id),
                eq(bookings.status, 'confirmed')
            ))
            .get();

        return {
            locationId: location.id,
            locationName: location.name,
            activeClasses: activeClasses?.count || 0,
            totalBookings: totalBookings?.count || 0,
            isPrimary: location.isPrimary,
        };
    }));

    return c.json({ locations: locationStats });
});

// GET /revenue
app.get('/revenue', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    const service = new ReportService(db, tenant.id);
    const result = await service.getRevenue(start, end);

    return c.json(result as any);
});

// GET /attendance
app.get('/attendance', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    const service = new ReportService(db, tenant.id);
    const result = await service.getAttendance(start, end);

    return c.json(result as any);
});

// GET /retention
app.get('/retention', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const start = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const end = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : new Date();

    const service = new ReportService(db, tenant.id);
    const result = await service.getRetention(start, end);

    return c.json(result);
});

// GET /retention/cohorts — Cohort analysis by signup month with retention at 30/60/90 days
app.get('/retention/cohorts', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Members grouped by join month (cohort)
    const cohortRows = await db.select({
        cohortMonth: sql<string>`strftime('%Y-%m', ${tenantMembers.joinedAt})`,
        memberId: tenantMembers.id
    })
        .from(tenantMembers)
        .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.status, 'active')))
        .all();

    const memberIds = cohortRows.map(r => r.memberId);
    if (memberIds.length === 0) return c.json({ cohorts: [] });

    // Last confirmed booking per member
    const lastBookings = await db.select({
        memberId: bookings.memberId,
        lastStart: sql<number>`max(${classes.startTime})`.as('last_start')
    })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(eq(classes.tenantId, tenant.id), eq(bookings.status, 'confirmed'), inArray(bookings.memberId, memberIds)))
        .groupBy(bookings.memberId)
        .all();
    const lastMap = new Map(lastBookings.map(r => [r.memberId, r.lastStart]));

    const byCohort = new Map<string, { total: number; retained30: number; retained60: number; retained90: number }>();
    for (const row of cohortRows) {
        const last = lastMap.get(row.memberId);
        const lastTs = last ? last * 1000 : 0;
        const lastDate = lastTs ? new Date(lastTs) : null;
        let r30 = 0, r60 = 0, r90 = 0;
        if (lastDate) {
            if (lastDate >= thirtyDaysAgo) r30 = r60 = r90 = 1;
            else if (lastDate >= sixtyDaysAgo) r60 = r90 = 1;
            else if (lastDate >= ninetyDaysAgo) r90 = 1;
        }
        const cur = byCohort.get(row.cohortMonth) || { total: 0, retained30: 0, retained60: 0, retained90: 0 };
        cur.total++;
        cur.retained30 += r30;
        cur.retained60 += r60;
        cur.retained90 += r90;
        byCohort.set(row.cohortMonth, cur);
    }

    const cohorts = Array.from(byCohort.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12)
        .map(([month, data]) => ({
            month,
            total: data.total,
            retained30: data.retained30,
            retained60: data.retained60,
            retained90: data.retained90,
            retentionRate30: data.total > 0 ? Math.round((data.retained30 / data.total) * 100) : 0,
            retentionRate60: data.total > 0 ? Math.round((data.retained60 / data.total) * 100) : 0,
            retentionRate90: data.total > 0 ? Math.round((data.retained90 / data.total) * 100) : 0
        }));

    return c.json({ cohorts });
});

// GET /retention/churn-risk
// Mounted Churn Router (Replaces simple endpoint)
app.route('/retention/risk', churnRouter);

// GET /at-risk — Members with no booking in the last N days (default 14)
app.get('/at-risk', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const minDays = Math.min(365, Math.max(1, parseInt(c.req.query('days') || '14')));
    const now = Date.now() / 1000; // seconds

    // Last confirmed class start per member (for this tenant)
    const lastPerMember = await db
        .select({
            memberId: bookings.memberId,
            lastStart: sql<number>`max(${classes.startTime})`.as('last_start')
        })
        .from(bookings)
        .innerJoin(classes, eq(bookings.classId, classes.id))
        .where(and(eq(classes.tenantId, tenant.id), eq(bookings.status, 'confirmed')))
        .groupBy(bookings.memberId)
        .all();

    const lastStartMap = new Map(lastPerMember.map(r => [r.memberId, r.lastStart]));

    // All active members
    const activeMembers = await db.query.tenantMembers.findMany({
        where: and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.status, 'active')),
        columns: { id: true, userId: true, profile: true },
        with: { user: { columns: { id: true, email: true, profile: true } } }
    });

    const atRisk = activeMembers.filter(m => {
        const lastStart = lastStartMap.get(m.id) ?? null;
        if (lastStart == null) return true;
        const daysSince = (now - lastStart) / 86400;
        return daysSince >= minDays;
    });

    const members = atRisk.map(m => {
        const lastStart = lastStartMap.get(m.id) ?? null;
        const profile = (m.profile ?? m.user?.profile) as { firstName?: string; lastName?: string } | null;
        const daysSince = lastStart == null ? null : Math.floor((now - lastStart) / 86400);
        return {
            memberId: m.id,
            email: m.user?.email ?? null,
            firstName: profile?.firstName ?? null,
            lastName: profile?.lastName ?? null,
            lastBookingAt: lastStart ? new Date(lastStart * 1000).toISOString() : null,
            daysSinceLastBooking: daysSince
        };
    });

    members.sort((a, b) => (b.daysSinceLastBooking ?? 0) - (a.daysSinceLastBooking ?? 0));

    return c.json({ total: members.length, minDays, members });
});

// GET /upcoming-renewals
app.get('/upcoming-renewals', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const daysAhead = parseInt(c.req.query('days') || '30');
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const { subscriptions, tenantMembers, membershipPlans } = await import('@studio/db/src/schema');
    const { lte, gte, and: dbAnd, inArray } = await import('drizzle-orm');

    const renewals = await db.select({
        subscriptionId: subscriptions.id, memberId: subscriptions.memberId, userId: subscriptions.userId,
        status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd, planId: subscriptions.planId
    })
        .from(subscriptions)
        .where(dbAnd(eq(subscriptions.tenantId, tenant.id), eq(subscriptions.status, 'active'), lte(subscriptions.currentPeriodEnd, futureDate), gte(subscriptions.currentPeriodEnd, now)))
        .orderBy(subscriptions.currentPeriodEnd).limit(50).all();

    const memberIds = renewals.map(r => r.memberId).filter(Boolean) as string[];
    const planIds = [...new Set(renewals.map(r => r.planId).filter(Boolean))] as string[];

    const [members, plans] = await Promise.all([
        memberIds.length > 0 ? db.select().from(tenantMembers).where(memberIds.length === 1 ? eq(tenantMembers.id, memberIds[0]) : inArray(tenantMembers.id, memberIds)).all() : [],
        planIds.length > 0 ? db.select().from(membershipPlans).where(planIds.length === 1 ? eq(membershipPlans.id, planIds[0]) : inArray(membershipPlans.id, planIds)).all() : []
    ]);

    const memberMap = new Map(members.map((m: any) => [m.id, m]));
    const planMap = new Map(plans.map((p: any) => [p.id, p]));

    const enrichedRenewals = renewals.map(r => {
        const member = r.memberId ? memberMap.get(r.memberId) : null;
        const plan = r.planId ? planMap.get(r.planId) : null;
        return {
            id: r.subscriptionId,
            memberName: member?.profile && typeof member.profile === 'string' ? JSON.parse(member.profile).firstName : member?.profile?.firstName || 'Unknown',
            planName: plan?.name || 'Unknown Plan',
            renewsAt: r.currentPeriodEnd,
            daysUntilRenewal: r.currentPeriodEnd ? Math.ceil((new Date(r.currentPeriodEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
        };
    });

    return c.json({ count: enrichedRenewals.length, renewals: enrichedRenewals });
});

// POST /projection
app.post('/projection', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { studentCount, monthlyFee, costs } = await c.req.json();
    if (studentCount === undefined || monthlyFee === undefined) return c.json({ error: "Required fields missing" }, 400);

    const service = new ReportService(db, tenant.id);
    const projection = await service.getProjection(studentCount, monthlyFee, costs);
    return c.json(projection);
});

// GET /accounting/journal
app.get('/accounting/journal', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);
    const db = createDb(c.env.DB);
    const { startDate, endDate, format } = c.req.query();

    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : now;

    const service = new ReportService(db, tenant.id);
    const journalData = await service.getJournal(start, end, format as string, tenant.currency || 'USD');

    if (format === 'csv' && typeof journalData === 'string') return c.text(journalData);
    return c.json({ period: { start, end }, journal: journalData });
});

// GET /schedules
app.get('/schedules', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const schedules = await db.select().from(scheduledReports).where(eq(scheduledReports.tenantId, tenant.id)).all();
    return c.json(schedules);
});

// POST /schedules
app.post('/schedules', async (c) => {
    if (!c.get('can')('manage_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { reportType, frequency, recipients, customReportId } = await c.req.json();
    if (!reportType || !frequency || !recipients) return c.json({ error: "Missing fields" }, 400);
    if (reportType === 'custom' && !customReportId) return c.json({ error: "Custom report selection required" }, 400);

    const now = new Date();
    let nextRun = new Date();
    if (frequency === 'daily') nextRun.setDate(now.getDate() + 1);
    else if (frequency === 'weekly') nextRun.setDate(now.getDate() + 7);
    else if (frequency === 'monthly') nextRun.setMonth(now.getMonth() + 1);

    const newSchedule = {
        id: crypto.randomUUID(), tenantId: tenant.id, reportType, frequency,
        recipients, customReportId, nextRun, status: 'active'
    };

    await db.insert(scheduledReports).values(newSchedule as any).run();
    return c.json(newSchedule);
});

// DELETE /schedules/:id
app.delete('/schedules/:id', async (c) => {
    if (!c.get('can')('manage_reports')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const id = c.req.param('id');
    await db.delete(scheduledReports).where(and(eq(scheduledReports.id, id), eq(scheduledReports.tenantId, tenant.id))).run();
    return c.json({ success: true });
});

export default app;
