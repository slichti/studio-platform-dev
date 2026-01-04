import { Hono } from 'hono';
import { giftCards, giftCardTransactions, tenants, tenantMembers, users } from 'db/src/schema';
import { EmailService } from '../services/email';
import { createDb } from '../db';
import { eq, and, sql } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
    RESEND_API_KEY: string;
};


type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: any;
    roles?: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET / - List gift cards (Admin only)
// GET / - List gift cards (Admin: All, Student: Theirs)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const member = c.get('member');

    let whereClause = eq(giftCards.tenantId, tenant.id) as any;

    if (!roles.includes('owner') && !roles.includes('instructor')) {
        // If student, only show cards they received or bought?
        // Usually "My Gift Cards" means cards I can spend (recipient).
        // Cards I bought for others might be in "Order History".
        // Let's show cards where recipientMemberId is me OR recipientEmail is my email.
        if (!member) return c.json({ error: 'Unauthorized' }, 401);

        whereClause = and(
            eq(giftCards.tenantId, tenant.id),
            eq(giftCards.recipientMemberId, member.id)
        );
    }

    const giftCardsList = await db.query.giftCards.findMany({
        where: whereClause,
        with: {
            buyer: {
                with: {
                    user: true
                }
            }
        },
        orderBy: (gc, { desc }) => [desc(gc.createdAt)]
    });

    return c.json({ giftCards: giftCardsList });
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

    const { amount, buyerMemberId, recipientEmail, recipientName, notes, expiryDate } = await c.req.json();
    if (!amount || amount <= 0) return c.json({ error: 'Invalid amount' }, 400);

    const id = crypto.randomUUID();
    // Generate a readable code: GIFT-XXXX-XXXX
    const code = `GIFT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 1. Try to find existing member to link
    let recipientMemberId = null;
    if (recipientEmail) {
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, recipientEmail)
        });
        if (existingUser) {
            const existingMember = await db.query.tenantMembers.findFirst({
                where: and(
                    eq(tenantMembers.userId, existingUser.id),
                    eq(tenantMembers.tenantId, tenant.id)
                )
            });
            if (existingMember) recipientMemberId = existingMember.id;
        }
    }

    await db.batch([
        db.insert(giftCards).values({
            id,
            tenantId: tenant.id,
            code,
            initialValue: amount,
            currentBalance: amount,
            buyerMemberId,
            recipientMemberId, // Link to account if found
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

    // 2. Send Email Notification
    if (recipientEmail) {
        try {
            const emailService = new EmailService(c.env.RESEND_API_KEY, tenant as any);
            await emailService.sendGenericEmail(
                recipientEmail,
                `You've received a Gift Card from ${tenant.name}!`,
                `
                    <h1>You've got credit!</h1>
                    <p>Here is a $${(amount / 100).toFixed(2)} gift card for <strong>${tenant.name}</strong>.</p>
                    <p>Use this code at checkout:</p>
                    <h2 style="background: #f4f4f5; padding: 10px; border-radius: 8px; display: inline-block;">${code}</h2>
                    ${notes ? `<p><strong>Note:</strong> ${notes}</p>` : ''}
                    <p><a href="https://${tenant.slug}.studio.platform/shop">Visit Store</a></p>
                `
            );
        } catch (e) {
            console.error("Failed to send gift card email", e);
            // Don't fail the request, just log
        }
    }

    return c.json({ id, code, amount, recipientMemberId });
});

// POST /claim - Link a card to current user's account
app.post('/claim', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member) return c.json({ error: 'Unauthorized' }, 401);

    const { code } = await c.req.json();
    if (!code) return c.json({ error: 'Code is required' }, 400);

    const card = await db.query.giftCards.findFirst({
        where: and(
            eq(giftCards.tenantId, tenant.id),
            eq(giftCards.code, code.toUpperCase())
        )
    });

    if (!card) return c.json({ error: 'Gift card not found' }, 404);
    if (card.recipientMemberId) {
        if (card.recipientMemberId === member.id) return c.json({ error: 'Already linked to your account' }, 400);
        return c.json({ error: 'Gift card is already claimed by another user' }, 403);
    }

    await db.update(giftCards)
        .set({ recipientMemberId: member.id, updatedAt: new Date() })
        .where(eq(giftCards.id, card.id))
        .run();

    return c.json({ success: true, message: 'Gift card linked successfully' });
});

// GET /:id/transactions - View history
app.get('/:id/transactions', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    const roles = c.get('roles') || [];
    const id = c.req.param('id');

    const card = await db.query.giftCards.findFirst({
        where: and(eq(giftCards.id, id), eq(giftCards.tenantId, tenant.id))
    });

    if (!card) return c.json({ error: 'Gift card not found' }, 404);

    // Permission Check: Owner, Instructor, or Recipient
    const canView = roles.includes('owner') || roles.includes('instructor') || (member && card.recipientMemberId === member.id);
    if (!canView) return c.json({ error: 'Unauthorized' }, 403);

    const transactions = await db.query.giftCardTransactions.findMany({
        where: eq(giftCardTransactions.giftCardId, id),
        orderBy: (tx, { desc }) => [desc(tx.createdAt)]
    });

    return c.json({ transactions });
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
