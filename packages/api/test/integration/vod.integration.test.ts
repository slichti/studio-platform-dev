import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';
import { StripeWebhookHandler } from '../../src/services/stripe-webhook';
import { setupTestDb } from './test-utils';

// Mock EmailService
vi.mock('../../src/services/email', () => {
    return {
        EmailService: vi.fn().mockImplementation(() => ({
            sendGenericEmail: vi.fn().mockResolvedValue({ id: 'mock_email_id' }),
        }))
    };
});

// Mock StreamService.getSignedToken
vi.mock('../../src/services/stream', () => {
    return {
        StreamService: vi.fn().mockImplementation(() => ({
            getSignedToken: vi.fn().mockResolvedValue('signed_playback_token_123'),
        }))
    };
});

describe('VOD Monetization (Integration)', () => {
    const TENANT_ID = 'vod_tenant';
    const USER_ID = 'vod_user';
    const GUEST_EMAIL = 'guest@vod.com';
    const CLASS_ID = 'vod_class_1';
    const VIDEO_ID = 'stream_uid_123';

    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // 1. Setup Tenant
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            name: 'VOD Studio',
            slug: 'vod-studio',
            currency: 'usd'
        }).onConflictDoNothing().run();

        // 2. Setup Sellable Class with Recording
        await db.insert(schema.classes).values({
            id: CLASS_ID,
            tenantId: TENANT_ID,
            title: 'Masterclass: VOD Monetization',
            startTime: new Date(),
            durationMinutes: 60,
            cloudflareStreamId: VIDEO_ID,
            recordingStatus: 'ready',
            isRecordingSellable: true,
            recordingPrice: 1900 // $19.00
        }).onConflictDoNothing().run();
    });

    it('should list catchable recordings in the public video library', async () => {
        const res = await SELF.fetch(`http://localhost/guest/videos/vod-studio`);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.videos).toHaveLength(1);
        expect(data.videos[0].id).toBe(CLASS_ID);
        expect(data.videos[0].recordingPrice).toBe(1900);
    });

    it('should full workflow: fulfill purchase and then grant access (with multi-video content)', async () => {
        const handler = new StripeWebhookHandler(env);
        const COLLECTION_ID = 'vod_collection_1';
        const EXTRA_VIDEO_ID = 'extra_stream_456';

        // 1. Setup Collection Content
        await db.insert(schema.videoCollections).values({
            id: COLLECTION_ID,
            tenantId: TENANT_ID,
            title: 'Supplementary Materials',
            slug: 'extra-content'
        }).run();

        await db.insert(schema.videos).values({
            id: 'extra_v1',
            tenantId: TENANT_ID,
            title: 'Supplementary Video 1',
            cloudflareStreamId: EXTRA_VIDEO_ID,
            r2Key: 'mock',
            status: 'ready'
        }).run();

        await db.insert(schema.videoCollectionItems).values({
            id: 'item_1',
            collectionId: COLLECTION_ID,
            videoId: 'extra_v1',
            order: 1
        }).run();

        // Link class to collection
        await db.update(schema.classes)
            .set({ contentCollectionId: COLLECTION_ID })
            .where(eq(schema.classes.id, CLASS_ID))
            .run();

        // 2. Mock Checkout Session completed for a GUEST
        const event: any = {
            id: 'evt_vod_full_1',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'cs_vod_full_1',
                    payment_intent: 'pi_vod_full_1',
                    amount_total: 1900,
                    customer_details: { email: GUEST_EMAIL, name: 'Full Test User' },
                    metadata: {
                        tenantId: TENANT_ID,
                        type: 'recording_purchase',
                        recordingId: CLASS_ID,
                        userId: 'guest'
                    }
                }
            }
        };

        await handler.process(event);

        // 3. Verify Access returns BOTH videos
        const user = await db.query.users.findFirst({ where: eq(schema.users.email, GUEST_EMAIL) });
        const res = await SELF.fetch(`http://localhost/classes/${CLASS_ID}/recording`, {
            headers: {
                'TEST-AUTH': user.id,
                'X-Tenant-Id': TENANT_ID
            }
        });

        const data = await res.json() as any;
        expect(res.status).toBe(200);
        expect(data.videos).toHaveLength(2);

        // Primary Recording
        expect(data.videos[0].title).toBe('Class Recording');
        expect(data.videos[0].videoId).toBe('signed_playback_token_123');

        // Supplementary Video
        expect(data.videos[1].title).toBe('Supplementary Video 1');
        expect(data.videos[1].videoId).toBe('signed_playback_token_123'); // Both mocked to same value
    });

    it('should deny access if recording is not purchased', async () => {
        const res = await SELF.fetch(`http://localhost/classes/${CLASS_ID}/recording`, {
            headers: {
                'TEST-AUTH': 'thief_2',
                'X-Tenant-Id': TENANT_ID
            }
        });

        expect(res.status).toBe(403);
    });

    it('should deny access to a COURSE for a member with VOD access but NO booking', async () => {
        const COURSE_ID = 'course_101';
        const MEMBER_ID = 'member_with_vod_123';
        const USER_ID = 'user_with_vod_456';
        const PLAN_ID = 'plan_with_vod';

        // 1. Setup Member with VOD enabled plan
        await db.insert(schema.users).values({ id: USER_ID, email: 'vod_member@test.com' }).run();
        await db.insert(schema.tenantMembers).values({ id: MEMBER_ID, tenantId: TENANT_ID, userId: USER_ID }).run();
        await db.insert(schema.membershipPlans).values({ id: PLAN_ID, tenantId: TENANT_ID, name: 'VOD Plan', vodEnabled: true }).run();
        await db.insert(schema.subscriptions).values({ id: 'sub_1', userId: USER_ID, tenantId: TENANT_ID, planId: PLAN_ID, status: 'active', currentPeriodEnd: new Date(Date.now() + 86400000) }).run();

        // 2. Setup Course
        await db.insert(schema.classes).values({
            id: COURSE_ID,
            tenantId: TENANT_ID,
            title: 'Premium Course',
            startTime: new Date(),
            durationMinutes: 60,
            cloudflareStreamId: 'vid888',
            isCourse: true // CRITICAL: This makes it a Course
        }).run();

        // 3. Verify member is DENIED (because it's a Course)
        const res = await SELF.fetch(`http://localhost/classes/${COURSE_ID}/recording`, {
            headers: {
                'TEST-AUTH': USER_ID,
                'X-Tenant-Id': TENANT_ID
            }
        });

        expect(res.status).toBe(403); // Access denied even with VOD membership
    });
});
