/**
 * Documentation index for search and sidebar.
 * minRole: 'platform' = platform admins only; 'owner' = owner+; 'admin' = admin+; 'instructor' = instructor+; 'student' = all authenticated.
 */
export type DocMinRole = 'platform' | 'owner' | 'admin' | 'instructor' | 'student';

export interface DocEntry {
    title: string;
    href: string;
    content: string;
    category: string;
    /** Minimum role to see this doc. Default 'student' = everyone. */
    minRole?: DocMinRole;
    /** @deprecated Use minRole: 'platform' instead */
    adminOnly?: boolean;
}

export const docsIndex: DocEntry[] = [
    { title: "Platform Architecture", href: "/documentation/platform/architecture", content: "Cloudflare Workers, D1 Database, Edge Network, Infrastructure, Serverless, Request Flow", category: "Platform", minRole: "platform" },
    { title: "RBAC, Roles & Permissions", href: "/documentation/platform/rbac", content: "Roles, permissions, capabilities, student matrix, PermissionService, ALL_PERMISSIONS, RolePermissions, c.get('can')", category: "Platform", minRole: "platform" },
    { title: "Course Management — Platform Guide", href: "/documentation/platform/courses", content: "Feature flag, course_management, enable courses, tenant feature, hybrid curriculum, enrollment, progress, VOD, live sessions, Scale tier", category: "Platform", minRole: "platform" },
    { title: "Tenant Management", href: "/documentation/platform/tenants", content: "Provisioning, Feature Flags, Billing Tiers, Suspended, Paused, Lifecycle", category: "Platform", minRole: "platform" },
    { title: "Clerk Configuration", href: "/documentation/platform/clerk", content: "Clerk Dashboard, Social login, OAuth, Google, Facebook, Microsoft, IdP, SSO, sign-in, sign-up, domains, allowed origins, user testing", category: "Platform", minRole: "platform" },
    { title: "Platform Changelog", href: "/documentation/changelog", content: "Product updates, feature releases, bug fixes, iterations, version history, git commits", category: "Overview", minRole: "platform" },
    { title: "Reports & Analytics", href: "/documentation/reports", content: "Financial Reports, Gross Revenue, MRR, Attendance, Utilization Rate, Exports, CSV", category: "Growth", minRole: "admin" },
    { title: "Studio Setup", href: "/documentation/setup", content: "Configuration, Timezone, Currency, Stripe Connect, Payments, Branding, Logo", category: "Overview", minRole: "owner" },
    { title: "Classes & Rosters", href: "/documentation/classes", content: "Scheduling, Recurrence, Virtual Zoom, Check-in, Attendance, Instructors", category: "Classes", minRole: "instructor" },
    { title: "Courses & Monetization", href: "/documentation/courses", content: "Course Setup, Standalone Purchase, Recording Price, Non-member Access, VOD Protection", category: "Classes", minRole: "admin" },
    { title: "Memberships & POS", href: "/documentation/commerce", content: "Recurring Subscriptions, Class Packs, Expiration, Point of Sale, Gift Cards, Products, Checkout", category: "Commerce", minRole: "instructor" },
    { title: "Website Builder", href: "/documentation/website", content: "Drag and Drop, SEO, Widgets, Embeds, Domains, Pages, Hero Section, robots.txt, Review AI, meta title, meta description, paths to hide", category: "Online Presence", minRole: "owner" },
    { title: "Mobile App", href: "/documentation/mobile-builder", content: "White Label, iOS, Android, Splash Screen, Push Notifications, App Icon", category: "Online Presence", minRole: "owner" },
    { title: "CRM & Marketing", href: "/documentation/crm", content: "Leads, Pipelines, Email Automations, Chat, Two-way SMS, Loyalty, Points, Rewards", category: "Growth", minRole: "admin" },
    { title: "Team & Staff", href: "/documentation/team", content: "Payroll, Substitutions, Permissions, Roles, Instructors, Front Desk", category: "Team", minRole: "admin" },
    { title: "Advanced Analytics", href: "/documentation/studio/analytics", content: "Cohort Analysis, Retention, LTV, Lifetime Value, Heatmap, Utilization, Data, Insights, Trends", category: "Growth", minRole: "admin" },
    { title: "For Instructors", href: "/documentation/instructors", content: "Teaching schedule, substitutions, rosters, check-in, booking on behalf, permissions, class settings", category: "By Role", minRole: "instructor" },
    { title: "Student Portal", href: "/documentation/studio/portal", content: "Student View, Scheduling, Profile, Achievements, Progress, History, Bookings", category: "Student Experience", minRole: "student" },
    { title: "For Studio Owners", href: "/documentation/studio/overview", content: "Owner guide, managing business, payments, growth, retention, mobile app", category: "By Role", minRole: "owner" },
    { title: "Migration & Import", href: "/documentation/migration", content: "CSV import, migrating data, bulk import members classes", category: "Overview", minRole: "admin" },
    { title: "Create a Waiver", href: "/documentation/guides/waiver", content: "Waiver templates, digital signatures, liability", category: "Guides", minRole: "owner" },
    { title: "Setup Class Packs", href: "/documentation/guides/class-packs", content: "Class packs, credits, expiration", category: "Guides", minRole: "admin" },
];

/** Role hierarchy for visibility: platform > owner > admin > instructor > student */
const ROLE_ORDER: DocMinRole[] = ['platform', 'owner', 'admin', 'instructor', 'student'];

export interface DocVisibility {
    hasPlatformAdmin: boolean;
    hasOwner: boolean;
    hasAdmin: boolean;
    hasInstructor: boolean;
}

export function isDocVisibleTo(entry: DocEntry, vis: DocVisibility): boolean {
    const min = entry.minRole ?? (entry.adminOnly ? 'platform' : 'student');
    if (min === 'platform') return vis.hasPlatformAdmin;
    if (min === 'owner') return vis.hasPlatformAdmin || vis.hasOwner;
    if (min === 'admin') return vis.hasPlatformAdmin || vis.hasOwner || vis.hasAdmin;
    if (min === 'instructor') return vis.hasPlatformAdmin || vis.hasOwner || vis.hasAdmin || vis.hasInstructor;
    return true; // student = everyone
}

export function getDocVisibility(user: { isPlatformAdmin?: boolean; tenants?: { roles: string[] }[] }): DocVisibility {
    const tenants = user?.tenants ?? [];
    const allRoles = new Set(tenants.flatMap((t: { roles: string[] }) => t.roles ?? []));
    return {
        hasPlatformAdmin: !!user?.isPlatformAdmin,
        hasOwner: allRoles.has('owner'),
        hasAdmin: allRoles.has('admin'),
        hasInstructor: allRoles.has('instructor'),
    };
}
