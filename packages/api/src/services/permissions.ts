
export type Permission =
    | 'manage_tenant'
    | 'manage_billing'
    | 'manage_members'
    | 'manage_classes'
    | 'manage_staff'
    | 'view_reports'
    | 'view_financials'
    | 'check_in_students'
    | 'manage_pos'
    | 'manage_inventory'
    | 'manage_marketing';

export const RolePermissions: Record<string, Permission[]> = {
    owner: [
        'manage_tenant',
        'manage_billing',
        'manage_members',
        'manage_classes',
        'manage_staff',
        'view_reports',
        'view_financials',
        'check_in_students',
        'manage_pos',
        'manage_inventory',
        'manage_marketing'
    ],
    admin: [
        'manage_tenant',
        'manage_members',
        'manage_classes',
        'manage_staff',
        'view_reports',
        'check_in_students',
        'manage_pos',
        'manage_marketing'
    ],
    instructor: [
        'manage_classes',
        'manage_members',
        'check_in_students',
        'manage_pos',
        'manage_inventory'
    ],
    student: []
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
        // Platform Admins (handled outside this or injected) can do everything
        return memberPermissions.has(requiredPermission);
    }
}
