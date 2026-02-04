-- Seed Platform Plans (Growth & Scale) with Aggregator Features

-- 1. Growth Plan
INSERT INTO platform_plans (id, name, slug, trial_days, features, active, created_at)
VALUES (
  'plan_' || lower(hex(randomblob(12))),
  'Growth',
  'growth',
  14,
  '["financials","marketing","crm","classpass","gympass"]',
  1,
  unixepoch()
)
ON CONFLICT(slug) DO UPDATE SET
  features = '["financials","marketing","crm","classpass","gympass"]',
  active = 1;

-- 2. Scale Plan
INSERT INTO platform_plans (id, name, slug, trial_days, features, active, created_at)
VALUES (
  'plan_' || lower(hex(randomblob(12))),
  'Scale',
  'scale',
  30,
  '["financials","marketing","crm","payroll","vod","classpass","gympass"]',
  1,
  unixepoch()
)
ON CONFLICT(slug) DO UPDATE SET
  features = '["financials","marketing","crm","payroll","vod","classpass","gympass"]',
  active = 1;
