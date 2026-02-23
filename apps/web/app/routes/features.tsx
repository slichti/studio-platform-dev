
import { useLoaderData, type MetaFunction, type LoaderFunction } from "react-router";

export const meta: MetaFunction = () => [
    { title: "Features – Studio Platform | Yoga Studio & Gym Management" },
    { name: "description", content: "Studio Platform features: class scheduling, memberships, POS, CRM, video library, website builder, and more. Yoga studio management and small gym management software." },
    { name: "keywords", content: "yoga studio management features, small gym management software, studio scheduling, membership billing, fitness studio CRM" },
];
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import {
    Calendar, Users, CreditCard, BarChart3, Mail, Globe, Video,
    User, Settings, Zap, ChevronDown, ChevronUp, Check, ArrowRight,
    Star, Shield, Smartphone, Clock, BookOpen, Heart
} from "lucide-react";

interface FAQ {
    id: string;
    category: string;
    question: string;
    answer: string;
}

const FEATURE_CATEGORIES = [
    {
        id: 'scheduling',
        title: 'Scheduling & Booking',
        description: 'Powerful class scheduling with 24/7 online booking',
        icon: Calendar,
        color: 'bg-blue-500',
        features: [
            'Interactive calendar with multiple views',
            '24/7 online booking for students',
            'Waitlist management with auto-enrollment',
            '1:1 private session booking',
            'Multi-location support',
            'Recurring class templates'
        ]
    },
    {
        id: 'memberships',
        title: 'Memberships & Packages',
        description: 'Flexible pricing options to fit every student',
        icon: CreditCard,
        color: 'bg-green-500',
        features: [
            'Recurring memberships with auto-billing',
            'Class packs with punch-card tracking',
            'Drop-in pricing options',
            'Subscription bundles',
            'Flexible payment plans',
            'Family accounts & group pricing'
        ]
    },
    {
        id: 'crm',
        title: 'Student Management',
        description: 'Complete CRM to know and grow your community',
        icon: Users,
        color: 'bg-purple-500',
        features: [
            'Detailed student profiles with history',
            'Attendance tracking & analytics',
            'Custom fields & tagging system',
            'Digital waivers with e-signature',
            'Communication tools (email/SMS)',
            'Notes & student journey tracking'
        ]
    },
    {
        id: 'payments',
        title: 'Payments & Commerce',
        description: 'Secure payment processing with Stripe',
        icon: CreditCard,
        color: 'bg-emerald-500',
        features: [
            'Stripe integration for secure payments',
            'Apple Pay & Google Pay support',
            'Automatic billing & invoicing',
            'Revenue reporting dashboards',
            'Refund & credit management',
            'Gift cards & promo codes'
        ]
    },
    {
        id: 'marketing',
        title: 'Marketing & Growth',
        description: 'Tools to attract and retain students',
        icon: Mail,
        color: 'bg-orange-500',
        features: [
            'Built-in email marketing',
            'Mailchimp & Flodesk integrations',
            'Lead capture forms',
            'Discount codes & promotions',
            'Referral program tools',
            'Automated reminders & follow-ups'
        ]
    },
    {
        id: 'branding',
        title: 'Website & Branding',
        description: 'Beautiful, branded online presence',
        icon: Globe,
        color: 'bg-pink-500',
        features: [
            'Custom domain support',
            'Drag-and-drop website builder',
            'Brand colors & logo customization',
            'Mobile-responsive design',
            'SEO optimization tools',
            'Embeddable booking widgets'
        ]
    },
    {
        id: 'video',
        title: 'On-Demand & Live Streaming',
        description: 'Extend your reach with virtual classes',
        icon: Video,
        color: 'bg-red-500',
        features: [
            'Video on demand library',
            'Zoom integration for live classes',
            'Secure video hosting',
            'Course creation tools',
            'Hybrid in-person/online classes',
            'Replay access for members'
        ]
    },
    {
        id: 'instructors',
        title: 'Instructor Tools',
        description: 'Empower your teaching team',
        icon: User,
        color: 'bg-indigo-500',
        features: [
            'Instructor scheduling & availability',
            'Payroll & payment tracking',
            'Public instructor profiles',
            'Sub request management',
            'Permission-based access',
            'Clock-in/clock-out tracking'
        ]
    },
    {
        id: 'analytics',
        title: 'Analytics & Reporting',
        description: 'Data-driven insights for growth',
        icon: BarChart3,
        color: 'bg-cyan-500',
        features: [
            'Revenue dashboards',
            'Attendance reports',
            'Student engagement metrics',
            'Custom report builder',
            'Export to CSV/PDF',
            'Trend analysis'
        ]
    },
    {
        id: 'integrations',
        title: 'Integrations',
        description: 'Connect with your favorite tools',
        icon: Zap,
        color: 'bg-yellow-500',
        features: [
            'Zoom for virtual classes',
            'Mailchimp & Flodesk',
            'Slack notifications',
            'Google Calendar sync',
            'Zapier automation',
            'API access for developers'
        ]
    }
];

export const loader: LoaderFunction = async (args: any) => {
    // Fetch public FAQs
    let faqs: FAQ[] = [];
    try {
        const res = await fetch(`${process.env.API_URL || 'https://studio-platform-api.slichti.workers.dev'}/faqs?category=features`);
        const data = await res.json() as { faqs?: FAQ[] };
        faqs = data.faqs || [];
    } catch (e) {
        console.error("Failed to load FAQs", e);
    }

    return { faqs };
};

export default function FeaturesPage() {
    const { faqs } = useLoaderData<{ faqs: FAQ[] }>();
    const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
            {/* Hero Section */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 opacity-10" />
                <div className="max-w-6xl mx-auto px-4 py-20 md:py-32 relative">
                    <div className="text-center max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                            <Star size={16} className="fill-current" />
                            All-in-One Studio Management
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold text-zinc-900 mb-6 leading-tight">
                            Everything You Need to{' '}
                            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                Run Your Studio
                            </span>
                        </h1>
                        <p className="text-xl text-zinc-600 mb-8 leading-relaxed">
                            From class scheduling and online booking to memberships, payments, and marketing —
                            we've built the complete toolkit for yoga studios, fitness centers, and wellness businesses.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href="/signup"
                                className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white px-8 py-4 rounded-xl font-semibold hover:bg-zinc-800 transition shadow-lg shadow-zinc-900/20"
                            >
                                Start Free Trial
                                <ArrowRight size={20} />
                            </a>
                            <a
                                href="/contact"
                                className="inline-flex items-center justify-center gap-2 bg-white text-zinc-900 px-8 py-4 rounded-xl font-semibold border-2 border-zinc-200 hover:border-zinc-300 transition"
                            >
                                Schedule Demo
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Badges */}
            <section className="border-y border-zinc-200 bg-white py-8">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 text-zinc-500 text-sm">
                        <div className="flex items-center gap-2">
                            <Shield size={20} className="text-green-500" />
                            <span>Secure Payments</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Smartphone size={20} className="text-blue-500" />
                            <span>Mobile Friendly</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock size={20} className="text-purple-500" />
                            <span>24/7 Booking</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Heart size={20} className="text-pink-500" />
                            <span>Loved by Studios</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="max-w-6xl mx-auto px-4 py-20">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">
                        Powerful Features, Simple to Use
                    </h2>
                    <p className="text-lg text-zinc-600 max-w-2xl mx-auto">
                        Everything you need to manage classes, grow your community, and run a successful studio.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {FEATURE_CATEGORIES.map((category) => {
                        const Icon = category.icon;
                        const isActive = activeCategory === category.id;

                        return (
                            <div
                                key={category.id}
                                onClick={() => setActiveCategory(isActive ? null : category.id)}
                                className={`bg-white border rounded-2xl p-6 cursor-pointer transition-all duration-300 ${isActive
                                    ? 'border-zinc-900 shadow-xl ring-2 ring-zinc-900/10'
                                    : 'border-zinc-200 hover:border-zinc-300 hover:shadow-lg'
                                    }`}
                            >
                                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${category.color} text-white mb-4`}>
                                    <Icon size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-zinc-900 mb-2">{category.title}</h3>
                                <p className="text-zinc-600 text-sm mb-4">{category.description}</p>

                                {isActive && (
                                    <ul className="space-y-2 pt-4 border-t border-zinc-100">
                                        {category.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                                                <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <button className="mt-4 text-sm font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition">
                                    {isActive ? 'Show less' : 'View features'}
                                    {isActive ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* FAQ Section */}
            {faqs.length > 0 && (
                <section className="bg-zinc-50 py-20">
                    <div className="max-w-3xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">
                                Frequently Asked Questions
                            </h2>
                            <p className="text-lg text-zinc-600">
                                Have questions? We've got answers.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {faqs.map((faq) => (
                                <div
                                    key={faq.id}
                                    className="bg-white border border-zinc-200 rounded-xl overflow-hidden"
                                >
                                    <button
                                        onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                                        className="w-full flex items-center justify-between p-6 text-left hover:bg-zinc-50 transition"
                                    >
                                        <span className="font-semibold text-zinc-900 pr-4">{faq.question}</span>
                                        {expandedFaq === faq.id ? (
                                            <ChevronUp className="text-zinc-400 flex-shrink-0" size={20} />
                                        ) : (
                                            <ChevronDown className="text-zinc-400 flex-shrink-0" size={20} />
                                        )}
                                    </button>
                                    {expandedFaq === faq.id && (
                                        <div className="px-6 pb-6">
                                            <p className="text-zinc-600 leading-relaxed whitespace-pre-wrap">
                                                {faq.answer}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* CTA Section */}
            <section className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 py-20">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Ready to Transform Your Studio?
                    </h2>
                    <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
                        Join hundreds of studios using our platform to grow their business and delight their students.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href="/signup"
                            className="inline-flex items-center justify-center gap-2 bg-white text-zinc-900 px-8 py-4 rounded-xl font-semibold hover:bg-zinc-100 transition shadow-lg"
                        >
                            Start Your Free Trial
                            <ArrowRight size={20} />
                        </a>
                        <a
                            href="/contact"
                            className="inline-flex items-center justify-center gap-2 bg-zinc-800 text-white px-8 py-4 rounded-xl font-semibold border border-zinc-700 hover:bg-zinc-700 transition"
                        >
                            Talk to Sales
                        </a>
                    </div>
                    <p className="text-zinc-500 text-sm mt-6">
                        No credit card required • Free 14-day trial • Cancel anytime
                    </p>
                </div>
            </section>
        </div>
    );
}
