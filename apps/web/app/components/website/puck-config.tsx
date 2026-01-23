// Puck Component Library for Studio Websites
// These components are used in the drag-and-drop website builder

import type { Config } from "@measured/puck";
import { DropZone } from "@measured/puck";

// --- Component Definitions ---

// Hero Section
const Hero = ({ title, subtitle, ctaText, ctaLink, backgroundImage, alignment, overlayOpacity }: any) => (
    <section
        className={`relative py-24 px-8 ${alignment === 'left' ? 'text-left' : 'text-center'} bg-zinc-900 text-white overflow-hidden`}
    >
        {backgroundImage && (
            <div
                className="absolute inset-0 z-0 transition-transform duration-1000 hover:scale-105"
                style={{
                    backgroundImage: `url(${backgroundImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: overlayOpacity ?? 0.5
                }}
            />
        )}
        <div className="relative z-10 max-w-5xl mx-auto">
            <h1 className="text-4xl md:text-7xl font-extrabold mb-6 tracking-tight leading-tight">{title || "Welcome to Our Studio"}</h1>
            <p className="text-xl md:text-2xl opacity-90 mb-10 max-w-2xl mx-auto font-medium">{subtitle || "Your journey starts here"}</p>
            {ctaText && (
                <a href={ctaLink || "#"} className="inline-block bg-blue-600 text-white px-10 py-4 rounded-full font-bold hover:bg-blue-700 transition-all shadow-xl hover:shadow-blue-500/20 active:scale-95">
                    {ctaText}
                </a>
            )}
        </div>
    </section>
);

// Columns Component
const Columns = ({ distribution }: any) => {
    const cols = distribution === '1-1' ? 'md:grid-cols-2' : distribution === '1-1-1' ? 'md:grid-cols-3' : 'md:grid-cols-4';
    return (
        <section className="py-16 px-8 max-w-7xl mx-auto">
            <div className={`grid grid-cols-1 ${cols} gap-12`}>
                <div className="flex flex-col gap-6">
                    <DropZone zone="left" />
                </div>
                <div className="flex flex-col gap-6">
                    <DropZone zone="center" />
                </div>
                {(distribution === '1-1-1' || distribution === '1-1-1-1') && (
                    <div className="flex flex-col gap-6">
                        <DropZone zone="right" />
                    </div>
                )}
                {distribution === '1-1-1-1' && (
                    <div className="flex flex-col gap-6">
                        <DropZone zone="far-right" />
                    </div>
                )}
            </div>
        </section>
    );
};

import DOMPurify from 'isomorphic-dompurify';

// Text Block
const TextBlock = ({ content, alignment }: any) => (
    <section className="py-12 px-8">
        <div className={`max-w-3xl mx-auto prose prose-lg ${alignment === 'center' ? 'text-center' : ''}`}>
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content || "<p>Add your content here...</p>") }} />
        </div>
    </section>
);

// Feature Grid
const FeatureGrid = ({ features }: any) => (
    <section className="py-16 px-8 bg-zinc-50">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
            {(features || [{ icon: "⭐", title: "Feature 1", description: "Description here" }]).map((f: any, i: number) => (
                <div key={i} className="bg-white p-6 rounded-xl shadow-sm text-center">
                    <div className="text-4xl mb-4">{f.icon}</div>
                    <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                    <p className="text-zinc-600">{f.description}</p>
                </div>
            ))}
        </div>
    </section>
);

// Class Schedule Preview
const ClassSchedule = ({ title, showDays, tenantSlug }: any) => (
    <section className="py-16 px-8">
        <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">{title || "Our Schedule"}</h2>
            <div className="bg-zinc-100 rounded-xl p-8 text-center">
                <p className="text-zinc-600">Schedule will be dynamically loaded from your studio data.</p>
                <p className="text-sm text-zinc-400 mt-2">Showing next {showDays || 7} days</p>
            </div>
        </div>
    </section>
);

// Instructor Grid
const InstructorGrid = ({ title }: any) => (
    <section className="py-16 px-8 bg-zinc-50">
        <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">{title || "Meet Our Instructors"}</h2>
            <div className="grid md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
                        <div className="aspect-square bg-zinc-200" />
                        <div className="p-4 text-center">
                            <h4 className="font-semibold">Instructor Name</h4>
                            <p className="text-sm text-zinc-600">Specialty</p>
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-center text-sm text-zinc-400 mt-4">Instructor data loaded from your studio.</p>
        </div>
    </section>
);

// Testimonials
const Testimonials = ({ testimonials }: any) => (
    <section className="py-16 px-8">
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">What Our Students Say</h2>
            <div className="space-y-8">
                {(testimonials || [{ quote: "Amazing experience!", author: "Happy Student" }]).map((t: any, i: number) => (
                    <blockquote key={i} className="bg-zinc-50 p-8 rounded-xl">
                        <p className="text-xl italic text-zinc-700 mb-4">"{t.quote}"</p>
                        <footer className="text-zinc-600 font-medium">— {t.author}</footer>
                    </blockquote>
                ))}
            </div>
        </div>
    </section>
);

// Contact Form
const ContactForm = ({ title, email }: any) => (
    <section className="py-16 px-8 bg-zinc-900 text-white">
        <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">{title || "Get in Touch"}</h2>
            <p className="text-zinc-400 mb-8">We'd love to hear from you!</p>
            <form className="space-y-4">
                <input
                    type="text"
                    placeholder="Your Name"
                    className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                />
                <input
                    type="email"
                    placeholder="Your Email"
                    className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                />
                <textarea
                    placeholder="Your Message"
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                />
                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                    Send Message
                </button>
            </form>
        </div>
    </section>
);

// Map/Location
const MapSection = ({ title, address }: any) => {
    const encodedAddress = encodeURIComponent(address || "New York, NY");
    return (
        <section className="py-16 px-8">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-8">{title || "Find Us"}</h2>
                <div className="aspect-video bg-zinc-200 rounded-xl overflow-hidden shadow-sm border border-zinc-200">
                    <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        marginHeight={0}
                        marginWidth={0}
                        src={`https://maps.google.com/maps?q=${encodedAddress}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                        title="Location Map"
                        className="w-full h-full"
                    ></iframe>
                </div>
                {address && <p className="text-center mt-4 text-zinc-600">{address}</p>}
            </div>
        </section>
    );
};

// Pricing Table
const PricingTable = ({ title, plans }: any) => (
    <section className="py-20 px-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-extrabold text-center mb-16 tracking-tight">{title || "Membership Plans"}</h2>
            <div className="grid md:grid-cols-3 gap-8">
                {(plans || [{ name: "Standard", price: "49", benefits: ["2 Classes / Week", "Access to Community"] }]).map((p: any, i: number) => (
                    <div key={i} className={`bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl transition-transform hover:scale-[1.02] border ${p.isPopular ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-zinc-100 dark:border-zinc-800'}`}>
                        {p.isPopular && <div className="bg-blue-600 text-white text-[10px] uppercase font-black px-3 py-1.5 rounded-full mb-6 inline-block tracking-widest">Best Value</div>}
                        <h3 className="text-2xl font-bold mb-3">{p.name || "Membership"}</h3>
                        <div className="flex items-baseline gap-1 mb-8">
                            <span className="text-5xl font-black tracking-tight">${p.price || "0"}</span>
                            <span className="text-zinc-500 font-medium text-lg">/mo</span>
                        </div>
                        <ul className="space-y-4 mb-10">
                            {(p.benefits || []).map((b: string, j: number) => (
                                <li key={j} className="text-zinc-600 dark:text-zinc-400 font-medium flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" /> {b}
                                </li>
                            ))}
                        </ul>
                        <button className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 ${p.isPopular ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>
                            {p.ctaText || "Get Started"}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </section>
);

// Membership Preview (Fetch from Studio)
const MembershipPreview = ({ title, limit }: any) => (
    <section className="py-16 px-8 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">{title || "Our Memberships"}</h2>
        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-12 text-center border border-dashed border-zinc-300 dark:border-zinc-700">
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Your membership plans from the studio will automatically appear here.</p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 opacity-30 grayscale pointer-events-none">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white dark:bg-zinc-800 h-40 rounded-xl" />
                ))}
            </div>
        </div>
    </section>
);

// --- Puck Config Export ---

export const puckConfig: Config = {
    root: {
        fields: {
            title: { type: "text", label: "Page Title" }, // Useful to edit title inline too
            chatEnabled: {
                type: "radio",
                label: "Chat Widget",
                options: [
                    { label: "Enabled", value: true },
                    { label: "Disabled", value: false },
                ],
            },
        },
        defaultProps: {
            title: "New Page",
            chatEnabled: true,
        },
    },
    components: {
        Hero: {
            label: "Hero Section",
            fields: {
                title: { type: "text" },
                subtitle: { type: "text" },
                ctaText: { type: "text", label: "Button Text" },
                ctaLink: { type: "text", label: "Button Link" },
                backgroundImage: { type: "text", label: "Background Image URL" },
                alignment: { type: "select", options: [{ label: "Center", value: "center" }, { label: "Left", value: "left" }] },
                overlayOpacity: { type: "number", label: "Overlay Opacity (0-1)" },
            },
            defaultProps: {
                title: "Welcome to Our Studio",
                subtitle: "Your wellness journey starts here",
                ctaText: "Book a Class",
                ctaLink: "/schedule",
                alignment: "center",
                overlayOpacity: 0.5
            },
            render: Hero,
        },
        Columns: {
            label: "Layout: Columns",
            fields: {
                distribution: {
                    type: "select",
                    options: [
                        { label: "2 Columns (1:1)", value: "1-1" },
                        { label: "3 Columns (1:1:1)", value: "1-1-1" },
                        { label: "4 Columns (1:1:1:1)", value: "1-1-1-1" }
                    ]
                },
            },
            defaultProps: {
                distribution: "1-1",
            },
            render: Columns,
        },
        TextBlock: {
            label: "Text Block",
            fields: {
                content: { type: "textarea" },
                alignment: { type: "select", options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }] },
            },
            defaultProps: {
                content: "<p>Add your content here...</p>",
                alignment: "left",
            },
            render: TextBlock,
        },
        FeatureGrid: {
            label: "Feature Grid",
            fields: {
                features: {
                    type: "array",
                    arrayFields: {
                        icon: { type: "text" },
                        title: { type: "text" },
                        description: { type: "textarea" },
                    }
                },
            },
            defaultProps: {
                features: [
                    { icon: "🧘", title: "Expert Instructors", description: "Learn from certified professionals" },
                    { icon: "📅", title: "Flexible Schedule", description: "Classes available 7 days a week" },
                    { icon: "🏆", title: "Results Driven", description: "Achieve your wellness goals" },
                ],
            },
            render: FeatureGrid,
        },
        ClassSchedule: {
            label: "Class Schedule",
            fields: {
                title: { type: "text" },
                showDays: { type: "number", label: "Days to Show" },
            },
            defaultProps: {
                title: "Upcoming Classes",
                showDays: 7,
            },
            render: ClassSchedule,
        },
        InstructorGrid: {
            label: "Instructor Grid",
            fields: {
                title: { type: "text" },
            },
            defaultProps: {
                title: "Meet Our Team",
            },
            render: InstructorGrid,
        },
        Testimonials: {
            label: "Testimonials",
            fields: {
                testimonials: {
                    type: "array",
                    arrayFields: {
                        quote: { type: "textarea" },
                        author: { type: "text" },
                    }
                },
            },
            defaultProps: {
                testimonials: [
                    { quote: "This studio changed my life!", author: "Happy Student" },
                ],
            },
            render: Testimonials,
        },
        ContactForm: {
            label: "Contact Form",
            fields: {
                title: { type: "text" },
                email: { type: "text", label: "Recipient Email" },
            },
            defaultProps: {
                title: "Get in Touch",
            },
            render: ContactForm,
        },
        MapSection: {
            label: "Map/Location",
            fields: {
                title: { type: "text" },
                address: { type: "text" },
            },
            defaultProps: {
                title: "Visit Us",
                address: "123 Studio Street, City, State",
            },
            render: MapSection,
        },
        MembershipPreview: {
            label: "Memberships (Dynamic)",
            fields: {
                title: { type: "text" },
                limit: { type: "number", label: "Max items to show" },
            },
            defaultProps: {
                title: "Choose Your Plan",
                limit: 3
            },
            render: MembershipPreview
        },
        PricingTable: {
            label: "Pricing Table",
            fields: {
                title: { type: "text" },
                plans: {
                    type: "array",
                    arrayFields: {
                        name: { type: "text" },
                        price: { type: "text" },
                        isPopular: { type: "radio", options: [{ label: "Yes", value: true }, { label: "No", value: false }] },
                        benefits: { type: "array", arrayFields: { benefit: { type: "text" } } },
                        ctaText: { type: "text" },
                    },
                    getItemSummary: (item: any) => item.name || "Plan"
                }
            },
            defaultProps: {
                title: "Membership Plans",
                plans: [
                    { name: "Starter", price: "29", isPopular: false, benefits: ["1 Class / Week"], ctaText: "Join Now" },
                    { name: "Unlimited", price: "99", isPopular: true, benefits: ["All Classes", "Free Guest Pass"], ctaText: "Go Pro" }
                ]
            },
            render: PricingTable
        },
    },
};

export default puckConfig;
