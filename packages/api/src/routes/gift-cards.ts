import { Hono } from 'hono';
import { giftCards, giftCardTransactions, tenantMembers, users } from '@studio/db/src/schema';
import { EmailService } from '../services/email';
import { createDb } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const member = c.get('member');
    let cond = eq(giftCards.tenantId, tenant.id);
    if (!c.get('can')('manage_commerce')) {
        if (!member) return c.json({ error: 'Unauthorized' }, 401);
        cond = and(cond, eq(giftCards.recipientMemberId, member.id)) as any;
    }
    return c.json({ giftCards: await db.query.giftCards.findMany({ where: cond, with: { buyer: { with: { user: true } } }, orderBy: [sql`${giftCards.createdAt} desc`] }) });
});

// GET /validate/:code
app.get('/validate/:code', async (c) => {
    const db = createDb(c.env.DB);
    const card = await db.query.giftCards.findFirst({ where: and(eq(giftCards.tenantId, c.get('tenant')!.id), eq(giftCards.code, c.req.param('code').toUpperCase()), eq(giftCards.status, 'active')) });
    if (!card || (card.expiryDate && new Date(card.expiryDate) < new Date())) return c.json({ error: 'Invalid or expired' }, 404);
    return c.json({ id: card.id, code: card.code, balance: card.currentBalance, status: card.status });
});

// POST /issue
app.post('/issue', async (c) => {
    if (!c.get('can')('manage_commerce')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { amount, buyerMemberId, recipientEmail, notes, expiryDate } = await c.req.json();
    if (!amount || amount <= 0) return c.json({ error: 'Amount error' }, 400);

    const id = crypto.randomUUID();
    const code = `GIFT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    let rid = null;
    if (recipientEmail) {
        const u = await db.query.users.findFirst({ where: eq(users.email, recipientEmail) });
        if (u) rid = (await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, u.id), eq(tenantMembers.tenantId, tenant.id)) }))?.id;
    }

    await db.batch([
        db.insert(giftCards).values({ id, tenantId: tenant.id, code, initialValue: amount, currentBalance: amount, buyerMemberId, recipientMemberId: rid, recipientEmail, notes, expiryDate: expiryDate ? new Date(expiryDate) : null, status: 'active' }),
        db.insert(giftCardTransactions).values({ id: crypto.randomUUID(), giftCardId: id, amount, type: 'purchase', createdAt: new Date() })
    ]);

    if (recipientEmail && c.env.RESEND_API_KEY) {
        try {
            const es = new EmailService(c.env.RESEND_API_KEY as string, tenant as any, undefined, undefined, false, db, tenant.id);
            await es.sendGenericEmail(recipientEmail, `Gift Card from ${tenant.name}`, `<p>$${(amount / 100).toFixed(2)} Credit: ${code}</p>`);
        } catch (e) { console.error(e); }
    }
    return c.json({ id, code });
});

// POST /redeem
app.post('/redeem', async (c) => {
    const db = createDb(c.env.DB);
    const { code, amount, referenceId } = await c.req.json();
    const card = await db.query.giftCards.findFirst({ where: and(eq(giftCards.tenantId, c.get('tenant')!.id), eq(giftCards.code, code.toUpperCase()), eq(giftCards.status, 'active')) });
    if (!card || card.currentBalance < amount) return c.json({ error: 'Invalid or insufficient' }, 400);

    const bal = card.currentBalance - amount;
    await db.batch([
        db.update(giftCards).set({ currentBalance: bal, status: bal === 0 ? 'exhausted' : 'active', updatedAt: new Date() }).where(eq(giftCards.id, card.id)),
        db.insert(giftCardTransactions).values({ id: crypto.randomUUID(), giftCardId: card.id, amount: -amount, type: 'redemption', referenceId, createdAt: new Date() })
    ]);
    return c.json({ success: true, balance: bal });
});

export default app;
