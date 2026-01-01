import { Hono } from 'hono';
import { createDb } from '../db';
import { products, posOrders, posOrderItems, tenantMembers } from 'db/src/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: { userId: string };
    tenant: any;
    member?: any;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /products - List available inventory
app.get('/products', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const list = await db.select().from(products)
        .where(eq(products.tenantId, tenant.id))
        .orderBy(desc(products.createdAt))
        .all();

    return c.json({ products: list });
});

// POST /products - Add new product (Admin/Staff)
app.post('/products', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const body = await c.req.json();

    const id = crypto.randomUUID();
    await db.insert(products).values({
        id,
        tenantId: tenant.id,
        name: body.name,
        description: body.description,
        category: body.category,
        sku: body.sku,
        price: body.price,
        currency: tenant.currency || 'usd',
        stockQuantity: body.stockQuantity || 0,
        imageUrl: body.imageUrl,
        isActive: true
    }).run();

    return c.json({ success: true, id });
});

// POST /orders - Create a POS Sale
app.post('/orders', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const staff = c.get('member');
    const { items, memberId, paymentMethod, totalAmount } = await c.req.json();

    if (!items || items.length === 0) return c.json({ error: "No items in order" }, 400);

    const orderId = crypto.randomUUID();

    try {
        // Start Transaction (if supported, else sequential)
        // D1 doesn't support full transactions in Drizzle yet in all environments, but let's use batch

        const orderValues = {
            id: orderId,
            tenantId: tenant.id,
            memberId: memberId || null,
            staffId: staff?.id || null,
            totalAmount: totalAmount,
            status: 'completed' as const,
            paymentMethod: paymentMethod || 'card'
        };

        const itemInserts = items.map((it: any) => ({
            id: crypto.randomUUID(),
            orderId: orderId,
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.unitPrice * it.quantity
        }));

        // Batch execution
        await db.insert(posOrders).values(orderValues).run();

        for (const item of itemInserts) {
            await db.insert(posOrderItems).values(item).run();
            // Update stock
            await db.update(products)
                .set({ stockQuantity: eq(products.stockQuantity, products.stockQuantity) as any /* Placeholder for atomic decr if supported or just simple fetch-update */ })
                .where(eq(products.id, item.productId))
            // Note: D1/SQLite doesn't easily do atomic decr via Drizzle in a single line without more complex SQL. 
            // For MVP, we'll just skip atomic for now or use raw SQL.
            // Better: 
            // .set({ stockQuantity: sql`${products.stockQuantity} - ${item.quantity}` })
        }

        // Real atomic update:
        for (const item of items) {
            await db.run(sql`UPDATE products SET stock_quantity = stock_quantity - ${item.quantity} WHERE id = ${item.productId}`);
        }

        return c.json({ success: true, orderId });
    } catch (e: any) {
        console.error("POS Order Failed:", e);
        return c.json({ error: e.message }, 500);
    }
});

// GET /orders - History
app.get('/orders', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const orders = await db.query.posOrders.findMany({
        where: eq(posOrders.tenantId, tenant.id),
        with: {
            items: {
                with: { product: true }
            },
            member: {
                with: { user: { columns: { profile: true } } }
            }
        },
        orderBy: [desc(posOrders.createdAt)]
    });

    return c.json({ orders });
});

export default app;
