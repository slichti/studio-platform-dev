import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, tenantRoles, users, subscriptions, membershipPlans, purchasedPacks, classPackDefinitions, classes, locations } from '@studio/db/src/schema';
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

    // Check for Class Import headers
    const headers = parseResult.meta.fields || [];
    const isClassImport = headers.includes('title') && (headers.includes('starttime') || headers.includes('start_time')); // normalized headers logic might need checking

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (isClassImport) {
            // --- CLASS IMPORT ---
            const title = row.title;
            const startTimeStr = row.starttime || row.start_time;

            if (!title || !startTimeStr) {
                summary.skipped++;
                summary.errors.push(`Row ${i + 1}: Missing title or start_time`);
                continue;
            }

            try {
                // Find Instructor
                const instructorEmail = row.instructoremail || row.instructor_email;
                let instructorId: string | null = null;

                if (instructorEmail) {
                    const instructorUser = await db.query.users.findFirst({
                        where: eq(users.email, instructorEmail)
                    });
                    if (instructorUser) {
                        const member = await db.query.tenantMembers.findFirst({
                            where: and(eq(tenantMembers.userId, instructorUser.id), eq(tenantMembers.tenantId, tenant.id))
                        });
                        instructorId = member?.id || null;
                    }
                } else {
                    // Default to first owner/instructor if needed? No, fail.
                    summary.errors.push(`Row ${i + 1}: Missing instructor_email`);
                    continue;
                }


                if (!instructorId) {
                    summary.errors.push(`Row ${i + 1}: Instructor not found for email ${instructorEmail}`);
                    continue;
                }

                // Find Location
                const locationName = row.location;
                let locationId: string | null = null;
                if (locationName) {
                    const loc = await db.query.locations.findFirst({
                        where: and(eq(locations.tenantId, tenant.id), eq(locations.name, locationName))
                    });
                    locationId = loc?.id || null;
                }

                await db.insert(classes).values({
                    id: crypto.randomUUID(),
                    tenantId: tenant.id,
                    instructorId: instructorId,
                    locationId: locationId,
                    title: title,
                    description: row.description,
                    startTime: new Date(startTimeStr),
                    durationMinutes: parseInt(row.duration || '60'),
                    capacity: row.capacity ? parseInt(row.capacity) : 20,
                    price: row.price ? Math.round(parseFloat(row.price) * 100) : 0,
                    status: 'active',
                    createdAt: new Date()
                }).run();
                summary.created++;

            } catch (e: any) {
                summary.errors.push(`Row ${i + 1}: ${e.message}`);
            }

            continue;
        }

        // --- USER / MEMBER IMPORT (Existing Logic) ---
        const email = row.email;
        if (!email) {
            summary.skipped++;
            summary.errors.push(`Row ${i + 1}: Missing email`);
            continue;
        }

        try {
            // 1. Find or Create User
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
                // Update profile if missing or overwrite with CSV data
                const updatedProfile = { ...(user.profile || {}), firstName: row.firstname || (user.profile as any)?.firstName, lastName: row.lastname || (user.profile as any)?.lastName };
                const updateData: any = {};
                if (row.firstname || row.lastname) updateData.profile = updatedProfile;
                if (row.phone) updateData.phone = row.phone;
                if (row.address) updateData.address = row.address;
                if (row.dob) updateData.dob = new Date(row.dob);
                if (row.minor) updateData.isMinor = row.minor?.toLowerCase() === 'yes' || row.minor === true;

                if (Object.keys(updateData).length > 0) {
                    await db.update(users).set(updateData).where(eq(users.id, userId!)).run();
                }
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

            // 4. Handle Membership
            if (row.membership && memberId) {
                const plan = await db.query.membershipPlans.findFirst({
                    where: and(eq(membershipPlans.tenantId, tenant.id), eq(membershipPlans.name, row.membership))
                });
                if (plan) {
                    const existingSub = await db.query.subscriptions.findFirst({
                        where: and(eq(subscriptions.userId, userId!), eq(subscriptions.tenantId, tenant.id), eq(subscriptions.status, 'active'))
                    });

                    if (!existingSub) {
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
                } else {
                    summary.errors.push(`Row ${i + 1}: Membership plan '${row.membership}' not found.`);
                }
            }

            // 5. Handle Class Packs
            if (row.classpack && memberId) {
                const packDef = await db.query.classPackDefinitions.findFirst({
                    where: and(eq(classPackDefinitions.tenantId, tenant.id), eq(classPackDefinitions.name, row.classpack))
                });

                if (packDef) {
                    await db.insert(purchasedPacks).values({
                        id: crypto.randomUUID(),
                        tenantId: tenant.id,
                        memberId: memberId,
                        packDefinitionId: packDef.id,
                        initialCredits: packDef.credits,
                        remainingCredits: packDef.credits,
                        price: 0, // Imported packs usually free or paid externally
                        createdAt: new Date()
                    }).run();
                } else {
                    summary.errors.push(`Row ${i + 1}: Class pack '${row.classpack}' not found.`);
                }
            }

        } catch (e: any) {
            summary.errors.push(`Row ${i + 1}: ${e.message}`);
        }
    }

    return c.json(summary);
});

export default app;
