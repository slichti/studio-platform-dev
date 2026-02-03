# Smart Pricing, Custom Fields & Churn Prediction

This document specifically details the configuration and behavior of the advanced business intelligence features introduced in Phase 7.

## 1. Custom Member Fields

Tenants can now define custom fields for their members to capture specific information relevant to their studio (e.g., "Injury History", "Referral Source", "T-Shirt Size").

### Configuration
- Navigate to **Settings > Tags & Experience**.
- Under "Custom Member Fields", click **Add Field**.
- **Supported Types**:
    - `Text`: Single line input.
    - `Number`: Numeric input.
    - `Date`: Date picker.
    - `Boolean`: Checkbox (Yes/No).
    - `Select`: Dropdown (requires comma-separated options).
- **Required**: You can mark fields as mandatory for new profiles.

### Usage
- **Admin Profile**: Viewing a member's profile will show an "Additional Info" card with these fields.
- **Editing**: Users can update these values in the "Edit Profile" dialog.
- **API**: Fields are stored in the `custom_fields` JSON column on the `tenant_members` table. API consumers must include the `X-Tenant-Slug` header to correctly resolve field definitions.

---

## 2. Smart Pricing (Payroll)

Instructor payroll can now be automated based on class performance or fixed rates, configurable per-class.

### Models
1.  **Use Instructor Default**: Inherits the payroll setting from the Instructor's profile (not yet fully implemented in UI, defaults to fallback).
2.  **Flat Rate**: Fixed amount per class (e.g., $50).
3.  **Hourly Rate**: Calculated based on class duration (e.g., $30/hr for a 90min class = $45).
4.  **Percentage**: Percentage of generated revenue (e.g., 50% of (Price * Attendees)). Note: Does not currently account for class packs/credits value exact attribution.

### Configuration
- In the **Create/Edit Class** modal, scroll to "Investigator Payroll (Smart Pricing)".
- Select the **Payroll Model** and enter the **Rate/Value**.

---

## 3. Churn Prediction

The platform analyzes member activity to predict churn risk.

### Logic
The `ChurnService` calculates a score (0-100) based on:
- **Recency**: Days since last booking.
    - > 30 days: High Risk (-40 pts)
    - > 14 days: Medium Risk (-20 pts)
- **Subscription**: Active subscription (+0), No active subscription (-50).
- **History**: Never booked (-30).

**Score Interpretation**:
- **0-30**: `churned` (High Priority)
- **30-60**: `at_risk` (Warning)
- **60-100**: `safe` (Healthy)

### Automation
- **Update Frequency**: Scores are recalculated automatically **once daily** (approx 00:00 UTC) via a background cron job to minimize database load.
- **Viewing**: Churn scores are visible in the "Members" list and "Retention" reports.
