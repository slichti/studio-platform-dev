import React from "react";
import { Link, type MetaFunction } from "react-router";
import { PublicNav } from "~/components/PublicNav";
import { PublicFooter } from "~/components/PublicFooter";
import { Check, X, ArrowRight, Smartphone, Mail, Globe, Sparkles, MapPin } from "lucide-react";

export const meta: MetaFunction = () => [
    { title: "Compare – Studio Platform vs Mindbody, WellnessLiving, fitDEGREE, Arketa" },
    { name: "description", content: "See why Studio Platform is the ultimate all-in-one ecosystem for yoga studios and boutique gyms. Compare our built-in SMS, Marketing, AI, and Website capabilities against the competition." },
];

const COMPETITORS = [
    { id: 'studio', name: 'Studio Platform', isUs: true },
    { id: 'mindbody', name: 'Mindbody', isUs: false },
    { id: 'wellness', name: 'WellnessLiving', isUs: false },
    { id: 'fitdegree', name: 'fitDEGREE', isUs: false },
    { id: 'arketa', name: 'Arketa', isUs: false },
];

type FeatureItem = {
    name: string;
    studio: boolean | string;
    mindbody: boolean | string;
    wellness: boolean | string;
    fitdegree: boolean | string;
    arketa: boolean | string;
    tooltip?: string;
};

type FeatureCategory = {
    category: string;
    items: FeatureItem[];
};

const FEATURES: FeatureCategory[] = [
    {
        category: "Core Operations",
        items: [
            { name: "Class Scheduling & Booking", studio: true, mindbody: true, wellness: true, fitdegree: true, arketa: true },
            { name: "Memberships & Packages", studio: true, mindbody: true, wellness: true, fitdegree: true, arketa: true },
            { name: "POS & Retail Sales", studio: true, mindbody: true, wellness: true, fitdegree: true, arketa: true },
            { name: "Video On Demand", studio: true, mindbody: 'Add-on', wellness: true, fitdegree: false, arketa: true },
        ]
    },
    {
        category: "The 'All-In-One' Advantage",
        items: [
            { name: "Built-in Drag & Drop Website Builder", studio: true, mindbody: false, wellness: false, fitdegree: false, arketa: false, tooltip: "Instead of paying for Squarespace or Wix, build and host your entire website inside the platform." },
            { name: "Shared SMS/Texting Infrastructure", studio: true, mindbody: 'Add-on', wellness: 'Add-on', fitdegree: true, arketa: false, tooltip: "No need for a Twilio subscription or paid SMS add-ons. It's built into our ecosystem." },
            { name: "Built-in Email Marketing", studio: true, mindbody: 'Add-on', wellness: 'Add-on', fitdegree: false, arketa: true, tooltip: "Stop paying for Mailchimp. Send beautiful newsletters directly from the platform." },
            { name: "AI Content Generation (Emails, Blogs)", studio: true, mindbody: false, wellness: false, fitdegree: false, arketa: false, tooltip: "Our AI helps you write marketing emails and SEO-optimized blog posts instantly." },
            { name: "Automated SEO & Geography Tools", studio: true, mindbody: false, wellness: false, fitdegree: false, arketa: false, tooltip: "We automatically create local SEO landing pages linking to your studio." },
        ]
    }
];

export default function ComparisonPage() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-50 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30">
            <PublicNav />

            <main className="pt-20 pb-20">
                {/* Hero Section */}
                <section className="px-8 max-w-5xl mx-auto text-center mb-24">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6 animate-fade-in">
                        <Sparkles size={16} />
                        Stop Stitching Software Together
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-zinc-900 dark:text-zinc-100">
                        The Only <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">True All-In-One</span> Ecosystem
                    </h1>
                    <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed mb-8">
                        Other platforms claim to be "all-in-one," but still force you to pay for Squarespace, Mailchimp, Twilio, and SEO agencies. We built an ecosystem where everything is actually included.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link to="/sign-up" className="bg-blue-600 dark:bg-blue-500 text-white px-8 py-3 rounded-md font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25">
                            Start Free Trial
                        </Link>
                        <Link to="/pricing" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 px-8 py-3 rounded-md font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors hidden sm:block">
                            View Pricing
                        </Link>
                    </div>
                </section>

                {/* Feature Highlights section */}
                <section className="px-8 max-w-7xl mx-auto mb-32 grid md:grid-cols-3 gap-8">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-6">
                            <Globe size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 dark:text-zinc-100">Integrated Website Builder</h3>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Stop paying $30/mo for Wix or Squarespace. Build your entire studio website using our drag-and-drop editor directly within your dashboard.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-bl-full -z-10" />
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-6">
                            <Sparkles size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 dark:text-zinc-100">AI & Local SEO Engine</h3>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            We use AI to help you write marketing emails and automatically generate local SEO pages to ensure your studio ranks #1 in your neighborhood.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-xl flex items-center justify-center mb-6">
                            <Smartphone size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 dark:text-zinc-100">Shared Comm Infrastructure</h3>
                        <p className="text-zinc-600 dark:text-zinc-400">
                            Why pay for Twilio and Mailchimp? Because we operate as a unified platform, our tenants enjoy built-in SMS and email campaigns at no extra infrastructure cost.
                        </p>
                    </div>
                </section>

                {/* Comparison Table */}
                <section className="px-8 max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4 dark:text-zinc-100">How We Stack Up</h2>
                        <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                            A completely transparent look at how Studio Platform compares to legacy software and modern alternatives.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr>
                                    <th className="p-4 bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 font-medium text-zinc-500 w-1/3">Features</th>
                                    {COMPETITORS.map((comp) => (
                                        <th
                                            key={comp.id}
                                            className={`p-4 border-b border-zinc-200 dark:border-zinc-800 font-bold text-center ${comp.isUs
                                                ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 border-l border-r border-blue-200 dark:border-blue-800/50'
                                                : 'bg-zinc-50 dark:bg-zinc-950/50 dark:text-zinc-200'
                                                }`}
                                        >
                                            {comp.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {FEATURES.map((category, idx) => (
                                    <React.Fragment key={idx}>
                                        <tr>
                                            <td colSpan={6} className="bg-zinc-100/50 dark:bg-zinc-800/50 p-3 text-sm font-bold border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300">
                                                {category.category}
                                            </td>
                                        </tr>
                                        {category.items.map((item, iIdx) => (
                                            <tr key={iIdx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                                <td className="p-4 border-b border-zinc-100 dark:border-zinc-800/50 text-sm font-medium dark:text-zinc-300">
                                                    {item.name}
                                                    {item.tooltip && (
                                                        <span className="block text-xs font-normal text-zinc-500 mt-1 max-w-xs">{item.tooltip}</span>
                                                    )}
                                                </td>
                                                {COMPETITORS.map((comp) => (
                                                    <td
                                                        key={`${comp.id}-${iIdx}`}
                                                        className={`p-4 text-center border-b border-zinc-100 dark:border-zinc-800/50 ${comp.isUs ? 'bg-blue-50/30 dark:bg-blue-900/5 border-l border-r border-blue-200/50 dark:border-blue-800/30' : ''
                                                            }`}
                                                    >
                                                        {item[comp.id as keyof typeof item] === true ? (
                                                            <div className="flex justify-center"><Check className="text-green-500 dark:text-green-400" size={20} /></div>
                                                        ) : item[comp.id as keyof typeof item] === false ? (
                                                            <div className="flex justify-center"><X className="text-zinc-300 dark:text-zinc-600" size={20} /></div>
                                                        ) : (
                                                            <span className="text-xs font-semibold px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                                                {item[comp.id as keyof typeof item]}
                                                            </span>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="px-8 mt-32 max-w-4xl mx-auto text-center bg-blue-600 dark:bg-blue-600 rounded-3xl p-12 shadow-xl shadow-blue-500/20 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold mb-4">Ready to upgrade your studio?</h2>
                        <p className="text-blue-100 mb-8 max-w-xl mx-auto">
                            Join thousands of studios who have switched to the only platform that actually gives you everything you need in one place.
                        </p>
                        <Link to="/sign-up" className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-3 rounded-md font-semibold hover:bg-zinc-50 transition-colors shadow-lg active:scale-95">
                            Start Your Free Trial <ArrowRight size={18} />
                        </Link>
                    </div>
                </section>

            </main>
            <PublicFooter />
        </div>
    );
}
