import { useOutletContext, Navigate } from "react-router";
import { Shield, Users, KeyRound, Network, FileText, Layers, Code } from "lucide-react";
import { ClientOnly } from "~/components/ClientOnly";
import { MermaidDiagram } from "~/components/MermaidDiagram.client";

const RBAC_FLOW_CHART = `flowchart TD
    subgraph "Request Handling"
        A[Incoming HTTP Request] --> AUTH[Auth Middleware<br/>Clerk JWT]
        AUTH --> TENANT[Tenant Middleware<br/>load tenant + roles]
        TENANT --> PERMS[PermissionService.resolvePermissions<br/>(roles, customRoles)]
        PERMS --> CTX[Context<br/>c.set('can')]
        CTX --> ROUTE[Route Handler]
    end

    subgraph "Role & Permission Model"
        PA[Platform Admin<br/>isPlatformAdmin] --> ALLP[All Permissions]
        OWN[Owner Role] --> RP1[RolePermissions.owner]
        ADM[Admin Role] --> RP2[RolePermissions.admin]
        INST[Instructor Role] --> RP3[RolePermissions.instructor]
        STU[Student Role] --> RP4[RolePermissions.student]

        RP1 --> PERMSET[(Permission Set)]
        RP2 --> PERMSET
        RP3 --> PERMSET
        RP4 --> PERMSET
        CUSTOM[Custom Role Permissions] --> PERMSET
    end

    ROUTE -->|c.get('can')('manage_classes')| DECIDE{Allowed?}
    DECIDE -- Yes --> OK[Proceed with action]
    DECIDE -- No --> FORBID[403 Forbidden]`;

const FEATURE_MAP_CHART = `flowchart LR
    subgraph "Roles"
        R1[Platform Admin]
        R2[Owner]
        R3[Admin]
        R4[Instructor]
        R5[Student]
    end

    subgraph "Feature Domains"
        F1[Tenant & Settings]
        F2[Members & Leads]
        F3[Classes & Appointments]
        F4[Commerce & POS]
        F5[LMS & Progress]
        F6[Analytics & Payroll]
        F7[Marketing & Automations]
    end

    R1 --> F1
    R1 --> F6

    R2 --> F1
    R2 --> F2
    R2 --> F3
    R2 --> F4
    R2 --> F5
    R2 --> F6
    R2 --> F7

    R3 --> F2
    R3 --> F3
    R3 --> F4
    R3 --> F5
    R3 --> F6
    R3 --> F7

    R4 --> F3
    R4 --> F4
    R4 --> F5

    R5 --> F3
    R5 --> F4
    R5 --> F5`;

const FULL_ROLE_MATRIX = [
    { key: "manage_tenant", owner: true, admin: false, inst: false, student: false },
    { key: "view_tenant", owner: true, admin: true, inst: false, student: false },
    { key: "manage_billing", owner: true, admin: false, inst: false, student: false },
    { key: "view_billing", owner: true, admin: false, inst: false, student: false },
    { key: "manage_members", owner: true, admin: true, inst: false, student: false },
    { key: "view_members", owner: true, admin: true, inst: true, student: false },
    { key: "manage_classes", owner: true, admin: true, inst: true, student: false },
    { key: "view_classes", owner: true, admin: true, inst: true, student: "scoped" },
    { key: "manage_staff", owner: true, admin: true, inst: false, student: false },
    { key: "view_reports", owner: true, admin: true, inst: false, student: false },
    { key: "manage_reports", owner: true, admin: true, inst: false, student: false },
    { key: "view_financials", owner: true, admin: true, inst: false, student: false },
    { key: "check_in_students", owner: true, admin: true, inst: true, student: false },
    { key: "manage_pos", owner: true, admin: true, inst: true, student: false },
    { key: "view_pos", owner: true, admin: true, inst: true, student: false },
    { key: "manage_inventory", owner: true, admin: true, inst: true, student: false },
    { key: "manage_marketing", owner: true, admin: true, inst: false, student: false },
    { key: "view_settings", owner: true, admin: true, inst: false, student: false },
    { key: "manage_settings", owner: true, admin: true, inst: false, student: false },
    { key: "manage_content", owner: true, admin: true, inst: true, student: false },
    { key: "manage_leads", owner: true, admin: true, inst: false, student: false },
    { key: "manage_community", owner: true, admin: true, inst: false, student: false },
    { key: "view_commerce", owner: true, admin: true, inst: false, student: false },
    { key: "manage_commerce", owner: true, admin: true, inst: false, student: false },
    { key: "view_progress", owner: true, admin: true, inst: true, student: "Own only" },
    { key: "manage_progress", owner: true, admin: true, inst: false, student: false },
    { key: "manage_payroll", owner: true, admin: true, inst: false, student: false },
];

const STUDENT_CAPABILITY_ROWS = [
    { domain: "Classes", can: "View schedule, book classes, cancel own bookings, view history", cannot: "Create/edit/delete classes, change instructors, run class reports" },
    { domain: "Packs & Credits", can: "View own packs and balances; purchase packs via checkout", cannot: "Create/edit pack definitions or discounts" },
    { domain: "Memberships", can: "Browse plans, subscribe, pause/resume/cancel own subscription", cannot: "Create/modify/delete membership plans or global pricing" },
    { domain: "Courses", can: "Enroll, watch lessons, submit quizzes/assignments, see own progress", cannot: "Create/edit/delete courses and curriculum, view other members' progress" },
    { domain: "Profile", can: "View & edit own basic profile (name, phone, bio, notification prefs)", cannot: "Edit other profiles, manage tenant-wide settings" },
    { domain: "Commerce History", can: "View own invoices/receipts, download PDFs", cannot: "View other members' invoices, global revenue reports" },
    { domain: "Notifications", can: "Opt into/out of email/SMS notifications (where supported)", cannot: "Change global communication policies or defaults" },
    { domain: "Analytics", can: "—", cannot: "Access /analytics/* and sensitive financial/ops dashboards" },
    { domain: "Admin Tools", can: "—", cannot: "Access audit logs, tags/custom fields admin, imports, CRM task admin" },
];

export default function PlatformRBAC() {
    const { isPlatformAdmin } = useOutletContext<{ isPlatformAdmin: boolean }>();

    if (!isPlatformAdmin) {
        return <Navigate to="/documentation" replace />;
    }

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <header className="space-y-3">
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-3 font-serif">
                    <Shield className="text-purple-500" /> RBAC, Roles & Permissions
                </h1>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-4xl leading-relaxed">
                    Full reference for what the Studio Platform can do, who can do it, and how role-based access control (RBAC)
                    is enforced across the API, web app, and mobile clients.
                </p>
            </header>

            {/* Personas & Roles */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Users className="text-blue-500" /> Personas & Built-in Roles
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        { title: "Platform Admin", badge: "Global", description: "Operates the SaaS itself (all tenants, plans, billing, backups, feature flags). users.isPlatformAdmin === true." },
                        { title: "Studio Owner", badge: "Tenant", description: "Owns a single studio/tenant. Full control over operations, billing, staff, and settings within that tenant." },
                        { title: "Studio Admin / Manager", badge: "Tenant", description: "Day-to-day operations lead (front desk, GM). Broad operational permissions but cannot manage the platform itself." },
                        { title: "Instructor / Staff", badge: "Tenant", description: "Teaches classes/appointments, manages rosters and limited POS actions." },
                        { title: "Student / Member", badge: "Tenant", description: "Books classes, manages own profile, memberships, purchases. Scoped strictly to own data." },
                        { title: "Custom Roles", badge: "Tenant", description: "Per-tenant roles via Roles UI. Permissions merged via PermissionService.resolvePermissions." },
                    ].map((role) => (
                        <div key={role.title} className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{role.title}</h3>
                                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">{role.badge}</span>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug">{role.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Permission Keys */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <KeyRound className="text-emerald-500" /> Permission Keys (API-level)
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Source: <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">packages/api/src/services/permissions.ts</code></p>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                        <strong className="text-zinc-900 dark:text-zinc-100">Tenant & Billing</strong>
                        <ul className="text-zinc-600 dark:text-zinc-400 space-y-0.5 font-mono text-xs">
                            <li>manage_tenant, view_tenant, manage_billing, view_billing</li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                        <strong className="text-zinc-900 dark:text-zinc-100">Members & CRM</strong>
                        <ul className="text-zinc-600 dark:text-zinc-400 space-y-0.5 font-mono text-xs">
                            <li>manage_members, view_members, manage_leads, manage_community</li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                        <strong className="text-zinc-900 dark:text-zinc-100">Classes & Appointments</strong>
                        <ul className="text-zinc-600 dark:text-zinc-400 space-y-0.5 font-mono text-xs">
                            <li>manage_classes, view_classes, check_in_students</li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                        <strong className="text-zinc-900 dark:text-zinc-100">Staff & Payroll</strong>
                        <ul className="text-zinc-600 dark:text-zinc-400 space-y-0.5 font-mono text-xs">
                            <li>manage_staff, manage_payroll</li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                        <strong className="text-zinc-900 dark:text-zinc-100">Commerce & POS</strong>
                        <ul className="text-zinc-600 dark:text-zinc-400 space-y-0.5 font-mono text-xs">
                            <li>manage_pos, view_pos, manage_inventory, view_commerce, manage_commerce</li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                        <strong className="text-zinc-900 dark:text-zinc-100">Reports, Progress & Settings</strong>
                        <ul className="text-zinc-600 dark:text-zinc-400 space-y-0.5 font-mono text-xs">
                            <li>view_reports, manage_reports, view_financials, view_progress, manage_progress, view_settings, manage_settings, manage_content</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Full Role → Permission Matrix */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <KeyRound className="text-emerald-500" /> Built-in Role → Permission Matrix
                </h2>
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm">
                    <table className="min-w-full">
                        <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                            <tr>
                                <th className="px-4 py-3 text-left">Permission</th>
                                <th className="px-3 py-3 text-center">Platform Admin</th>
                                <th className="px-3 py-3 text-center">Owner</th>
                                <th className="px-3 py-3 text-center">Admin</th>
                                <th className="px-3 py-3 text-center">Instructor</th>
                                <th className="px-3 py-3 text-center">Student</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {FULL_ROLE_MATRIX.map((row) => (
                                <tr key={row.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">{row.key}</td>
                                    <td className="px-3 py-2.5 text-center">✅</td>
                                    <td className="px-3 py-2.5 text-center">{row.owner ? "✅" : "—"}</td>
                                    <td className="px-3 py-2.5 text-center">{row.admin ? "✅" : "—"}</td>
                                    <td className="px-3 py-2.5 text-center">{row.inst ? "✅" : "—"}</td>
                                    <td className="px-3 py-2.5 text-center text-xs">
                                        {typeof row.student === "string" ? <span className="opacity-70">{row.student}</span> : row.student ? "✅" : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Features by Domain */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Layers className="text-amber-500" /> Features & Capabilities by Domain
                </h2>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                    {[
                        { domain: "Tenant & Settings", perms: "manage_tenant, view_tenant, manage_settings, view_settings, manage_billing, view_billing" },
                        { domain: "Members, Leads, Community", perms: "manage_members, view_members, manage_leads, manage_community" },
                        { domain: "Classes, Appointments & Booking", perms: "manage_classes, view_classes, check_in_students" },
                        { domain: "Commerce, POS, Inventory", perms: "manage_commerce, view_commerce, manage_pos, view_pos, manage_inventory" },
                        { domain: "LMS, Courses & Progress", perms: "manage_content, view_progress, manage_progress" },
                        { domain: "Analytics, Reports & Payroll", perms: "view_reports, manage_reports, view_financials, manage_payroll" },
                        { domain: "Marketing & Automations", perms: "manage_marketing" },
                    ].map((item) => (
                        <div key={item.domain} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                            <strong className="text-zinc-900 dark:text-zinc-100">{item.domain}</strong>
                            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1">{item.perms}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Student Capability Matrix */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Users className="text-teal-500" /> Student Capability Matrix
                </h2>
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm">
                    <table className="min-w-full">
                        <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                            <tr>
                                <th className="px-4 py-3 text-left">Domain</th>
                                <th className="px-4 py-3 text-left">Student CAN</th>
                                <th className="px-4 py-3 text-left">Student CANNOT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {STUDENT_CAPABILITY_ROWS.map((row) => (
                                <tr key={row.domain} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                                    <td className="px-4 py-2.5 font-medium text-zinc-700 dark:text-zinc-300">{row.domain}</td>
                                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">{row.can}</td>
                                    <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-500">{row.cannot}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* RBAC Flow Diagram */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Network className="text-sky-500" /> RBAC Evaluation Flow
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
                    Every authenticated request passes through auth, tenant resolution, and permission resolution before sensitive handlers run.
                </p>
                <ClientOnly fallback={<div className="h-64 flex items-center justify-center text-zinc-500 text-sm">Loading diagram…</div>}>
                    <MermaidDiagram chart={RBAC_FLOW_CHART} title="Request → Permission Resolution" />
                </ClientOnly>
            </section>

            {/* Feature Map Diagram */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Network className="text-violet-500" /> Feature Map by Role
                </h2>
                <ClientOnly fallback={<div className="h-48 flex items-center justify-center text-zinc-500 text-sm">Loading diagram…</div>}>
                    <MermaidDiagram chart={FEATURE_MAP_CHART} title="Roles → Feature Domains" />
                </ClientOnly>
            </section>

            {/* Where Enforcement Lives */}
            <section className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Code className="text-zinc-500" /> Where Enforcement Lives in Code
                </h2>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <strong className="text-zinc-900 dark:text-zinc-100">API</strong>
                        <ul className="mt-2 text-zinc-600 dark:text-zinc-400 space-y-1 text-xs">
                            <li>• <code>middleware/tenant.ts</code> — Resolves tenant, roles, injects <code>c.set('can')</code></li>
                            <li>• <code>services/permissions.ts</code> — Permission, RolePermissions, PermissionService</li>
                            <li>• Route files call <code>c.get('can')('permission_key')</code> before sensitive logic</li>
                        </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <strong className="text-zinc-900 dark:text-zinc-100">Web & Mobile</strong>
                        <ul className="mt-2 text-zinc-600 dark:text-zinc-400 space-y-1 text-xs">
                            <li>• Studio routes use <code>useOutletContext</code> for roles, hide/show UI by capability</li>
                            <li>• Portal routes rely on API ownership checks for student scope</li>
                        </ul>
                    </div>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Full source: <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">docs/features_rbac_overview.md</code>
                </p>
            </section>
        </div>
    );
}
