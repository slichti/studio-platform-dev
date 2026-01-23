import { useEffect } from "react";
import mermaid from "mermaid";
import { Mail, MessageSquare, Award, UserPlus } from "lucide-react";

export default function CRMDocs() {
    useEffect(() => {
        mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
        mermaid.contentLoaded();
    }, []);

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">CRM & Marketing</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Grow your community by nurturing leads, automating communications, and rewarding loyalty.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Leads & Pipeline */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <UserPlus className="text-blue-500" /> Lead Management
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                        Capture potential students through Intro Offers and Webforms. Track their journey from "Interested" to "Active Member".
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50">
                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Lead Stages</h4>
                        <pre className="mermaid bg-transparent">
                            {`
                            graph LR
                                A[New Lead] --> B[Contacted]
                                B --> C[Trial Started]
                                C --> D[Converted Member]
                                C --> E[Lost]
                                E -.->|Win-Back Campaign| B
                            `}
                        </pre>
                    </div>
                </section>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Automations */}
                    <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <Mail className="text-purple-500" /> Email Automations
                        </h2>
                        <ul className="space-y-3 text-zinc-600 dark:text-zinc-400 text-sm">
                            <li><strong>Welcome Drip:</strong> Send a sequence of emails to new signups.</li>
                            <li><strong>Win-Back:</strong> Automatically email students who haven't visited in 30 days.</li>
                            <li><strong>Birthday Wishes:</strong> Send a discount code on their special day.</li>
                            <li><strong>Membership Expiry:</strong> Remind students to renew 7 days before expiration.</li>
                        </ul>
                    </section>

                    {/* Loyalty */}
                    <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <Award className="text-orange-500" /> Gamified Loyalty
                        </h2>
                        <ul className="space-y-3 text-zinc-600 dark:text-zinc-400 text-sm">
                            <li><strong>Points System:</strong> Earn points for attending classes, referring friends, or posting on social media.</li>
                            <li><strong>Challenges:</strong> "30 Days of Yoga" or "Summer Shred" competitions.</li>
                            <li><strong>Referrals:</strong> Give $20, Get $20 referral program tracking.</li>
                        </ul>
                    </section>
                </div>

                {/* Chat */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <MessageSquare className="text-teal-500" /> Two-Way Messaging
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400">
                        Communicate with students directly via SMS and In-App Chat. All conversations are centralized in the Studio Dashboard so your staff can respond quickly.
                    </p>
                </section>
            </div>
        </div>
    );
}
