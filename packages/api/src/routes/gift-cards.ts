import { Hono } from 'hono';
import { giftCards, giftCardTransactions, tenants, tenantMembers } from 'db/src/schema';
import { createDb } from '../db';
import { eq, and, sql } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: any;
    roles?: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET / - List gift cards (Admin only)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!roles.includes('owner')) return c.json({ error: 'Unauthorized' }, 403);

    const giftCardsList = await db.query.giftCards.findMany({
        where: eq(giftCards.tenantId, tenant.id),
        with: {
            buyer: {
                with: {
                    user: true
                }
            }
        },
        orderBy: (gc, { desc }) => [desc(gc.createdAt)]
    });

    return c.json(giftCardsList);
});

// GET /validate/:code - Public check
app.get('/validate/:code', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const code = c.req.param('code').toUpperCase();

    const card = await db.query.giftCards.findFirst({
        where: and(
            eq(giftCards.tenantId, tenant.id),
            eq(giftCards.code, code),
            eq(giftCards.status, 'active')
        )
    });

    if (!card) return c.json({ error: 'Invalid or inactive gift card' }, 404);
    if (card.expiryDate && new Date(card.expiryDate) < new Date()) {
        return c.json({ error: 'Gift card has expired' }, 400);
    }

    return c.json({
        id: card.id,
        code: card.code,
        balance: card.currentBalance,
        status: card.status
    });
});

// POST /issue - Create a new gift card
app.post('/issue', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!roles.includes('owner') && !roles.includes('instructor')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    const { amount, buyerMemberId, recipientEmail, notes, expiryDate } = await c.req.json();
    if (!amount || amount <= 0) return c.json({ error: 'Invalid amount' }, 400);

    const id = crypto.randomUUID();
    // Generate a readable code: GIFT-XXXX-XXXX
    const code = `GIFT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await db.batch([
        db.insert(giftCards).values({
            id,
            tenantId: tenant.id,
            code,
            initialValue: amount,
            currentBalance: amount,
            buyerMemberId,
            recipientEmail,
            notes,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            status: 'active'
        }),
        db.insert(giftCardTransactions).values({
            id: crypto.randomUUID(),
            giftCardId: id,
            amount,
            type: 'purchase',
            createdAt: new Date()
        })
    ]);

    return c.json({ id, code, amount });
});

// POST /redeem - Apply balance to a payment
app.post('/redeem', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { code, amount, referenceId } = await c.req.json();

    if (!code || !amount || amount <= 0) return c.json({ error: 'Invalid input' }, 400);

    // 1. Find and Lock
    const card = await db.query.giftCards.findFirst({
        where: and(
            eq(giftCards.tenantId, tenant.id),
            eq(giftCards.code, code.toUpperCase()),
            eq(giftCards.status, 'active')
        )
    });

    if (!card) return c.json({ error: 'Invalid gift card' }, 404);
    if (card.currentBalance < amount) return c.json({ error: 'Insufficient balance' }, 400);

    const newBalance = card.currentBalance - amount;
    const newStatus = newBalance === 0 ? 'exhausted' : 'active';

    try {
        await db.batch([
            db.update(giftCards)
                .set({
                    currentBalance: newBalance,
                    status: newStatus,
                    updatedAt: new Date()
                })
                .where(eq(giftCards.id, card.id)),
            db.insert(giftCardTransactions).values({
                id: crypto.randomUUID(),
                giftCardId: card.id,
                amount: -amount,
                type: 'redemption',
                referenceId,
                createdAt: new Date()
            })
        ]);

        return c.json({ success: true, balance: newBalance, status: newStatus });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PATCH /:id - Admin update (e.g. disable)
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const id = c.req.param('id');

    if (!roles.includes('owner')) return c.json({ error: 'Unauthorized' }, 403);

    const { status, notes } = await c.req.json();
    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (notes) updateData.notes = notes;

    await db.update(giftCards)
        .set(updateData)
        .where(and(eq(giftCards.id, id), eq(giftCards.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

export default app;
