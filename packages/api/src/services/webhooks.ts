
import { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@studio/db/src/schema";
import { eq, and } from "drizzle-orm";
import { Svix } from 'svix';

export class WebhookService {
    private svix: Svix | null = null;

    constructor(private db: DrizzleD1Database<typeof schema>, svixToken?: string) {
        if (svixToken) {
            this.svix = new Svix(svixToken);
        }
    }

    async dispatch(tenantId: string, eventType: string, payload: any) {
        // 0. Gating Checks
        // a. Platform Level
        const globalConfig = await this.db.query.platformConfig.findFirst({
            where: eq(schema.platformConfig.key, 'feature_webhooks')
        });
        if (!globalConfig?.enabled) {
            console.log(`[Webhooks] Platform-level webhooks disabled. Skipping dispatch.`);
            return;
        }

        // b. Tenant Level
        const tenantFeature = await this.db.query.tenantFeatures.findFirst({
            where: and(
                eq(schema.tenantFeatures.tenantId, tenantId),
                eq(schema.tenantFeatures.featureKey, 'webhooks'),
                eq(schema.tenantFeatures.enabled, true)
            )
        });
        if (!tenantFeature) {
            console.log(`[Webhooks] Tenant-level webhooks disabled for ${tenantId}. Skipping dispatch.`);
            return;
        }

        // 1. Find active endpoints for this tenant that subscribe to this event
        const endpoints = await this.db.query.webhookEndpoints.findMany({
            where: and(
                eq(schema.webhookEndpoints.tenantId, tenantId),
                eq(schema.webhookEndpoints.isActive, true)
            )
        });

        // Filter in memory because `events` is a JSON array string
        // In a real PG setup we'd use jsonb operators, but SQLite is simpler this way
        const targets = endpoints.filter(ep => {
            try {
                const events = ep.events as unknown as string[];
                // in Drizzle/SQLite json mode it comes back as object/array automatically if typed correctly
                // Double check schema definition: mode: 'json'
                return Array.isArray(events) && (events.includes(eventType) || events.includes('*'));
            } catch (e) {
                return false;
            }
        });

        if (targets.length === 0) return;

        const eventId = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const bodyObj = {
            id: eventId,
            event: eventType,
            created_at: timestamp,
            data: payload
        };

        // If Svix is enabled, we use it. If not, we fall back to manual for now or log error
        if (this.svix) {
            console.log(`[Webhooks] Sending ${eventType} to Svix for app ${tenantId}`);
            try {
                await this.svix.message.create(tenantId, {
                    eventType,
                    payload: bodyObj
                });
            } catch (e: any) {
                console.error(`[Webhooks] Svix Error for ${tenantId}:`, e.message);
            }
            return;
        }

        console.log(`[Webhooks] Fallback: Dispatching ${eventType} manually to ${targets.length} endpoints`);
        const bodyString = JSON.stringify(bodyObj);
    }

    private async sign(body: string, secret: string): Promise<string> {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const bodyData = encoder.encode(body);

        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signatureBuffer = await crypto.subtle.sign('HMAC', key, bodyData);
        const signatureArray = Array.from(new Uint8Array(signatureBuffer));
        const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return `sha256=${signatureHex}`;
    }
}
