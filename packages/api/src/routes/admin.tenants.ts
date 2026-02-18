import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, tenantRoles, subscriptions, tenantFeatures, websitePages, auditLogs, users, userRelationships, emailLogs, locations, classes, bookings, products, posOrders, marketingAutomations, marketingCampaigns, waiverTemplates, waiverSignatures, studentNotes, uploads, usageLogs, appointmentServices, availabilities, appointments, payrollConfig, payouts, payrollItems, automationLogs, smsLogs, pushLogs, membershipPlans, classPackDefinitions, purchasedPacks, coupons, couponRedemptions, smsConfig, substitutions, suppliers, inventoryAdjustments, purchaseOrders, purchaseOrderItems, referralCodes, referralRewards, posOrderItems, giftCards, giftCardTransactions, leads, challenges, userChallenges, progressMetricDefinitions, memberProgressEntries, videos, waitlist, subRequests, videoShares, videoCollections, videoCollectionItems, brandingAssets, referrals, tags, tagAssignments, customFieldDefinitions, customFieldValues, communityPosts, communityComments, communityLikes, reviews, tasks, refunds, webhookEndpoints, webhookLogs, websiteSettings, chatRooms, chatMessages, customReports, scheduledReports, faqs, memberCustomRoles, classSeries, customRoles } from '@studio/db/src/schema';
import { eq, sql, desc, count, and, inArray, or, ne } from 'drizzle-orm';
import { AuditService } from '../services/audit';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /
app.get('/', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);

    const [all, owners, instructors, studentRoles, subs, feats] = await Promise.all([
        db.select().from(tenants).all(),
        db.select({ tenantId: tenantMembers.tenantId, c: count(tenantMembers.id) }).from(tenantMembers).innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId)).where(eq(tenantRoles.role, 'owner')).groupBy(tenantMembers.tenantId).all(),
        db.select({ tenantId: tenantMembers.tenantId, c: count(tenantMembers.id) }).from(tenantMembers).innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId)).where(eq(tenantRoles.role, 'instructor')).groupBy(tenantMembers.tenantId).all(),
        db.select({ tenantId: tenantMembers.tenantId, c: count(tenantMembers.id) }).from(tenantMembers).innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId)).where(eq(tenantRoles.role, 'student')).groupBy(tenantMembers.tenantId).all(),
        db.select({ tenantId: subscriptions.tenantId, c: count(subscriptions.id) }).from(subscriptions).where(eq(subscriptions.status, 'active')).groupBy(subscriptions.tenantId).all(),
        db.select().from(tenantFeatures).all()
    ]);

    const ownerMap = new Map(owners.map(o => [o.tenantId, o.c]));
    const instMap = new Map(instructors.map(i => [i.tenantId, i.c]));
    const studentMap = new Map(studentRoles.map(s => [s.tenantId, s.c]));
    const subMap = new Map(subs.map(s => [s.tenantId, s.c]));
    const featMap = new Map();
    feats.forEach(f => { if (!featMap.has(f.tenantId)) featMap.set(f.tenantId, {}); featMap.get(f.tenantId)[f.featureKey] = { enabled: f.enabled, source: f.source }; });

    return c.json(all.map(t => ({
        ...t,
        features: featMap.get(t.id) || {},
        stats: {
            owners: ownerMap.get(t.id) || 0,
            instructors: instMap.get(t.id) || 0,
            subscribers: subMap.get(t.id) || 0,
            totalStudents: studentMap.get(t.id) || 0,
            activeSubscribers: subMap.get(t.id) || 0
        }
    })));
});

// POST /
app.post('/', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const auth = c.get('auth')!;
    const { name, slug, tier } = await c.req.json();
    if (!name || !slug) return c.json({ error: "Required fields" }, 400);

    const id = crypto.randomUUID();
    try {
        await db.insert(tenants).values({ id, name, slug, tier: tier || 'launch', status: 'active', createdAt: new Date() }).run();
        const mid = crypto.randomUUID();
        await db.insert(tenantMembers).values({ id: mid, tenantId: id, userId: auth.userId, status: 'active' }).run();
        await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId: mid, role: 'owner' }).run();
        await db.insert(websitePages).values({ id: crypto.randomUUID(), tenantId: id, slug: 'home', title: 'Home', content: { root: { props: { title: "Welcome" }, children: [] } }, isPublished: true, createdAt: new Date(), updatedAt: new Date() }).run();
        return c.json({ id, name, slug }, 201);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// PUT /:id/status
app.put('/:id/status', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { status } = await c.req.json();
    await db.update(tenants).set({ status }).where(eq(tenants.id, c.req.param('id'))).run();

    const audit = new AuditService(db);
    await audit.log({
        actorId: c.get('auth')!.userId,
        action: 'update_status',
        targetId: c.req.param('id'),
        details: { status },
        ipAddress: c.req.header('CF-Connecting-IP')
    });

    return c.json({ success: true, status });
});

// PATCH /:id/tier
app.patch('/:id/tier', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const { tier } = await c.req.json();
    if (!['launch', 'growth', 'scale'].includes(tier)) return c.json({ error: 'Invalid tier' }, 400);

    await db.update(tenants).set({ tier }).where(eq(tenants.id, c.req.param('id'))).run();

    // Log audit
    const audit = new AuditService(db);
    await audit.log({
        actorId: c.get('auth')!.userId,
        action: 'update_tier',
        targetId: c.req.param('id'),
        details: { tier },
        ipAddress: c.req.header('CF-Connecting-IP')
    });

    return c.json({ success: true, tier });
});

// PATCH /:id/quotas
app.patch('/:id/quotas', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const body = await c.req.json();

    // Validate keys (basic security)
    const allowedKeys = ['sms_limit', 'email_limit', 'storage_limit', 'student_limit', 'instructor_limit', 'location_limit'];
    const invalidKeys = Object.keys(body).filter(k => !allowedKeys.includes(k));
    if (invalidKeys.length > 0) return c.json({ error: 'Invalid keys: ' + invalidKeys.join(', ') }, 400);

    // Fetch current settings or create empty object if null
    const t = await db.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, c.req.param('id'))).get();
    if (!t) return c.json({ error: 'Not found' }, 404);

    const currentSettings = (t.settings as any) || {};
    const quotas = (currentSettings.quotas || {});

    const newSettings = {
        ...currentSettings,
        quotas: {
            ...quotas,
            ...body
        }
    };

    await db.update(tenants).set({ settings: newSettings }).where(eq(tenants.id, c.req.param('id'))).run();

    return c.json({ success: true, settings: newSettings });
});

// POST /:id/lifecycle/archive
app.post('/:id/lifecycle/archive', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.req.param('id');

    // Soft delete: set status to archived, disable access
    await db.update(tenants).set({
        status: 'archived',
        studentAccessDisabled: true,
        archivedAt: new Date()
    }).where(eq(tenants.id, tid)).run();

    const audit = new AuditService(db);
    await audit.log({
        actorId: c.get('auth')!.userId,
        action: 'archive_tenant',
        targetId: tid,
        details: { status: 'archived' },
        ipAddress: c.req.header('CF-Connecting-IP')
    });

    return c.json({ success: true, status: 'archived' });
});

// POST /:id/lifecycle/restore
app.post('/:id/lifecycle/restore', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.req.param('id');

    await db.update(tenants).set({
        status: 'active',
        studentAccessDisabled: false,
        archivedAt: null
    }).where(eq(tenants.id, tid)).run();

    const audit = new AuditService(db);
    await audit.log({
        actorId: c.get('auth')!.userId,
        action: 'restore_tenant',
        targetId: tid,
        details: { status: 'active' },
        ipAddress: c.req.header('CF-Connecting-IP')
    });

    return c.json({ success: true, status: 'active' });
});

// DELETE /:id
app.delete('/:id', async (c) => {
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tid = c.req.param('id');
    const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tid) });
    if (!t) return c.json({ error: "Not found" }, 404);

    try {
        // --- MANUAL CASCADE DELETE (Reverse Dependency Order) ---

        // 1. Logs, Analytics & Security
        await db.delete(auditLogs).where(eq(auditLogs.tenantId, tid)).run().catch(() => { });
        await db.delete(emailLogs).where(eq(emailLogs.tenantId, tid)).run().catch(() => { });
        await db.delete(smsLogs).where(eq(smsLogs.tenantId, tid)).run().catch(() => { });
        await db.delete(pushLogs).where(eq(pushLogs.tenantId, tid)).run().catch(() => { });
        await db.delete(usageLogs).where(eq(usageLogs.tenantId, tid)).run().catch(() => { });
        await db.delete(automationLogs).where(eq(automationLogs.tenantId, tid)).run().catch(() => { });
        await db.delete(webhookLogs).where(eq(webhookLogs.tenantId, tid)).run().catch(() => { });

        // 2. Social, Reviews & Community
        await db.delete(communityLikes).where(inArray(communityLikes.postId, db.select({ id: communityPosts.id }).from(communityPosts).where(eq(communityPosts.tenantId, tid)))).run().catch(() => { });
        await db.delete(communityComments).where(inArray(communityComments.postId, db.select({ id: communityPosts.id }).from(communityPosts).where(eq(communityPosts.tenantId, tid)))).run().catch(() => { });
        await db.delete(communityPosts).where(eq(communityPosts.tenantId, tid)).run().catch(() => { });
        await db.delete(reviews).where(eq(reviews.tenantId, tid)).run().catch(() => { });

        // 3. CRM & Marketing
        await db.delete(tasks).where(eq(tasks.tenantId, tid)).run().catch(() => { });
        await db.delete(studentNotes).where(eq(studentNotes.tenantId, tid)).run().catch(() => { });
        await db.delete(leads).where(eq(leads.tenantId, tid)).run().catch(() => { });
        await db.delete(referralRewards).where(eq(referralRewards.tenantId, tid)).run().catch(() => { });
        await db.delete(referralCodes).where(eq(referralCodes.tenantId, tid)).run().catch(() => { });
        await db.delete(referrals).where(eq(referrals.tenantId, tid)).run().catch(() => { });
        await db.delete(marketingAutomations).where(eq(marketingAutomations.tenantId, tid)).run().catch(() => { });
        await db.delete(marketingCampaigns).where(eq(marketingCampaigns.tenantId, tid)).run().catch(() => { });

        // 4. Loyalty & Progress
        await db.delete(userChallenges).where(eq(userChallenges.tenantId, tid)).run().catch(() => { });
        await db.delete(challenges).where(eq(challenges.tenantId, tid)).run().catch(() => { });
        await db.delete(memberProgressEntries).where(eq(memberProgressEntries.tenantId, tid)).run().catch(() => { });
        await db.delete(progressMetricDefinitions).where(eq(progressMetricDefinitions.tenantId, tid)).run().catch(() => { });

        // 5. Commerce, Billing & Payroll
        await db.delete(refunds).where(eq(refunds.tenantId, tid)).run().catch(() => { });
        await db.delete(payrollItems).where(inArray(payrollItems.payoutId, db.select({ id: payouts.id }).from(payouts).where(eq(payouts.tenantId, tid)))).run().catch(() => { });
        await db.delete(payouts).where(eq(payouts.tenantId, tid)).run().catch(() => { });
        await db.delete(payrollConfig).where(eq(payrollConfig.tenantId, tid)).run().catch(() => { });
        await db.delete(giftCardTransactions).where(inArray(giftCardTransactions.giftCardId, db.select({ id: giftCards.id }).from(giftCards).where(eq(giftCards.tenantId, tid)))).run().catch(() => { });
        await db.delete(giftCards).where(eq(giftCards.tenantId, tid)).run().catch(() => { });
        await db.delete(couponRedemptions).where(eq(couponRedemptions.tenantId, tid)).run().catch(() => { });
        await db.delete(coupons).where(eq(coupons.tenantId, tid)).run().catch(() => { });
        await db.delete(purchasedPacks).where(eq(purchasedPacks.tenantId, tid)).run().catch(() => { });
        await db.delete(subscriptions).where(eq(subscriptions.tenantId, tid)).run().catch(() => { });

        // 6. Retail & Inventory
        await db.delete(posOrderItems).where(inArray(posOrderItems.orderId, db.select({ id: posOrders.id }).from(posOrders).where(eq(posOrders.tenantId, tid)))).run().catch(() => { });
        await db.delete(posOrders).where(eq(posOrders.tenantId, tid)).run().catch(() => { });
        await db.delete(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.tenantId, tid)))).run().catch(() => { });
        await db.delete(purchaseOrders).where(eq(purchaseOrders.tenantId, tid)).run().catch(() => { });
        await db.delete(inventoryAdjustments).where(eq(inventoryAdjustments.tenantId, tid)).run().catch(() => { });
        await db.delete(products).where(eq(products.tenantId, tid)).run().catch(() => { });
        await db.delete(suppliers).where(eq(suppliers.tenantId, tid)).run().catch(() => { });

        // 7. Scheduling & Bookings
        await db.delete(waitlist).where(eq(waitlist.tenantId, tid)).run().catch(() => { });
        await db.delete(subRequests).where(eq(subRequests.tenantId, tid)).run().catch(() => { });
        await db.delete(bookings).where(inArray(bookings.classId, db.select({ id: classes.id }).from(classes).where(eq(classes.tenantId, tid)))).run().catch(() => { });
        await db.delete(substitutions).where(eq(substitutions.tenantId, tid)).run().catch(() => { });
        await db.delete(classes).where(eq(classes.tenantId, tid)).run().catch(() => { });
        await db.delete(classSeries).where(eq(classSeries.tenantId, tid)).run().catch(() => { });
        await db.delete(appointments).where(eq(appointments.tenantId, tid)).run().catch(() => { });
        await db.delete(availabilities).where(eq(availabilities.tenantId, tid)).run().catch(() => { });
        await db.delete(appointmentServices).where(eq(appointmentServices.tenantId, tid)).run().catch(() => { });

        // 8. VOD & Assets
        await db.delete(videoCollectionItems).where(inArray(videoCollectionItems.collectionId, db.select({ id: videoCollections.id }).from(videoCollections).where(eq(videoCollections.tenantId, tid)))).run().catch(() => { });
        await db.delete(videoCollections).where(eq(videoCollections.tenantId, tid)).run().catch(() => { });
        await db.delete(videoShares).where(eq(videoShares.tenantId, tid)).run().catch(() => { });
        await db.delete(videos).where(eq(videos.tenantId, tid)).run().catch(() => { });
        await db.delete(brandingAssets).where(eq(brandingAssets.tenantId, tid)).run().catch(() => { });
        await db.delete(uploads).where(eq(uploads.tenantId, tid)).run().catch(() => { });

        // 9. Config, Pages & Website
        await db.delete(websitePages).where(eq(websitePages.tenantId, tid)).run().catch(() => { });
        await db.delete(websiteSettings).where(eq(websiteSettings.tenantId, tid)).run().catch(() => { });
        await db.delete(customFieldValues).where(eq(customFieldValues.tenantId, tid)).run().catch(() => { });
        await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.tenantId, tid)).run().catch(() => { });
        await db.delete(customReports).where(eq(customReports.tenantId, tid)).run().catch(() => { });
        await db.delete(scheduledReports).where(eq(scheduledReports.tenantId, tid)).run().catch(() => { });
        await db.delete(faqs).where(eq(faqs.tenantId, tid)).run().catch(() => { });
        await db.delete(smsConfig).where(eq(smsConfig.tenantId, tid)).run().catch(() => { });
        await db.delete(webhookEndpoints).where(eq(webhookEndpoints.tenantId, tid)).run().catch(() => { });
        await db.delete(waiverSignatures).where(inArray(waiverSignatures.memberId, db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.tenantId, tid)))).run().catch(() => { });
        await db.delete(waiverTemplates).where(eq(waiverTemplates.tenantId, tid)).run().catch(() => { });
        await db.delete(locations).where(eq(locations.tenantId, tid)).run().catch(() => { });
        await db.delete(tenantFeatures).where(eq(tenantFeatures.tenantId, tid)).run().catch(() => { });

        // 10. Communication (Chat)
        await db.delete(chatMessages).where(inArray(chatMessages.roomId, db.select({ id: chatRooms.id }).from(chatRooms).where(eq(chatRooms.tenantId, tid)))).run().catch(() => { });
        await db.delete(chatRooms).where(eq(chatRooms.tenantId, tid)).run().catch(() => { });

        // 11. Members & Roles (The core links)
        await db.delete(tagAssignments).where(inArray(tagAssignments.targetId, db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.tenantId, tid)))).run().catch(() => { });
        await db.delete(tags).where(eq(tags.tenantId, tid)).run().catch(() => { });
        await db.delete(tenantRoles).where(inArray(tenantRoles.memberId, db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.tenantId, tid)))).run().catch(() => { });
        await db.delete(memberCustomRoles).where(inArray(memberCustomRoles.memberId, db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.tenantId, tid)))).run().catch(() => { });
        await db.delete(customRoles).where(eq(customRoles.tenantId, tid)).run().catch(() => { });
        await db.delete(membershipPlans).where(eq(membershipPlans.tenantId, tid)).run().catch(() => { });
        await db.delete(classPackDefinitions).where(eq(classPackDefinitions.tenantId, tid)).run().catch(() => { });

        // 12. Collect user IDs BEFORE deleting tenantMembers
        // Find users who were members of this tenant
        const tenantUserIds = await db
            .select({ userId: tenantMembers.userId })
            .from(tenantMembers)
            .where(eq(tenantMembers.tenantId, tid))
            .all();

        const userIdsToCheck = tenantUserIds.map(r => r.userId);

        // Now delete tenantMembers
        await db.delete(tenantMembers).where(eq(tenantMembers.tenantId, tid)).run().catch(() => { });

        // 13. Cleanup orphaned global users
        // Delete users who are NOT platform admins AND have NO remaining tenant memberships
        if (userIdsToCheck.length > 0) {
            const CHUNK_SIZE = 50; // Conservative chunk size for IN clauses
            const usersWithOtherMemberships = new Set<string>();
            const platformAdminIds = new Set<string>();

            // Process checks in chunks
            for (let i = 0; i < userIdsToCheck.length; i += CHUNK_SIZE) {
                const chunk = userIdsToCheck.slice(i, i + CHUNK_SIZE);

                // Check other memberships
                const otherMembers = await db
                    .selectDistinct({ userId: tenantMembers.userId })
                    .from(tenantMembers)
                    .where(inArray(tenantMembers.userId, chunk))
                    .all();
                otherMembers.forEach(m => usersWithOtherMemberships.add(m.userId));

                // Check platform admins
                const admins = await db
                    .select({ id: users.id })
                    .from(users)
                    .where(
                        and(
                            inArray(users.id, chunk),
                            or(
                                eq(users.isPlatformAdmin, true),
                                inArray(users.role, ['admin', 'owner'])
                            )
                        )
                    )
                    .all();
                admins.forEach(a => platformAdminIds.add(a.id));
            }

            // Calculate users to delete
            const usersToDelete = userIdsToCheck.filter(id =>
                !usersWithOtherMemberships.has(id) && !platformAdminIds.has(id)
            );

            if (usersToDelete.length > 0) {
                console.log(`Deleting ${usersToDelete.length} orphaned users...`);

                // Delete in chunks
                for (let i = 0; i < usersToDelete.length; i += CHUNK_SIZE) {
                    const chunk = usersToDelete.slice(i, i + CHUNK_SIZE);

                    // Delete relationships
                    await db.delete(userRelationships)
                        .where(or(
                            inArray(userRelationships.parentUserId, chunk),
                            inArray(userRelationships.childUserId, chunk)
                        ))
                        .run()
                        .catch(() => { });

                    // Delete users
                    await db.delete(users)
                        .where(inArray(users.id, chunk))
                        .run()
                        .catch(() => { });
                }

                console.log(`Cleaned up ${usersToDelete.length} orphaned users`);
            }
        }

        // R2 Cleanup
        c.executionCtx.waitUntil((async () => {
            try {
                const { StorageService } = await import('../services/storage');
                const ss = new StorageService(c.env.R2!);
                // Delete everything under tenants/{slug}/
                await ss.deleteDirectory(`tenants/${t.slug}/`);
                console.log(`Cleaned up R2 for tenant ${t.slug}`);
            } catch (e) {
                console.error("Failed to clean up R2", e);
            }
        })());

        // 12. Finally: The Tenant
        await db.delete(tenants).where(eq(tenants.id, tid)).run();

        const audit = new AuditService(db);
        await audit.log({
            actorId: c.get('auth')!.userId,
            action: 'delete_tenant',
            targetId: tid,
            details: { name: t.name, slug: t.slug },
            ipAddress: c.req.header('CF-Connecting-IP')
        });

        return c.json({ success: true });
    } catch (e: any) {
        console.error("Delete failed", e);
        return c.json({ error: "Failed to delete tenant: " + e.message }, 500);
    }
});

// POST /seed - Dev only
app.post('/seed', async (c) => {
    // Strict Platform Admin Check
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const body = await c.req.json().catch(() => ({})); // Optional body

    try {
        const { seedTenant } = await import('../utils/seeding');
        const result = await seedTenant(db, body);
        return c.json({ success: true, tenant: result });
    } catch (e: any) {
        console.error("Seeding failed", e);
        return c.json({ error: e.message }, 500);
    }
});

// POST /admin/tenants/:id/export - Export complete tenant data (GDPR Compliance)
app.post('/:id/export', async (c) => {
    // Strict Platform Admin Check
    const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Unauthorized - Platform admin only' }, 403);

    const tenantId = c.req.param('id');
    const db = createDb(c.env.DB);

    try {
        console.log(`📥 Exporting data for tenant: ${tenantId}`);

        // Fetch tenant
        const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
        if (!tenant) {
            return c.json({ error: 'Tenant not found' }, 404);
        }

        // Export all tenant-related data
        const exportData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                tenantId,
                tenantName: tenant.name,
                version: '1.0'
            },
            tenant,
            members: await db.select().from(tenantMembers).where(eq(tenantMembers.tenantId, tenantId)).all(),
            classes: await db.select().from(classes).where(eq(classes.tenantId, tenantId)).all(),
            bookings: await db.select().from(bookings)
                .innerJoin(classes, eq(bookings.classId, classes.id))
                .where(eq(classes.tenantId, tenantId))
                .all(),
            // Add all other tenant-related tables as needed
        };

        const filename = `tenant-${tenant.slug}-export-${Date.now()}.json`;

        c.header('Content-Type', 'application/json');
        c.header('Content-Disposition', `attachment; filename="${filename}"`);

        return c.json(exportData);
    } catch (e: any) {
        console.error('Export failed', e);
        return c.json({ error: 'Failed to export tenant data: ' + e.message }, 500);
    }
});

export default app;
