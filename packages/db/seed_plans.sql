-- Seed Platform Plans
INSERT INTO platform_plans (id, name, slug, monthly_price_cents, annual_price_cents, trial_days, features, active, highlight) VALUES 
('plan_basic', 'Basic', 'basic', 0, 0, 0, '["Up to 50 Students", "1GB Storage", "Community Support"]', 1, 0),
('plan_growth', 'Growth', 'growth', 4900, 49000, 14, '["Up to 500 Students", "50GB Storage", "Priority Support", "Custom Branding"]', 1, 1),
('plan_scale', 'Scale', 'scale', 19900, 199000, 14, '["Unlimited Students", "1TB Storage", "Dedicated Account Manager", "White Labeling", "API Access"]', 1, 0);
