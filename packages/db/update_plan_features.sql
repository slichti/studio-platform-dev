-- Update features for Launch (Basic)
UPDATE platform_plans SET features = '["Unlimited Students", "5 Instructors", "1 Location", "5GB Storage", "Basic Financials & Reporting", "Waiver Management", "Visual Website Builder", "Retail Point of Sale (POS)", "Transactional Email Notifications", "Class Packs & Drop-ins"]' WHERE slug = 'basic';

-- Update features for Growth
UPDATE platform_plans SET features = '["Everything in Launch", "15 Instructors", "3 Locations", "50GB Storage", "Zoom Integration (Auto-Meeting)", "Video on Demand (VOD)", "Marketing Automations (Win-back, Welcome)", "Inventory Tracking & Low Stock Alerts", "SMS Notifications & Marketing", "Recurring Memberships"]' WHERE slug = 'growth';

-- Update features for Scale
UPDATE platform_plans SET features = '["Everything in Growth", "Unlimited Instructors", "Unlimited Locations", "1TB Video Storage", "White Label Branding Options", "API Access", "Priority Support", "0% Platform Fees"]' WHERE slug = 'scale';
