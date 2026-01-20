import { tenants } from 'db/src/schema';

export type FeatureKey =
    | 'loyalty'
    | 'streaks'
    | 'guest_pass'
    | 'spot_booking'
    | 'ai_churn'
    | 'ai_content'
    | 'payroll'
    | 'livestream'
    | 'mobile_app'
    | 'website_builder'
    | 'chat'
    | 'financials'
    | 'vod'
    | 'zoom'
    | 'pos'
    | 'sms'
    | 'marketing';

const TIER_DEFAULTS: Record<string, FeatureKey[]> = {
    'basic': [],
    'growth': ['loyalty', 'streaks', 'guest_pass', 'spot_booking'],
    'scale': ['loyalty', 'streaks', 'guest_pass', 'spot_booking', 'ai_churn', 'ai_content', 'payroll', 'livestream']
};

export function isFeatureEnabled(tenant: typeof tenants.$inferSelect, feature: FeatureKey): boolean {
    if (!tenant) return false;

    // 1. Check specific override in settings
    // settings is defined as `unknown` by Drizzle if just text({ mode: 'json' })? 
    // Usually inferred as any depending on driver, but safer to cast.
    const settings = tenant.settings as Record<string, any> | null;

    // settings?.features?.['streaks']
    if (settings?.features && typeof settings.features[feature] === 'boolean') {
        return settings.features[feature];
    }

    // 2. Fallback to Tier Defaults
    const defaults = TIER_DEFAULTS[tenant.tier || 'basic'] || [];
    return defaults.includes(feature);
}
