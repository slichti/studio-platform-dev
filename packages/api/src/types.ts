// Shared API Response Types

import { tenants, tenantMembers, users } from '@studio/db/src/schema'; // Ensure consistent import
import { EmailService } from './services/email';
import { LoggerService } from './services/logger';

export interface Bindings {
    DB: D1Database;
    JWT_SECRET?: string;
    ENCRYPTION_SECRET?: string;
    RESEND_API_KEY?: string;
    TWILIO_ACCOUNT_SID?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_TOKEN?: string;
    CLERK_SECRET_KEY?: string;
    CLERK_WEBHOOK_SECRET?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_CLIENT_ID?: string;
    ZOOM_ACCOUNT_ID?: string;
    ENVIRONMENT?: string;
    R2?: R2Bucket;
    CHAT_ROOM?: DurableObjectNamespace; // Added CHAT_ROOM binding
    RATE_LIMITER?: DurableObjectNamespace;
    METRICS?: DurableObjectNamespace;
    PLATFORM_ADMIN_EMAIL?: string;
    IMPERSONATION_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    CLOUDFLARE_STREAM_ACCOUNT_ID?: string;
    CLOUDFLARE_STREAM_API_TOKEN?: string;
    GEMINI_API_KEY?: string;
    ZOOM_WEBHOOK_SECRET_TOKEN?: string;
    ZOOM_CLIENT_ID?: string;
    ZOOM_CLIENT_SECRET?: string;
}

export interface Variables {
    auth: { userId: string; claims: any };
    roles?: string[];
    permissions?: Set<string>;
    can: (permission: string) => boolean;
    tenant: typeof tenants.$inferSelect;
    member?: any; // often includes user relation
    user?: typeof users.$inferSelect;
    traceId?: string;
    features: Set<string>;
    isImpersonating?: boolean;
    validated_json?: any;
    emailApiKey?: string;
    email: EmailService;
    twilioCredentials?: { accountSid: string; authToken: string; fromNumber: string };
    logger: LoggerService;
    isPlatformAdmin?: boolean; // recognize platform admin status broadly
}

export interface StudioVariables extends Variables {
    tenant: typeof tenants.$inferSelect;
}

export type HonoContext = {
    Bindings: Bindings;
    Variables: Variables;
};

export interface ReportsRevenueResponse {
    grossVolume: number;
    mrr: number;
    breakdown: {
        retail: number;
        packs: number;
        mrr: number;
        renewals?: number; // New field for completeness
    };
    chartData: {
        name: string;
        value: number;
    }[];
    period: {
        start: string;
        end: string;
    };
}

export interface ReportsAttendanceResponse {
    totalBookings: number;
    totalCheckins: number;
    topClasses: {
        title: string;
        attendees: number;
    }[];
    chartData: {
        name: string;
        value: number;
    }[];
}

export interface ReferralStat {
    total: number;
    pending: number;
    completed: number;
    rewarded: number;
}

export interface Referral {
    id: string;
    code: string;
    status: 'pending' | 'completed' | 'rewarded' | 'expired';
    createdAt: number;
    referrer?: {
        user?: {
            email?: string;
            profile?: {
                firstName?: string;
                lastName?: string;
            };
        };
    };
}
