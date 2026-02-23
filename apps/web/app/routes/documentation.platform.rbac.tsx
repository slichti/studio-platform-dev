import { useOutletContext, Navigate } from "react-router";
import { Shield, Users, KeyRound, Network, FileText } from "lucide-react";

export default function PlatformRBAC() {
    const { isPlatformAdmin } = useOutletContext<{ isPlatformAdmin: boolean }>();

    // Guard: Only platform admins can view this
    if (!isPlatformAdmin) {
        return <Navigate to="/documentation" replace />;
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <header className="space-y-3">
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-3 font-serif">
                    <Shield className="text-purple-500" /> RBAC, Roles & Permissions
                </h1>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-4xl leading-relaxed">
                    High-level map of what the Studio Platform can do, who can do it, and how role-based access control (RBAC)
                    is enforced across the API, web app, and mobile clients.
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                    Source of truth: <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">docs/features_rbac_overview.md</code>
                </p>
            </header>

            {/* Personas & Roles */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Users className="text-blue-500" /> Personas & Built-in Roles
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        {
                            title: "Platform Admin",
                            badge: "Global",
                            description: "Operates the SaaS itself across all tenants (plans, billing, backups, feature flags). Identified by users.isPlatformAdmin === true.",
                        },
                        {
                            title: "Studio Owner",
                            badge: "Tenant",
                            description: "Owns a single studio/tenant. Full control over operations, billing, staff, and settings within that tenant.",
                        },
                        {
                            title: "Studio Admin / Manager",
                            badge: "Tenant",
                            description: "Day-to-day operations lead (front desk, GM). Broad operational permissions but cannot manage the platform itself.",
                        },
                        {
                            title: "Instructor / Staff",
                            badge: "Tenant",
                            description: "Teaches classes/appointments, manages rosters and limited POS actions.",
                        },
                        {
                            title: "Student / Member",
                            badge: "Tenant",
                            description: "Books classes, manages own profile, memberships, and purchases. Scoped strictly to own data.",
                        },
                        {
                            title: "Custom Roles",
                            badge: "Tenant",
                            description: "Per-tenant roles defined via Roles UI. Permissions merged into base role via PermissionService.resolvePermissions.",
                        },
                    ].map((role) => (
                        <div
                            key={role.title}
                            className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{role.title}</h3>
                                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
                                    {role.badge}
                                </span>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug">{role.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Role → Permission Matrix (summary) */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <KeyRound className="text-emerald-500" /> Role → Permission Matrix (Summary)
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
                    Detailed descriptions live in the markdown document; this table summarizes the default mapping for built-in roles.
                </p>
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
                            {[
                                { key: "manage_tenant", owner: true, admin: false, inst: false, student: false },
                                { key: "manage_members", owner: true, admin: true, inst: false, student: false },
                                { key: "manage_classes", owner: true, admin: true, inst: true, student: false },
                                { key: "view_reports", owner: true, admin: true, inst: false, student: false },
                                { key: "manage_commerce", owner: true, admin: true, inst: false, student: false },
                                { key: "manage_payroll", owner: true, admin: true, inst: false, student: false },
                                { key: "check_in_students", owner: true, admin: true, inst: true, student: false },
                                { key: "view_progress", owner: true, admin: true, inst: true, student: "Own only" },
                            ].map((row) => (
                                <tr key={row.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">{row.key}</td>
                                    <td className="px-3 py-2.5 text-center">✅</td>
                                    <td className="px-3 py-2.5 text-center">{row.owner ? "✅" : "—"}</td>
                                    <td className="px-3 py-2.5 text-center">{row.admin ? "✅" : "—"}</td>
                                    <td className="px-3 py-2.5 text-center">{row.inst ? "✅" : "—"}</td>
                                    <td className="px-3 py-2.5 text-center text-xs">
                                        {row.student === "Own only" ? <span className="opacity-70">Own only</span> : row.student ? "✅" : "—"}
                                    </td>
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
                    Every authenticated request passes through authentication, tenant resolution, and permission resolution before sensitive
                    handlers run.
                </p>
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <pre className="mermaid text-xs leading-snug">
{`flowchart TD
    A[Incoming Request] --> AUTH[Auth Middleware<br/>Clerk JWT]
    AUTH --> TENANT[Tenant Middleware<br/>load tenant + roles]
    TENANT --> PERMS[PermissionService.resolvePermissions]
    PERMS --> CTX[c.set('can')]
    CTX --> ROUTE[Route Handler]
    ROUTE -->|c.get('can')('manage_classes')| DECIDE{Allowed?}
    DECIDE -- Yes --> OK[Proceed]
    DECIDE -- No --> ERR[403 Forbidden]`}
                    </pre>
                </div>
            </section>

            {/* Link back to source doc */}
            <section className="space-y-2 border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <FileText className="text-zinc-500" /> Full RBAC Reference
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    For the complete list of permissions, domain mappings, and student capability matrix, see{" "}
                    <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                        docs/features_rbac_overview.md
                    </code>{" "}
                    in the repository.
                </p>
            </section>
        </div>
    );
}

