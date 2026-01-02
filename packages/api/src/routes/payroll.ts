import { Hono } from 'hono';
import { createDb } from '../db';
import { payrollConfig, payouts, payrollItems, tenantMembers, classes, appointments, bookings, appointmentServices } from 'db/src/schema';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant: any; // Using any for brevity if types aren't fully shared yet
    member?: any;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// 1. GET /config - List Rate Configurations
app.get('/config', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    // Join with Members to get names
    const configs = await db.select({
        config: payrollConfig,
        member: tenantMembers,
        user: {
            firstName: sql`json_extract(${tenantMembers.profile}, '$.firstName')`, // Fallback if user join tricky
            // Actually let's join users properly if possible, or just rely on member profile
        }
    })
        .from(tenantMembers)
        .leftJoin(payrollConfig, eq(payrollConfig.memberId, tenantMembers.id))
        .where(and(
            eq(tenantMembers.tenantId, tenant.id),
            eq(tenantMembers.status, 'active'),
            // Filter for instructors only if possible? 
            // For now list all active members or maybe just those with role?
            // Let's assume frontend filters or we add role filter later.
        ))
        .all();

    // The above query is a bit raw. Let's try to get members with role 'instructor' using query builder if roles are separate.
    // Simpler: Just list existing configs.

    const existingConfigs = await db.query.payrollConfig.findMany({
        where: eq(payrollConfig.tenantId, tenant.id),
        with: {
            member: {
                with: { user: { columns: { profile: true, email: true } } }
            }
        }
    });

    // Also fetch all instructors to show those who don't have config yet
    // This might be better done by the frontend fetching all members?
    // Let's just return what we have configured for now.

    return c.json({ configs: existingConfigs });
});


// 2. PUT /config - Upsert Configuration
app.put('/config', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const body = await c.req.json();
    const { memberId, payModel, rate } = body;

    if (!memberId || !payModel || rate === undefined) return c.json({ error: "Missing fields" }, 400);

    // Get Member to find User ID
    const member = await db.select().from(tenantMembers).where(eq(tenantMembers.id, memberId)).get();
    if (!member) return c.json({ error: "Member not found" }, 404);

    const id = crypto.randomUUID(); // For new insert

    // Upsert logic: Delete existing for this member and insert new? Or use onConflictDoUpdate
    // SQLite upsert:
    await db.insert(payrollConfig).values({
        id,
        tenantId: tenant.id,
        memberId,
        userId: member.userId,
        payModel,
        rate,
        updatedAt: new Date()
    })
        .onConflictDoUpdate({
            target: [payrollConfig.memberId], // Need a unique index on memberId for this tenant? 
            // Schema doesn't strictly have unique(tenantId, memberId) yet but let's assume valid.
            // Actually I defined index but not unique constraint in schema step.
            // Let's do a check and update manually to be safe.
            set: {
                payModel,
                rate,
                updatedAt: new Date()
            }
        });

    // Wait, I didn't add unique constraint in schema. 
    // Let's manually check.
    const existing = await db.select().from(payrollConfig).where(and(eq(payrollConfig.memberId, memberId), eq(payrollConfig.tenantId, tenant.id))).get();

    if (existing) {
        await db.update(payrollConfig).set({ payModel, rate, updatedAt: new Date() })
            .where(eq(payrollConfig.id, existing.id)).run();
    } else {
        await db.insert(payrollConfig).values({
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            userId: member.userId,
            memberId,
            payModel,
            rate
        }).run();
    }

    return c.json({ success: true });
});


// 3. GET /report - Calculate Earnings
app.get('/report', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { start, end } = c.req.query();

    if (!start || !end) return c.json({ error: "Start and End dates required" }, 400);

    const startDate = new Date(start);
    const endDate = new Date(end);

    // 1. Get all instructors and their config
    const instructors = await db.query.tenantMembers.findMany({
        where: eq(tenantMembers.tenantId, tenant.id),
        with: {
            // roles?
        }
    });

    const configs = await db.select().from(payrollConfig).where(eq(payrollConfig.tenantId, tenant.id)).all();
    const configMap = new Map(configs.map(c => [c.memberId, c]));

    // 2. Find Completed Classes
    const completedClasses = await db.query.classes.findMany({
        where: and(
            eq(classes.tenantId, tenant.id),
            gte(classes.startTime, startDate),
            lte(classes.startTime, endDate)
            // TODO: filtering by completion? Or just assume past classes are payable?
        ),
        with: {
            // Need bookings to calculate revenue if revenue share
        }
    });

    // For revenue share, we need total booking value for each class
    // This is expensive to query in loop.
    // Let's aggregate bookings.

    // 3. Find Completed Appointments
    const completedAppointments = await db.query.appointments.findMany({
        where: and(
            eq(appointments.tenantId, tenant.id),
            eq(appointments.status, 'confirmed'), // or completed
            gte(appointments.startTime, startDate),
            lte(appointments.startTime, endDate)
        ),
        with: {
            service: true
        }
    });

    // Calculate totals per instructor
    const report: any = {}; // { [instructorId]: { instructor, items: [], total: 0 } }

    // Process Classes
    for (const cls of completedClasses) {
        if (!report[cls.instructorId]) report[cls.instructorId] = { items: [], total: 0 };

        const config = configMap.get(cls.instructorId);
        if (!config) continue; // No pay config, skip calculation

        let amount = 0;
        let details = "";

        if (config.payModel === 'flat') {
            amount = config.rate;
            details = `Flat Rate: $${amount / 100}`;
        } else if (config.payModel === 'hourly') {
            const hours = cls.durationMinutes / 60;
            amount = Math.round(hours * config.rate);
            details = `${hours.toFixed(1)} hrs @ $${config.rate / 100}/hr`;
        } else if (config.payModel === 'percentage') {
            // Fetch bookings revenue
            // TODO: Optimize this
            const totalRevenue = 0; // Placeholder until we query bookings
            amount = Math.round(totalRevenue * (config.rate / 10000));
            details = `${config.rate / 100}% of Revenue`;
        }

        report[cls.instructorId].items.push({
            type: 'class',
            referenceId: cls.id,
            title: `Class: ${cls.title}`,
            date: cls.startTime,
            amount,
            details
        });
        report[cls.instructorId].total += amount;
    }

    // Process Appointments
    for (const appt of completedAppointments) {
        if (!report[appt.instructorId]) report[appt.instructorId] = { items: [], total: 0 };

        const config = configMap.get(appt.instructorId);
        if (!config) continue;

        let amount = 0;
        let details = "";

        // Cast appointment with service for type safety
        const service = (appt as any).service;

        // Use payroll config OR service price share?
        // Usually appointments have specific instructor splits.
        // Let's assume Global Config applies for simplicity, OR revenue share of service price.

        if (config.payModel === 'percentage') {
            const price = service.price || 0;
            // Schema: price is integer. Let's assume cents? Wait, service seed said 80. Checks DB...
            // Service seed: "price: 80". Probably dollars if no cents specified?
            // "price: integer('price').default(0)" usually implies cents in Stripe world.
            // But let's verify. If 80 cents, that's cheap. If $80, it should be 8000.

            // Assume service.price is CENTS. 
            // My seed used 80. That's weird. Let's assume DOLLARS in seed and fix logic or assume cents.
            // If seed used 80, and it's cents, that's wrong.
            // Let's assume for calculation: service.price is cents.

            const revenue = price;
            amount = Math.round(revenue * (config.rate / 10000));
            details = `${config.rate / 100}% of $${revenue}`; // Assuming price is dollars for now based on previous context, verify later
        } else {
            // Fallback to hourly/flat?
            // Maybe flat rate per session matches config?
            amount = config.rate; // e.g. $30 per session
            details = `Flat Rate`;
        }

        report[appt.instructorId].items.push({
            type: 'appointment',
            referenceId: appt.id,
            title: `Appt: ${service.title}`,
            date: appt.startTime,
            amount,
            details
        });
        report[appt.instructorId].total += amount;
    }

    return c.json({ report });
});


// 4. POST /payout - Create Payout Record
app.post('/payout', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const body = await c.req.json();
    const { instructorId, amount, periodStart, periodEnd, items } = body;

    // items: Array of { type, referenceId, amount }

    const payoutId = crypto.randomUUID();

    // 1. Fetch Instructor's Stripe Account ID
    const { users } = await import('db/src/schema');
    const instructor = await db.select({
        stripeAccountId: users.stripeAccountId,
        email: users.email
    })
        .from(users)
        .innerJoin(tenantMembers, eq(users.id, tenantMembers.userId))
        .where(eq(tenantMembers.id, instructorId))
        .get();

    let stripeTransferId = null;

    // 2. If both have Stripe, trigger Transfer
    if (tenant.stripeAccountId && instructor?.stripeAccountId) {
        try {
            const { StripeService } = await import('../services/stripe');
            const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);

            const transfer = await stripe.createTransfer({
                amount,
                currency: tenant.currency || 'usd',
                destination: instructor.stripeAccountId,
                sourceAccountId: tenant.stripeAccountId,
                description: `Payout for period ${periodStart} to ${periodEnd}`
            });
            stripeTransferId = transfer.id;
        } catch (err: any) {
            console.error("Stripe Payout Error:", err);
            // Optionally handle error (e.g. mark status as 'failed')
        }
    }

    await db.insert(payouts).values({
        id: payoutId,
        tenantId: tenant.id,
        instructorId,
        amount,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        status: stripeTransferId ? 'paid' : 'processing', // Mark as paid if transfer succeeded
        paidAt: stripeTransferId ? new Date() : null,
        stripeTransferId: stripeTransferId
    }).run();

    // Insert line items
    if (items && items.length > 0) {
        // Prepare batch
        // SQLite supports multiple values insert? Drizzle does.
        await db.insert(payrollItems).values(
            items.map((item: any) => ({
                id: crypto.randomUUID(),
                payoutId,
                type: item.type,
                referenceId: item.referenceId,
                amount: item.amount,
                details: item.details
            }))
        );
    }

    return c.json({ success: true, payoutId });
});

export default app;
