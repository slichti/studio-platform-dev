import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { createDb } from '../db';
import { challenges, userChallenges, tenants } from '@studio/db/src/schema';
import { ChallengeService } from '../services/challenges';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

app.get('/leaderboard', async (c) => {
    const db = createDb(c.env.DB);
    return c.json(await new ChallengeService(db, c.get('tenant')!.id).getLeaderboard());
});

app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const t = c.get('tenant')!;
    if (!['growth', 'scale'].includes(t.tier)) return c.json({ error: 'Disabled' }, 403);
    const results = await db.select().from(challenges).where(and(eq(challenges.tenantId, t.id), eq(challenges.active, true))).orderBy(desc(challenges.createdAt));

    const now = new Date();
    const mapped = results.map(ch => ({
        ...ch,
        status: !ch.active ? 'inactive' : (
            (ch.startDate && new Date(ch.startDate) > now) ? 'upcoming' :
                (ch.endDate && new Date(ch.endDate) < now) ? 'past' :
                    'active'
        )
    }));
    return c.json(mapped);
});

app.post('/', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const chan = await db.insert(challenges).values({ id: crypto.randomUUID(), tenantId: c.get('tenant')!.id, ...body, startDate: body.startDate ? new Date(body.startDate) : undefined, endDate: body.endDate ? new Date(body.endDate) : undefined, active: true }).returning().get();
    return c.json(chan);
});

app.get('/my-progress', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    if (!member) return c.json({ error: 'Unauthorized' }, 401);
    const active = await db.select().from(challenges).where(and(eq(challenges.tenantId, c.get('tenant')!.id), eq(challenges.active, true)));
    const prog = await db.select().from(userChallenges).where(and(eq(userChallenges.userId, member.userId), eq(userChallenges.tenantId, c.get('tenant')!.id)));
    const map = new Map(prog.map(p => [p.challengeId, p]));
    return c.json(active.map(ch => ({ ...ch, userProgress: map.get(ch.id) || { progress: 0, status: 'active' } })));
});

app.post('/:id/join', async (c) => {
    const member = c.get('member');
    if (!member) return c.json({ error: 'Unauthorized' }, 401);
    try {
        await new ChallengeService(createDb(c.env.DB), c.get('tenant')!.id).joinChallenge(member.userId, c.req.param('id'));
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: e.message }, 400); }
});

export default app;
