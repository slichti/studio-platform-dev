
export type Permission =
    | 'manage_tenant'
    | 'view_tenant'
    | 'manage_billing'
    | 'view_billing'
    | 'manage_members'
    | 'view_members'
    | 'manage_classes'
    | 'view_classes'
    | 'manage_staff'
    | 'view_reports'
    | 'manage_reports'
    | 'view_financials'
    | 'check_in_students'
    | 'manage_pos'
    | 'manage_inventory'
    | 'manage_marketing'
    | 'view_settings'
    | 'manage_settings'
    | 'manage_content'
    | 'manage_leads'
    | 'manage_community'
    | 'view_commerce'
    | 'manage_commerce'
    | 'view_pos'
    | 'view_progress'
    | 'manage_progress'
    |     'manage_payroll';

/** All known permissions (for "view my permissions" and policy layer). */
export const ALL_PERMISSIONS: Permission[] = [
    'manage_tenant', 'view_tenant', 'manage_billing', 'view_billing',
    'manage_members', 'view_members', 'manage_classes', 'view_classes',
    'manage_staff', 'view_reports', 'manage_reports', 'view_financials',
    'check_in_students', 'manage_pos', 'view_pos', 'manage_inventory',
    'manage_marketing', 'view_settings', 'manage_settings', 'manage_content',
    'manage_leads', 'manage_community', 'view_commerce', 'manage_commerce',
    'view_progress', 'manage_progress', 'manage_payroll'
];

export const RolePermissions: Record<string, Permission[]> = {
    owner: [ // All permissions + administrative
        'manage_tenant', 'view_tenant',
        'manage_billing', 'view_billing',
        'manage_members', 'view_members',
        'manage_classes', 'view_classes',
        'manage_staff',
        'view_reports', 'manage_reports', 'view_financials',
        'check_in_students',
        'manage_pos', 'view_pos', 'manage_inventory',
        'manage_marketing',
        'view_settings', 'manage_settings',
        'manage_content',
        'manage_leads',
        'manage_community',
        'view_commerce', 'manage_commerce',
        'view_progress', 'manage_progress',
        'manage_payroll'
    ],
    admin: [ // Operations Manager
        'view_tenant',
        'manage_members', 'view_members',
        'manage_classes', 'view_classes',
        'manage_staff',
        'view_reports', 'manage_reports',
        'check_in_students',
        'manage_pos', 'view_pos', 'manage_inventory',
        'manage_marketing',
        'view_settings', 'manage_settings',
        'manage_content',
        'manage_leads',
        'manage_community',
        'view_commerce', 'manage_commerce',
        'view_progress', 'manage_progress',
        'manage_payroll'
    ],
    instructor: [ // Staff
        'view_members',
        'manage_classes', 'view_classes',
        'check_in_students',
        'manage_pos', 'view_pos', 'manage_inventory',
        'manage_content',
        'view_progress'
    ],
    student: [
        // Students typically have 'view_classes' via public API but internal RBAC usually restricts 'manage'
        // 'view_classes' might be public, but let's include it for explicit internal checks if needed.
    ]
};

export class PermissionService {
    static resolvePermissions(roles: string[], customPermissions: string[] = []): Set<Permission> {
        const permissions = new Set<Permission>();

        for (const role of roles) {
            const rolePerms = RolePermissions[role] || [];
            for (const perm of rolePerms) {
                permissions.add(perm);
            }
        }

        for (const perm of customPermissions) {
            permissions.add(perm as Permission);
        }

        return permissions;
    }

    static can(memberPermissions: Set<Permission>, requiredPermission: Permission): boolean {
        // Platform Admins (handled outside or injected) can do everything
        return memberPermissions.has(requiredPermission);
    }
}
