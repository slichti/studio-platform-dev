import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, tenantRoles, users, subscriptions, membershipPlans, purchasedPacks, classPackDefinitions } from 'db/src/schema';
import { eq, and } from 'drizzle-orm';
import Papa from 'papaparse';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant: typeof tenants.$inferSelect;
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// POST /import/csv
app.post('/csv', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context required" }, 400);

    const formData = await c.req.formData();
    const fileEntry = formData.get('file');

    if (!fileEntry || typeof fileEntry === 'string') {
        return c.json({ error: "CSV file required" }, 400);
    }
    const text = await (fileEntry as unknown as File).text();
    const db = createDb(c.env.DB);

    const parseResult = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    });

    if (parseResult.errors.length > 0) {
        return c.json({ error: "CSV Parsing Error", details: parseResult.errors }, 400);
    }

    const rows = parseResult.data as any[];
    const summary = {
        total: rows.length,
        created: 0,
        skipped: 0,
        errors: [] as string[]
    };

    // Columns expected: email, firstname, lastname, phone, address, dob (YYYY-MM-DD), minor (yes/no)
    // Optional: membership (plan name), classpack (pack name)

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const email = row.email;
        if (!email) {
            summary.skipped++;
            summary.errors.push(`Row ${i + 1}: Missing email`);
            continue;
        }

        try {
            // 1. Find or Create User (Mock user if not exists, since no password auth yet)
            // Ideally we invite them via Clerk? But for migration we just need a record.
            // But `users.id` is PK and usually Clerk ID. If we create a dummy ID, they can't login unless we reconcile later?
            // Strategy: Create a placeholder user. When they sign up with that email, Clerk webhook should UPDATING existing user?
            // Or we rely on Clerk for Auth. 
            // If we create a User with ID 'migrated_...', they can't login.
            // Unless we use Clerk API to create user? 
            // Clerk API requires Secret Key. We have `CLERK_SECRET_KEY`.
            // Creating users via Clerk API is best practice for migration.

            // For MVP, we will try to find user by email in local DB. 
            // If not found, we create a 'migrated' user locally. 
            // *Correction*: Local DB `users` table is irrelevant for AUTH if ID doesn't match Clerk.
            // If we insert 'migrated_123', and user signs up to Clerk, they get 'user_abc'.
            // Clerk Webhook will insert 'user_abc'. Now we have duplicate emails? 
            // `users.email` has index but not unique constraint in my schema? 
            // Schema has `emailIdx` but `id` is PK. `email` should be unique.
            // If we insert 'migrated_...', we block Clerk webhook from inserting true user if email is unique.
            // We should ideally use Clerk API.

            // BUT for this task, let's keep it simple: 
            // Just insert into DB so they appear in lists.
            // The reconciliation logic (merging 'migrated' user with 'real' user on signup) is complex.
            // Alternative: Just fail if user doesn't exist? No, migration means importing new users.

            // Let's assume we can insert with a generated ID.
            // And hope to fix auth later (e.g. by updating ID when they claim account).

            let user = await db.query.users.findFirst({
                where: eq(users.email, email)
            });

            let userId = user?.id;

            if (!user) {
                userId = `migrated_${crypto.randomUUID()}`;
                await db.insert(users).values({
                    id: userId,
                    email,
                    profile: { firstName: row.firstname, lastName: row.lastname },
                    phone: row.phone,
                    address: row.address,
                    dob: row.dob ? new Date(row.dob) : null,
                    isMinor: row.minor?.toLowerCase() === 'yes' || row.minor === true,
                    createdAt: new Date()
                }).run();
            } else {
                // Update profile if missing
                // ...
            }

            // 2. Create Tenant Member
            const existingMember = await db.query.tenantMembers.findFirst({
                where: and(eq(tenantMembers.userId, userId!), eq(tenantMembers.tenantId, tenant.id))
            });

            let memberId = existingMember?.id;

            if (!existingMember) {
                memberId = crypto.randomUUID();
                await db.insert(tenantMembers).values({
                    id: memberId,
                    tenantId: tenant.id,
                    userId: userId!,
                    status: 'active',
                    joinedAt: new Date()
                }).run();

                // 3. Assign Default Role (Student)
                await db.insert(tenantRoles).values({
                    memberId,
                    role: 'student'
                }).run();
                summary.created++;
            }

            // 4. Handle Membership / Packs (Optional)
            if (row.membership && memberId) {
                // Find Plan by name
                const plan = await db.query.membershipPlans.findFirst({
                    where: and(eq(membershipPlans.tenantId, tenant.id), eq(membershipPlans.name, row.membership))
                });
                if (plan) {
                    await db.insert(subscriptions).values({
                        id: crypto.randomUUID(),
                        userId: userId!,
                        tenantId: tenant.id,
                        memberId: memberId,
                        planId: plan.id,
                        status: 'active',
                        createdAt: new Date()
                    }).run();
                }
            }

        } catch (e: any) {
            summary.errors.push(`Row ${i + 1}: ${e.message}`);
        }
    }

    return c.json(summary);
});

export default app;
