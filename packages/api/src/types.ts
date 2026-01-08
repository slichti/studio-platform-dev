// Shared API Response Types

import { tenants, tenantMembers, users } from 'db';

export interface Bindings {
    DB: D1Database;
    JWT_SECRET: string;
    ENCRYPTION_SECRET: string;
    RESEND_API_KEY?: string;
    TWILIO_ACCOUNT_SID?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_API_TOKEN?: string;
    CLERK_SECRET_KEY?: string;
    STRIPE_SECRET_KEY?: string;
}

export interface Variables {
    auth: { userId: string };
    roles?: string[];
    tenant?: typeof tenants.$inferSelect;
    member?: typeof tenantMembers.$inferSelect;
    user?: typeof users.$inferSelect;
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
