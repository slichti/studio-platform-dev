import { createDb } from '../db';
import { tenants } from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';

export class TaxService {
    constructor(private db: any, private tenantId: string) { }

    /**
     * Calculate sales tax for a given amount based on tenant location
     * In a production app, this might call Avalara, TaxJar, or just use a look-up table.
     * For now, we use a simple state-based mapping.
     */
    async calculateTax(amount: number): Promise<{ taxAmount: number; rate: number; state: string }> {
        const tenant = await this.db.select().from(tenants).where(eq(tenants.id, this.tenantId)).get();
        if (!tenant) return { taxAmount: 0, rate: 0, state: 'unknown' };

        const state = (tenant.state || 'TX').toUpperCase();

        // Simple state-based tax rates (placeholder logic)
        const rates: Record<string, number> = {
            'TX': 0.0825, // 8.25%
            'CA': 0.0725, // 7.25% minimum
            'NY': 0.08875, // NYC rate
            'FL': 0.06,
            'WA': 0.065,
        };

        const rate = rates[state] || 0;
        const taxAmount = Math.round(amount * rate);

        return { taxAmount, rate, state };
    }
}
