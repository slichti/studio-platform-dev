
import { useOutletContext, Navigate } from "react-router";
import { Server, Database, Cloud, Shield, Globe, Lock } from "lucide-react";
import { useEffect } from "react";

export default function PlatformArchitecture() {
    useEffect(() => {

    }, []);

    const { isPlatformAdmin } = useOutletContext<{ isPlatformAdmin: boolean }>();

    // Guard: Only platform admins can view this
    if (!isPlatformAdmin) {
        return <Navigate to="/documentation" replace />;
    }

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Platform Architecture</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    High-level overview of the Studio Platform infrastructure, built on Cloudflare's edge network for performance and scalability.
                </p>
            </div>

            {/* Core Stack */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                    <Cloud className="text-blue-500" /> Core Infrastructure
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-3 mb-4">
                            <Globe size={20} className="text-orange-500" />
                            <h3 className="font-bold text-lg">Cloudflare Workers & Pages</h3>
                        </div>
                        <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                            <li>• <strong>Web App:</strong> Deployed to Cloudflare Pages (Remix/React Router).</li>
                            <li>• <strong>API Layer:</strong> Cloudflare Workers (Hono framework).</li>
                            <li>• <strong>Edge Runtime:</strong> Code runs within milliseconds of users globally.</li>
                        </ul>
                        <div className="mt-4">
                            <pre className="mermaid">
                                {`graph TD
    User[User Browser] -->|HTTPS| CF[Cloudflare Network]
    CF -->|Asset Request| Pages[Pages (Static Assets)]
    CF -->|API Request| Worker[Worker (Hono API)]
    Worker -->|Query| D1[(D1 Database)]
    Worker -->|Upload| R2[(R2 Storage)]
    Worker -.->|Payment| Stripe[Stripe Connect]
    Worker -.->|Email| Resend[Resend / SMTP]
    Worker -.->|SMS| Twilio[Twilio]
    
    subgraph "New Capabilities"
    Worker -->|Aggregations| Analytics[Analytics Engine (SQLite)]
    Worker -.->|Push| Expo[Expo Push Notifications]
    end`}
                            </pre>
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-3 mb-4">
                            <Database size={20} className="text-green-500" />
                            <h3 className="font-bold text-lg">Data & Storage</h3>
                        </div>
                        <ul className="space-y-2 text-zinc-600 dark:text-zinc-400 text-sm">
                            <li>• <strong>Database:</strong> Cloudflare D1 (SQLite at the edge).</li>
                            <li>• <strong>Object Storage:</strong> Cloudflare R2 (Images, Videos, Assets).</li>
                            <li>• <strong>ORM:</strong> Drizzle ORM for type-safe database queries.</li>
                            <li>• <strong>Analytics:</strong> Optimized group-by queries for Reporting.</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Security */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                    <Shield className="text-purple-500" /> Security & Identity
                </h2>
                <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        We use a hybrid approach for authentication and multi-tenancy to ensure data isolation and secure access.
                    </p>

                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Lock size={16} /> Identity Provider
                            </h4>
                            <p className="text-sm text-zinc-500">
                                <strong>Clerk</strong> handles user identity, MFA, and session management.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Server size={16} /> API Security
                            </h4>
                            <p className="text-sm text-zinc-500">
                                Validates JWTs using RS256 (Clerk) and HS256 (Impersonation) algorithms.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Database size={16} /> Data Isolation
                            </h4>
                            <p className="text-sm text-zinc-500">
                                Logical isolation using <code>tenantId</code> column on all major tables.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Site Map & Structure */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                    <Globe className="text-blue-500" /> Platform Structure
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <h3 className="font-bold text-lg mb-4">Global Network</h3>
                        <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                            <li className="flex items-start gap-2">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                                <span><strong>Marketing & Auth:</strong> Public landing page and centralized Clerk authentication.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                                <span><strong>Admin Portal:</strong> Super-admin dashboard for platform oversight (`/admin`).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                                <span><strong>Documentation:</strong> Internal search-indexed knowledge base.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <h3 className="font-bold text-lg mb-4">Tenant Scope (`/studio/:slug`)</h3>
                        <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                            <li className="flex items-start gap-2">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                <span><strong>Dashboard:</strong> Central command center for owners and staff.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                <span><strong>Student Portal:</strong> Specialized view for members to book classes and view history.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                <span><strong>Commerce:</strong> Integrated Stripe Connect payments for memberships and packs.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Tier Feature Matrix */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Feature Access Matrix</h2>
                <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold">
                            <tr>
                                <th className="px-6 py-4">Feature Module</th>
                                <th className="px-6 py-4 text-center text-zinc-500">Launch</th>
                                <th className="px-6 py-4 text-center text-blue-600">Growth</th>
                                <th className="px-6 py-4 text-center text-purple-600">Scale</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                            {[
                                { name: 'Core Booking & Scheduling', launch: true, growth: true, scale: true },
                                { name: 'Stripe Payments', launch: true, growth: true, scale: true },
                                { name: 'Staff Accounts', launch: '3', growth: 'Unlimited', scale: 'Unlimited' },
                                { name: 'Email Automations', launch: false, growth: true, scale: true },
                                { name: 'Loyalty & Challenges', launch: false, growth: true, scale: true },
                                { name: 'Video Library (VOD)', launch: false, growth: true, scale: true },
                                { name: 'Point of Sale (POS)', launch: false, growth: true, scale: true },
                                { name: 'Website Builder', launch: false, growth: false, scale: true },
                                { name: 'Branded Mobile App', launch: false, growth: false, scale: true },
                                { name: 'Payroll Automation', launch: false, growth: false, scale: true },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">{row.name}</td>
                                    <td className="px-6 py-4 text-center">
                                        {row.launch === true ? '✅' : row.launch === false ? <span className="opacity-20">No</span> : row.launch}
                                    </td>
                                    <td className="px-6 py-4 text-center font-medium bg-blue-50/50 dark:bg-blue-900/10">
                                        {row.growth === true ? '✅' : row.growth === false ? <span className="opacity-20">No</span> : row.growth}
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold bg-purple-50/50 dark:bg-purple-900/10">
                                        {row.scale === true ? '✅' : row.scale === false ? <span className="opacity-20">No</span> : row.scale}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
