import { eq, and, sql } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';
import { AuditService } from './audit';

export class InventoryService {
    private audit: AuditService;

    constructor(private db: any, private tenantId: string) {
        this.audit = new AuditService(db);
    }

    /**
     * Adjust stock for a product and log the change.
     * @param productId The product to adjust
     * @param delta The amount to change (positive or negative)
     * @param reason The reason for the change
     * @param notes Optional notes
     * @param staffId The staff member performing the adjustment
     */
    async adjustStock(productId: string, delta: number, reason: any, notes?: string, staffId?: string) {
        // 1. Get current product
        const product = await this.db.query.products.findFirst({
            where: and(
                eq(schema.products.id, productId),
                eq(schema.products.tenantId, this.tenantId)
            )
        });

        if (!product) throw new Error('Product not found');

        const newQuantity = Math.max(0, product.stockQuantity + delta);

        // 2. Update Product
        await this.db.update(schema.products)
            .set({
                stockQuantity: newQuantity,
                updatedAt: new Date()
            })
            .where(eq(schema.products.id, productId))
            .run();

        // 3. Log Adjustment
        await this.db.insert(schema.inventoryAdjustments).values({
            id: crypto.randomUUID(),
            tenantId: this.tenantId,
            productId,
            staffId,
            delta,
            reason,
            notes,
            createdAt: new Date()
        }).run();

        // 4. Audit Log
        await this.audit.log({
            actorId: staffId || 'system',
            action: 'inventory.adjust_stock',
            targetId: productId,
            tenantId: this.tenantId,
            details: { delta, reason, oldQuantity: product.stockQuantity, newQuantity }
        });

        return { success: true, newQuantity };
    }

    /**
     * Receive a purchase order and update stock.
     */
    async receivePurchaseOrder(poId: string, staffId?: string) {
        const po = await this.db.query.purchaseOrders.findFirst({
            where: and(
                eq(schema.purchaseOrders.id, poId),
                eq(schema.purchaseOrders.tenantId, this.tenantId)
            ),
            with: { items: true }
        });

        if (!po) throw new Error('Purchase order not found');
        if (po.status === 'received') throw new Error('Purchase order already received');

        // Process each item
        for (const item of po.items) {
            await this.adjustStock(
                item.productId,
                item.quantityOrdered,
                'po_received',
                `Received via PO ${po.poNumber}`,
                staffId
            );

            // Update item received quantity
            await this.db.update(schema.purchaseOrderItems)
                .set({ quantityReceived: item.quantityOrdered })
                .where(eq(schema.purchaseOrderItems.id, item.id))
                .run();
        }

        // Finalize PO
        await this.db.update(schema.purchaseOrders)
            .set({
                status: 'received',
                receivedAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(schema.purchaseOrders.id, poId))
            .run();

        return { success: true };
    }
}
