import { useOutletContext, Navigate } from "react-router";
import { Key, ExternalLink, CheckSquare, List, Globe, Building2 } from "lucide-react";

export default function PlatformClerk() {
    const { isPlatformAdmin } = useOutletContext<{ isPlatformAdmin: boolean }>();

    if (!isPlatformAdmin) {
        return <Navigate to="/documentation" replace />;
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif flex items-center gap-3">
                    <Key className="text-amber-500" /> Clerk Configuration
                </h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    How to enable and configure social / IdP login (Google, Facebook, Microsoft) in the Clerk Dashboard for user-account testing and production.
                </p>
            </div>

            {/* Where to configure */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <List className="text-blue-500" /> 1. Where to configure
                </h2>
                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                    <li><strong>Clerk Dashboard</strong> → <a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">User &amp; Authentication <ExternalLink size={14} /></a> → <strong>SSO &amp; Social Connections</strong> (or Social connections / User &amp; Authentication → Social).</li>
                    <li>URL pattern: <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm">https://dashboard.clerk.com/&lt;your-instance&gt;/user-authentication/sso-connections</code> (exact label may vary by Dashboard version).</li>
                </ul>
            </section>

            {/* Enabling each provider */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <Key className="text-amber-500" /> 2. Enabling each provider
                </h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Development instance</h3>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-3">Clerk often provides <strong>shared OAuth credentials</strong> for development:</p>
                        <ol className="list-decimal list-inside space-y-2 text-zinc-600 dark:text-zinc-400">
                            <li>Open <strong>SSO &amp; Social Connections</strong> (or equivalent).</li>
                            <li>For each provider (Google, Facebook, Microsoft): click <strong>Add connection</strong> (or Enable), choose <strong>“For all users”</strong>, leave <strong>“Use custom credentials”</strong> off unless you need your own app.</li>
                            <li>No Client ID/Secret needed for dev; Clerk’s shared credentials are used.</li>
                            <li><strong>Allowed redirect URIs</strong> are usually pre-set; for localhost you may need to add your dev URL in <strong>Domains</strong> / <strong>Allowed origins</strong> (see section 3).</li>
                        </ol>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Production (custom credentials)</h3>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-4">For production you must create your own OAuth apps and plug credentials into Clerk.</p>

                        <div className="space-y-4">
                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-800/50">
                                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Google</h4>
                                <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                                    <li><a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Google Cloud Console</a> → APIs &amp; Services → Credentials → Create credentials → OAuth 2.0 Client ID.</li>
                                    <li>Application type: <strong>Web application</strong>.</li>
                                    <li><strong>Authorized JavaScript origins:</strong> your production domain and <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">https://&lt;your-clerk-frontend-api&gt;.clerk.accounts.dev</code>.</li>
                                    <li><strong>Authorized redirect URIs:</strong> add the callback URL Clerk shows in the Dashboard (e.g. <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">.../v1/oauth_callback</code>).</li>
                                    <li>Copy Client ID and Client Secret into Clerk Dashboard for Google → Use custom credentials.</li>
                                </ol>
                            </div>
                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-800/50">
                                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Facebook</h4>
                                <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                                    <li><a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Meta for Developers</a> → create or select app → Facebook Login → Settings.</li>
                                    <li><strong>Valid OAuth Redirect URIs:</strong> add the redirect URI Clerk shows in the Dashboard.</li>
                                    <li>In Clerk Dashboard → Facebook → Use custom credentials → paste <strong>App ID</strong> (Client ID) and <strong>App Secret</strong> (Client Secret).</li>
                                </ol>
                            </div>
                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-800/50">
                                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Microsoft (Azure AD / Entra)</h4>
                                <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                                    <li><a href="https://portal.azure.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Azure Portal</a> → Microsoft Entra ID (or Azure AD) → App registrations → New registration.</li>
                                    <li>Supported account types: e.g. <strong>Accounts in any organizational directory and personal Microsoft accounts</strong>.</li>
                                    <li><strong>Redirect URI:</strong> Web → add the callback URL Clerk gives.</li>
                                    <li>Certificates &amp; secrets → New client secret → copy value.</li>
                                    <li>In Clerk Dashboard → Microsoft → Use custom credentials → paste <strong>Application (client) ID</strong> and <strong>Client secret</strong>.</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Domains / allowed origins */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <Globe className="text-green-500" /> 3. Domains / allowed origins (important for testing)
                </h2>
                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-2">
                    <li>In Clerk Dashboard go to <strong>Domains</strong> (or Paths / Allowed redirect URLs).</li>
                    <li>Add every origin where your app runs: <strong>Development:</strong> <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm">http://localhost:5173</code> (or your Vite port), <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm">http://127.0.0.1:5173</code>. <strong>Staging/production:</strong> <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm">https://your-app-domain.com</code>.</li>
                    <li>If you use a custom sign-in/sign-up domain, add it here as well.</li>
                </ul>
            </section>

            {/* How this matches the app */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <Building2 className="text-purple-500" /> 4. How this matches our app
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse border border-zinc-200 dark:border-zinc-700">
                        <thead>
                            <tr className="bg-zinc-100 dark:bg-zinc-800">
                                <th className="border border-zinc-200 dark:border-zinc-700 p-3 text-left font-semibold text-zinc-900 dark:text-zinc-100">Flow</th>
                                <th className="border border-zinc-200 dark:border-zinc-700 p-3 text-left font-semibold text-zinc-900 dark:text-zinc-100">Implementation</th>
                                <th className="border border-zinc-200 dark:border-zinc-700 p-3 text-left font-semibold text-zinc-900 dark:text-zinc-100">Social login behavior</th>
                            </tr>
                        </thead>
                        <tbody className="text-zinc-600 dark:text-zinc-400">
                            <tr>
                                <td className="border border-zinc-200 dark:border-zinc-700 p-3 font-medium">Sign-in</td>
                                <td className="border border-zinc-200 dark:border-zinc-700 p-3"><code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">apps/web/app/routes/sign-in.$.tsx</code> uses Clerk’s prebuilt <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{`<SignIn />`}</code></td>
                                <td className="border border-zinc-200 dark:border-zinc-700 p-3">Once Google/Facebook/Microsoft are enabled in the Clerk Dashboard, their buttons appear on <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">/sign-in</code> automatically. No code change.</td>
                            </tr>
                            <tr>
                                <td className="border border-zinc-200 dark:border-zinc-700 p-3 font-medium">Sign-up</td>
                                <td className="border border-zinc-200 dark:border-zinc-700 p-3"><code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">CustomSignUp</code> (email + password only)</td>
                                <td className="border border-zinc-200 dark:border-zinc-700 p-3">Social providers are not shown on <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">/sign-up</code> until you use Clerk’s prebuilt <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">&lt;SignUp /&gt;</code> or add OAuth (e.g. <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">signUp.authenticateWithRedirect(&#123; strategy: &quot;oauth_google&quot; &#125;)</code>) to the custom form.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-sm">
                    For <strong>sign-in testing</strong> with Gmail/Facebook/Microsoft: configure the Dashboard as above and use <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">/sign-in</code>. For <strong>sign-up testing</strong> with those providers: add prebuilt SignUp or OAuth to CustomSignUp, then test.
                </p>
            </section>

            {/* Checklist */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <CheckSquare className="text-emerald-500" /> 5. Checklist for user-account testing
                </h2>
                <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
                    <li className="flex items-start gap-2"><span className="text-zinc-400 dark:text-zinc-500">☐</span> In Clerk Dashboard → SSO &amp; Social Connections, <strong>add Google</strong> (dev shared creds or prod custom).</li>
                    <li className="flex items-start gap-2"><span className="text-zinc-400 dark:text-zinc-500">☐</span> Add <strong>Facebook</strong> (same).</li>
                    <li className="flex items-start gap-2"><span className="text-zinc-400 dark:text-zinc-500">☐</span> Add <strong>Microsoft</strong> (same).</li>
                    <li className="flex items-start gap-2"><span className="text-zinc-400 dark:text-zinc-500">☐</span> Under Domains / allowed origins, add <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm">{`http://localhost:<port>`}</code> and any staging/production URLs.</li>
                    <li className="flex items-start gap-2"><span className="text-zinc-400 dark:text-zinc-500">☐</span> Open <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm">/sign-in</code> and confirm Google, Facebook, and Microsoft buttons appear and complete a sign-in.</li>
                    <li className="flex items-start gap-2"><span className="text-zinc-400 dark:text-zinc-500">☐</span> If you need social <strong>sign-up</strong>: add prebuilt <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm">{`<SignUp />`}</code> or OAuth to CustomSignUp, then test sign-up with each provider.</li>
                </ul>
            </section>

            {/* Optional: restrict strategies */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">6. Optional: restrict to email/password + chosen IdPs</h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-3">In Clerk Dashboard you can:</p>
                <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-1">
                    <li><strong>Enable/disable</strong> “Email address” and “Password” under Email, Phone, Username.</li>
                    <li><strong>Enable/disable</strong> each social connection independently.</li>
                </ul>
                <p className="mt-3 text-zinc-600 dark:text-zinc-400 text-sm">So you can offer only Google + Microsoft, or email/password + Google, etc., without changing code—only Dashboard toggles.</p>
            </section>

            {/* References */}
            <section className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">References</h2>
                <ul className="space-y-2 text-sm">
                    <li><a href="https://clerk.com/docs/guides/configure/auth-strategies/social-connections/overview" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">Clerk: Social connections (OAuth) overview <ExternalLink size={12} /></a></li>
                    <li><a href="https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">Clerk: Add Google <ExternalLink size={12} /></a></li>
                    <li><a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">Clerk Dashboard <ExternalLink size={12} /></a> → your instance → User &amp; Authentication → SSO &amp; Social Connections</li>
                </ul>
            </section>
        </div>
    );
}
