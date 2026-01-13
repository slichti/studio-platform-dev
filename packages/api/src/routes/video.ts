import { Hono } from 'hono';
import { AccessToken, WebhookReceiver } from 'livekit-server-sdk';
import { createDb } from '../db';
import { classes, tenantMembers, users } from 'db/src/schema';
import { eq, and } from 'drizzle-orm';

const app = new Hono<{ Bindings: any, Variables: any }>();

// Generate Token for a Class
app.post('/token', async (c) => {
    const { classId, isInstructor } = await c.req.json();
    const tenant = c.get('tenant');
    const user = c.get('user'); // Global user from auth middleware

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const db = createDb(c.env.DB);

    // 1. Verify Class Exists
    const targetClass = await db.select().from(classes)
        .where(and(eq(classes.id, classId), eq(classes.tenantId, tenant.id)))
        .get();

    if (!targetClass) return c.json({ error: "Class not found" }, 404);
    if (targetClass.videoProvider !== 'livekit') {
        return c.json({ error: "This class is not configured for LiveKit" }, 400);
    }

    // 2. Determine Participant Identity & Name
    let participantIdentity = user.id;
    let participantName = user.profile?.firstName || "User";

    // 3. Create Token
    const at = new AccessToken(c.env.LIVEKIT_API_KEY, c.env.LIVEKIT_API_SECRET, {
        identity: participantIdentity,
        name: participantName,
    });

    // 4. Set Permissions
    at.addGrant({
        roomJoin: true,
        room: targetClass.livekitRoomName || `class-${classId}`,
        canPublish: isInstructor, // Instructors can publish video/audio
        canSubscribe: true,
        canPublishData: true,
    });

    return c.json({ token: at.toJwt() });
});

// Webhook for Room Finished (VOD Automation)
app.post('/webhook', async (c) => {
    const Receiver = new WebhookReceiver(c.env.LIVEKIT_API_KEY, c.env.LIVEKIT_API_SECRET);
    const body = await c.req.text();
    const authHeader = c.req.header('Authorization');

    try {
        const event = await Receiver.receive(body, authHeader);

        if (event.event === 'egress_ended' || event.event === 'room_finished') {
            // Trigger Cloudflare Stream Upload Logic Here
            console.log("LiveKit Webhook Received:", event);
        }

        return c.text('OK');
    } catch (e) {
        return c.text('Invalid signature', 401);
    }
});

export default app;
