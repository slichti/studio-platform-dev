import { createDb } from '../db';
import { auditLogs, tenants, users } from '@studio/db/src/schema'; // adjustments might be needed based on actual export
import { eq } from 'drizzle-orm';

export class AuditService {
    constructor(private db: ReturnType<typeof createDb>) { }

    async log(params: {
        actorId: string;
        action: string;
        tenantId?: string;
        targetId?: string;
        targetType?: string;
        details?: Record<string, any>;
        ipAddress?: string;
        location?: {
            country?: string;
            city?: string;
            region?: string;
        };
    }) {
        try {
            await this.db.insert(auditLogs).values({
                id: crypto.randomUUID(),
                actorId: params.actorId,
                action: params.action,
                tenantId: params.tenantId || null,
                targetId: params.targetId,
                targetType: params.targetType,
                details: params.details,
                ipAddress: params.ipAddress,
                country: params.location?.country,
                city: params.location?.city,
                region: params.location?.region,
            }).run();

        } catch (error) {
            console.error('Failed to write audit log:', error);
            // Don't throw, we don't want to break the main flow for logging
        }
    }
}
