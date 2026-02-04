import { createRoute, z } from '@hono/zod-openapi';
import { createDb } from '../db';
import * as schema from '@studio/db/src/schema';
import { eq, and, desc } from 'drizzle-orm';
import { InventoryService } from '../services/inventory';
import { createOpenAPIApp, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';
import { AppError, UnauthorizedError } from '../utils/errors';

const app = createOpenAPIApp();

// --- Schemas ---

const SupplierSchema = z.object({
    id: z.string(),
    name: z.string(),
    contactName: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    isActive: z.boolean(),
}).openapi('Supplier');

const ProductStockSchema = z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string().optional().nullable(),
    stockQuantity: z.number(),
    lowStockThreshold: z.number(),
    supplier: SupplierSchema.optional().nullable(),
}).openapi('ProductStock');

const AdjustmentRequestSchema = z.object({
    productId: z.string(),
    delta: z.number(),
    reason: z.enum(['restock', 'correction', 'damage', 'loss', 'return']),
    notes: z.string().optional(),
}).openapi('AdjustmentRequest');

const PurchaseOrderSchema = z.object({
    id: z.string(),
    poNumber: z.string(),
    status: z.string(),
    totalAmount: z.number(),
    supplierId: z.string(),
    supplierName: z.string().optional().nullable(),
    createdAt: z.string(),
}).openapi('PurchaseOrder');

// --- Routes ---

/**
 * GET /inventory
 * List products with their current stock levels and supplier info.
 */
app.openapi(createRoute({
    method: 'get',
    path: '/',
    tags: ['Inventory'],
    summary: 'Get inventory status',
    responses: {
        200: { content: { 'application/json': { schema: z.array(ProductStockSchema) } }, description: 'Inventory status list' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const can = c.get('can');
    if (!can('manage_inventory')) throw new UnauthorizedError('Insufficient permissions');

    const db = createDb(c.env.DB);

    const inventory = await db.query.products.findMany({
        where: eq(schema.products.tenantId, tenant.id),
        with: { supplier: true },
        orderBy: [desc(schema.products.stockQuantity)]
    });

    return c.json(inventory as any);
});

/**
 * POST /inventory/adjust
 * Manually adjust stock levels (wastage, corrections, manual restock).
 */
app.openapi(createRoute({
    method: 'post',
    path: '/adjust',
    tags: ['Inventory'],
    summary: 'Adjust product stock',
    request: { body: { content: { 'application/json': { schema: AdjustmentRequestSchema } } } },
    responses: {
        200: { content: { 'application/json': { schema: SuccessResponseSchema } }, description: 'Adjustment successful' },
        404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Product not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const member = c.get('member');
    const can = c.get('can');
    const db = createDb(c.env.DB);
    const body = c.req.valid('json');

    if (!can('manage_inventory')) throw new UnauthorizedError('Insufficient permissions');

    const service = new InventoryService(db, tenant.id);
    try {
        await service.adjustStock(body.productId, body.delta, body.reason, body.notes, member?.id);
        return c.json({ success: true }, 200) as any;
    } catch (e: any) {
        throw new AppError(e.message, 404, 'INVENTORY_ERROR');
    }
});

/**
 * GET /inventory/suppliers
 * List all suppliers for the studio.
 */
app.openapi(createRoute({
    method: 'get',
    path: '/suppliers',
    tags: ['Inventory'],
    summary: 'List suppliers',
    responses: {
        200: { content: { 'application/json': { schema: z.array(SupplierSchema) } }, description: 'Supplier list' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const can = c.get('can');
    const db = createDb(c.env.DB);

    if (!can('manage_inventory')) throw new UnauthorizedError('Insufficient permissions');

    const result = await db.query.suppliers.findMany({
        where: eq(schema.suppliers.tenantId, tenant.id)
    });

    return c.json(result as any);
});

/**
 * POST /inventory/suppliers
 * Add a new vendor to the studio.
 */
app.openapi(createRoute({
    method: 'post',
    path: '/suppliers',
    tags: ['Inventory'],
    summary: 'Create supplier',
    request: { body: { content: { 'application/json': { schema: SupplierSchema.omit({ id: true, isActive: true }) } } } },
    responses: {
        201: { content: { 'application/json': { schema: SupplierSchema } }, description: 'Supplier created' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const can = c.get('can');
    const db = createDb(c.env.DB);
    const body = c.req.valid('json');

    if (!can('manage_inventory')) throw new UnauthorizedError('Insufficient permissions');

    const supplier = await db.insert(schema.suppliers).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        ...body,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    }).returning().get();

    return c.json(supplier as any, 201);
});

/**
 * GET /inventory/purchase-orders
 * List purchase orders with status filtering.
 */
app.openapi(createRoute({
    method: 'get',
    path: '/purchase-orders',
    tags: ['Inventory'],
    summary: 'List purchase orders',
    responses: {
        200: { content: { 'application/json': { schema: z.array(PurchaseOrderSchema) } }, description: 'PO list' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const can = c.get('can');
    if (!can('manage_inventory')) throw new UnauthorizedError('Insufficient permissions');

    const db = createDb(c.env.DB);

    const pos = await db.query.purchaseOrders.findMany({
        where: eq(schema.purchaseOrders.tenantId, tenant.id),
        with: { supplier: true },
        orderBy: [desc(schema.purchaseOrders.createdAt)]
    });

    return c.json(pos.map(p => ({
        ...p,
        supplierName: p.supplier?.name || 'Unknown',
        createdAt: p.createdAt?.toISOString() || new Date().toISOString()
    })) as any);
});

/**
 * POST /inventory/purchase-orders/:id/receive
 * Mark a purchase order as received and automatically update stock for all items.
 */
app.openapi(createRoute({
    method: 'post',
    path: '/purchase-orders/:id/receive',
    tags: ['Inventory'],
    summary: 'Receive purchase order (update stock)',
    request: { params: z.object({ id: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: SuccessResponseSchema } }, description: 'PO received' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const member = c.get('member');
    const can = c.get('can');
    const db = createDb(c.env.DB);
    const poId = c.req.param('id');

    if (!can('manage_inventory')) throw new UnauthorizedError('Insufficient permissions');

    const service = new InventoryService(db, tenant.id);
    try {
        await service.receivePurchaseOrder(poId, member?.id);
        return c.json({ success: true }, 200) as any;
    } catch (e: any) {
        throw new AppError(e.message, 400, 'PO_ERROR');
    }
});

export default app;
