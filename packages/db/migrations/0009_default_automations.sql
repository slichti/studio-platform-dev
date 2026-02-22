-- Migration 0009: Default Automations
-- Adds default (disabled) automations for Churn and Referrals to all existing tenants.

-- Use a temporary table or subquery to insert for all tenants
INSERT INTO marketing_automations (
    id, 
    tenant_id, 
    trigger_event, 
    subject, 
    content, 
    is_enabled, 
    timing_type, 
    timing_value, 
    channels, 
    recipients, 
    coupon_config,
    created_at,
    updated_at
)
SELECT 
    'auto_churn_' || t.id,
    t.id,
    'churn_risk_high',
    'We miss you at {{studioName}}!',
    'Hi {{firstName}}, we noticed it has been {{daysAbsent}} days since your last visit. We would love to see you back! Use code {{couponCode}} for 20% off your next pack.',
    0, -- disabled by default
    'immediate',
    0,
    '["email"]',
    '["student"]',
    '{"type": "percent", "value": 20, "validityDays": 7}',
    strftime('%s', 'now'),
    strftime('%s', 'now')
FROM tenants t;

INSERT INTO marketing_automations (
    id, 
    tenant_id, 
    trigger_event, 
    subject, 
    content, 
    is_enabled, 
    timing_type, 
    timing_value, 
    channels, 
    recipients,
    created_at,
    updated_at
)
SELECT 
    'auto_referral_' || t.id,
    t.id,
    'referral_conversion_success',
    'Your friend joined {{studioName}}!',
    'Great news! {{referredFirstName}} just signed up using your link. We have added ${{rewardAmount}} in credit to your account.',
    0, -- disabled by default
    'immediate',
    0,
    '["email"]',
    '["student"]',
    strftime('%s', 'now'),
    strftime('%s', 'now')
FROM tenants t;
