
export const PERMISSIONS = {
    // Financials
    VIEW_FINANCIALS: 'view_financials',
    MANAGE_FINANCIALS: 'manage_financials', // Payroll, Payouts, Refunds

    // Members (CRM)
    VIEW_MEMBERS: 'view_members',
    MANAGE_MEMBERS: 'manage_members', // Edit profile, add notes
    EXPORT_DATA: 'export_data',

    // Schedule & Classes
    VIEW_SCHEDULE: 'view_schedule',
    MANAGE_SCHEDULE: 'manage_schedule', // Create/Cancel classes
    MANAGE_BOOKINGS: 'manage_bookings', // Book/Cancel for students, Check-in

    // Operations
    MANAGE_WAIVERS: 'manage_waivers',
    MANAGE_STAFF: 'manage_staff', // Substitutions, Availability

    // Marketing
    VIEW_MARKETING: 'view_marketing',
    MANAGE_MARKETING: 'manage_marketing', // Campaigns, Automations

    // Settings
    MANAGE_SETTINGS: 'manage_settings',
    MANAGE_ROLES: 'manage_roles',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const PERMISSION_GROUPS = [
    {
        name: "Financials",
        permissions: [PERMISSIONS.VIEW_FINANCIALS, PERMISSIONS.MANAGE_FINANCIALS]
    },
    {
        name: "Members",
        permissions: [PERMISSIONS.VIEW_MEMBERS, PERMISSIONS.MANAGE_MEMBERS, PERMISSIONS.EXPORT_DATA]
    },
    {
        name: "Schedule",
        permissions: [PERMISSIONS.VIEW_SCHEDULE, PERMISSIONS.MANAGE_SCHEDULE, PERMISSIONS.MANAGE_BOOKINGS]
    },
    {
        name: "Marketing",
        permissions: [PERMISSIONS.VIEW_MARKETING, PERMISSIONS.MANAGE_MARKETING]
    },
    {
        name: "Admin",
        permissions: [PERMISSIONS.MANAGE_SETTINGS, PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_STAFF, PERMISSIONS.MANAGE_WAIVERS]
    }
];
