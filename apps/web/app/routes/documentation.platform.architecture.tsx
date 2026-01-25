
import { useOutletContext, Navigate } from "react-router";
import { Server, Database, Cloud, Shield, Globe, Lock } from "lucide-react";
import { useEffect } from "react";

export default function PlatformArchitecture() {
    useEffect(() => {
        // Dynamically import mermaid to avoid SSR/Hydration mismatches (global style injection)
        import("mermaid").then((mermaid) => {
            mermaid.default.initialize({ startOnLoad: true, theme: 'neutral' });
            mermaid.default.contentLoaded();
        });
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
                                {`
                                graph TD
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
                                    end
                                `}
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

            {/* Key Services */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Key Services</h2>
                <div className="grid md:grid-cols-3 gap-4">
                    {['Billing (Stripe Connect)', 'Realtime Chat (Durable Objects)', 'Video Processing (R2 + Workers)', 'Email (Resend/System)', 'SMS (Twilio)', 'Marketing Automations (Crons)', 'Inventory Management (Retail)'].map((service, i) => (
                        <div key={i} className="px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {service}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
