
import { useLoaderData, useOutletContext, Form } from "react-router"; 
import type { LoaderFunctionArgs } from "react-router"; 
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { User, Mail, Calendar, CreditCard, LogOut, Shield } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    try {
        const [billingInfo, memberships] = await Promise.all([
            // Mocking billing info endpoint for now or check if it exists
            Promise.resolve({ balance: 0, paymentMethods: [] }),
            apiRequest(`/memberships/my-active`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => [])
        ]);
        return { billingInfo, memberships };
    } catch (e) {
        return { billingInfo: null, memberships: [] };
    }
};

export default function StudentPortalProfile() {
    const { me, tenant } = useOutletContext<any>();
    const { billingInfo, memberships } = useLoaderData<typeof loader>();

    // Fallback if me or profile is missing
    const firstName = me?.firstName || 'Student';
    const lastName = me?.lastName || '';
    const email = me?.email || 'No email';
    const joinedAt = me?.joinedAt ? new Date(me.joinedAt).toLocaleDateString() : 'Unknown';

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Profile</h1>

            {/* Profile Card */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold">
                        {firstName[0]}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{firstName} {lastName}</h2>
                        <div className="space-y-1 mt-2">
                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                                <Mail size={14} />
                                {email}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                                <Calendar size={14} />
                                Member since {joinedAt}
                            </div>
                        </div>
                    </div>
                    <Form action="/sign-out" method="post">
                        <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                            <LogOut size={14} />
                            Log Out
                        </button>
                    </Form>
                </div>
            </section>

            {/* Memberships */}
            <section>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-4">Active Memberships</h3>
                {memberships.length > 0 ? (
                    <div className="space-y-3">
                        {memberships.map((m: any) => (
                            <div key={m.id} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-zinc-900 dark:text-zinc-100">{m.plan.name}</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">Renews {new Date(m.nextBillingDate).toLocaleDateString()}</div>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">
                                    Active
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center text-zinc-500">
                        No active memberships found.
                    </div>
                )}
            </section>

            {/* Policies */}
            <section className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <Shield size={16} />
                    Policies & Waivers
                </h3>
                <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 text-sm text-zinc-500">
                    <div className="flex justify-between items-center">
                        <span>Liability Waiver</span>
                        <span className="text-emerald-600 font-medium text-xs">Signed on {joinedAt}</span>
                    </div>
                </div>
            </section>
        </div>
    );
}
