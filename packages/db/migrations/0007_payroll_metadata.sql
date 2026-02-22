-- Add metadata JSON column to payroll_config for fixed-deduction support
ALTER TABLE payroll_config ADD COLUMN metadata TEXT; -- JSON: { fixedDeduction: number (cents) }
