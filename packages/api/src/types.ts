// Shared API Response Types

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
