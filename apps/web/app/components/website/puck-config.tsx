// Puck Component Library for Studio Websites
// These components are used in the drag-and-drop website builder

import { Config, DropZone } from "@puckeditor/core";
import DOMPurify from 'isomorphic-dompurify';

// --- Component Definitions ---

// Hero Section
const Hero = ({ title, subtitle, ctaText, ctaLink, backgroundImage, alignment, overlayOpacity, backgroundColor, textColor }: any) => (
    <section
        className={`relative py - 32 px - 8 ${alignment === 'left' ? 'text-left' : 'text-center'} overflow - hidden transition - colors`}
        style={{
            backgroundColor: backgroundColor || '#18181b', // Default zinc-900
            color: textColor || '#ffffff'
        }}
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
            <h1 className="text-5xl md:text-8xl font-black mb-8 tracking-tighter leading-none">{title || "Welcome to Our Studio"}</h1>
            <p className="text-xl md:text-3xl opacity-90 mb-12 max-w-3xl mx-auto font-medium leading-relaxed">{subtitle || "Your journey starts here"}</p>
            {ctaText && (
                <a href={ctaLink || "#"} className="inline-block bg-blue-600 text-white px-12 py-5 rounded-full font-black text-lg hover:bg-blue-700 transition-all shadow-2xl hover:shadow-blue-500/40 active:scale-95">
                    {ctaText}
                </a>
            )}
        </div>
    </section>
);

// Columns Component
const Columns = ({ distribution, backgroundColor, textColor, padding }: any) => {
    const cols = distribution === '1-1' ? 'md:grid-cols-2' : distribution === '1-1-1' ? 'md:grid-cols-3' : 'md:grid-cols-4';
    return (
        <section
            className={`${padding === 'large' ? 'py-32' : padding === 'small' ? 'py-8' : 'py-16'} px - 8 transition - colors`}
            style={{ backgroundColor: backgroundColor || 'transparent', color: textColor || 'inherit' }}
        >
            <div className={`grid grid - cols - 1 ${cols} gap - 12 max - w - 7xl mx - auto`}>
                <div className="flex flex-col gap-8">
                    <DropZone zone="left" />
                </div>
                <div className="flex flex-col gap-8">
                    <DropZone zone="center" />
                </div>
                {(distribution === '1-1-1' || distribution === '1-1-1-1') && (
                    <div className="flex flex-col gap-8">
                        <DropZone zone="right" />
                    </div>
                )}
                {distribution === '1-1-1-1' && (
                    <div className="flex flex-col gap-8">
                        <DropZone zone="far-right" />
                    </div>
                )}
            </div>
        </section>
    );
};

// Text Block
const TextBlock = ({ content, alignment, backgroundColor, textColor }: any) => (
    <section
        className="py-16 px-8 transition-colors"
        style={{ backgroundColor: backgroundColor || 'transparent', color: textColor || 'inherit' }}
    >
        <div className={`max - w - 4xl mx - auto prose prose - 2xl dark: prose - invert ${alignment === 'center' ? 'text-center' : ''} `}>
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content || "<p>Add your content here...</p>") }} />
        </div>
    </section>
);

// New Image Component
const ImageComponent = ({ src, alt, caption, borderRadius, aspectRatio, maxWidth }: any) => (
    <div className="py-8 px-4 flex flex-col items-center">
        <div
            className="overflow-hidden w-full transition-shadow hover:shadow-2xl"
            style={{
                maxWidth: maxWidth || '100%',
                borderRadius: borderRadius || '0px',
                aspectRatio: aspectRatio || 'auto'
            }}
        >
            {src ? (
                <img src={src} alt={alt || ""} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-64 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold uppercase tracking-widest text-sm">
                    Image Placeholder
                </div>
            )}
        </div>
        {caption && <p className="mt-4 text-sm text-zinc-500 italic font-medium">{caption}</p>}
    </div>
);

// Feature Grid
const FeatureGrid = ({ features, backgroundColor, cardColor, textColor }: any) => (
    <section
        className="py-24 px-8 transition-colors"
        style={{ backgroundColor: backgroundColor || '#f4f4f5', color: textColor || 'inherit' }} // Default zinc-100
    >
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10">
            {(features || [{ icon: "⭐", title: "Feature 1", description: "Description here" }]).map((f: any, i: number) => (
                <div
                    key={i}
                    className="p-10 rounded-3xl shadow-xl text-center transition-transform hover:scale-[1.03]"
                    style={{ backgroundColor: cardColor || '#ffffff', color: textColor || 'inherit' }}
                >
                    <div className="text-6xl mb-6">{f.icon}</div>
                    <h3 className="text-2xl font-black mb-4 tracking-tight">{f.title}</h3>
                    <p className="opacity-80 leading-relaxed font-medium">{f.description}</p>
                </div>
            ))}
        </div>
    </section>
);

// Class Schedule Preview
const ClassSchedule = ({ title, showDays }: any) => (
    <section className="py-20 px-8">
        <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-black text-center mb-12 tracking-tight">{title || "Our Schedule"}</h2>
            <div className="bg-zinc-100 dark:bg-zinc-900 rounded-3xl p-16 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                <p className="text-zinc-500 dark:text-zinc-400 text-xl font-bold">Schedule will be dynamically loaded from your studio data.</p>
                <p className="text-sm text-zinc-400 mt-4 uppercase tracking-widest font-black">Showing next {showDays || 7} days</p>
            </div>
        </div>
    </section>
);

// Instructor Grid
const InstructorGrid = ({ title }: any) => (
    <section className="py-24 px-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto">
            <h2 className="text-5xl font-black text-center mb-16 tracking-tight">{title || "Meet Our Instructors"}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="group cursor-pointer">
                        <div className="aspect-[3/4] bg-zinc-200 dark:bg-zinc-800 rounded-3xl overflow-hidden mb-6 transition-box-shadow group-hover:shadow-2xl grayscale group-hover:grayscale-0 transition-all duration-500">
                            <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                            </div>
                        </div>
                        <div className="text-center">
                            <h4 className="text-xl font-black tracking-tight group-hover:text-blue-600 transition-colors">Instructor Name</h4>
                            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mt-1">Specialty</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </section>
);

// Testimonials
const Testimonials = ({ testimonials, backgroundColor, textColor }: any) => (
    <section
        className="py-24 px-8 transition-colors"
        style={{ backgroundColor: backgroundColor || 'transparent', color: textColor || 'inherit' }}
    >
        <div className="max-w-5xl mx-auto">
            <h2 className="text-5xl font-black text-center mb-16 tracking-tight italic">"What Our Students Say"</h2>
            <div className="grid md:grid-cols-2 gap-12">
                {(testimonials || [{ quote: "Amazing experience!", author: "Happy Student" }]).map((t: any, i: number) => (
                    <blockquote key={i} className="bg-zinc-50 dark:bg-zinc-900 p-12 rounded-[2rem] relative overflow-hidden group">
                        <div className="text-9xl absolute -top-10 -left-6 opacity-[0.03] select-none font-serif text-blue-600">“</div>
                        <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-8 relative z-10 leading-relaxed italic group-hover:text-blue-600 transition-colors">"{t.quote}"</p>
                        <footer className="text-blue-600 font-black uppercase tracking-[0.2em] text-sm flex items-center gap-4">
                            <div className="h-0.5 w-8 bg-blue-600" /> {t.author}
                        </footer>
                    </blockquote>
                ))}
            </div>
        </div>
    </section>
);

// Testimonial Carousel
// Uses CSS scroll snap for simplicity and performance
const TestimonialCarousel = ({ testimonials, backgroundColor, textColor }: any) => (
    <section
        className="py-24 px-8 transition-colors overflow-hidden"
        style={{ backgroundColor: backgroundColor || 'transparent', color: textColor || 'inherit' }}
    >
        <div className="max-w-7xl mx-auto">
            <h2 className="text-5xl font-black text-center mb-16 tracking-tight italic">"Student Stories"</h2>

            <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-12 -mx-8 px-8 scrollbar-hide">
                {(testimonials || [{ quote: "Incredible atmosphere!", author: "Member since 2024" }, { quote: "Best instructors in town.", author: "Jane D." }, { quote: "I love the community here.", author: "Mike T." }]).map((t: any, i: number) => (
                    <div
                        key={i}
                        className="snap-center shrink-0 w-[85vw] md:w-[400px] bg-zinc-50 dark:bg-zinc-900 p-10 rounded-[2.5rem] relative flex flex-col justify-between border border-zinc-100 dark:border-zinc-800"
                    >
                        <div className="text-6xl text-blue-600 opacity-20 font-serif mb-4">“</div>
                        <p className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-8 italic leading-relaxed">
                            {t.quote}
                        </p>
                        <div className="flex items-center gap-3 mt-auto">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-sm">
                                {t.author?.[0] || "?"}
                            </div>
                            <span className="font-bold text-sm uppercase tracking-wider text-zinc-500">{t.author}</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-center gap-2 mt-4 opacity-30">
                <div className="h-1 w-12 bg-current rounded-full" />
                <div className="h-1 w-2 bg-current rounded-full" />
                <div className="h-1 w-2 bg-current rounded-full" />
            </div>
        </div>
    </section>
);

// Contact Form
const ContactForm = ({ title, email, backgroundColor }: any) => (
    <section
        className="py-24 px-8 transition-colors"
        style={{ backgroundColor: backgroundColor || '#18181b' }} // Default zinc-900
    >
        <div className="max-w-3xl mx-auto text-center bg-white dark:bg-zinc-900 p-16 rounded-[3rem] shadow-2xl border border-zinc-100 dark:border-zinc-800">
            <h2 className="text-4xl font-black mb-4 tracking-tight">{title || "Get in Touch"}</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-12 font-medium text-lg italic">We'd love to hear from you!</p>
            <form className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <input
                        type="text"
                        placeholder="Your Name"
                        className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-zinc-900 dark:text-white focus:ring-4 ring-blue-500/10 transition-all font-medium"
                    />
                    <input
                        type="email"
                        placeholder="Your Email"
                        className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-zinc-900 dark:text-white focus:ring-4 ring-blue-500/10 transition-all font-medium"
                    />
                </div>
                <textarea
                    placeholder="Your Message"
                    rows={5}
                    className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-zinc-900 dark:text-white focus:ring-4 ring-blue-500/10 transition-all font-medium"
                />
                <button
                    type="submit"
                    className="w-full bg-zinc-900 dark:bg-blue-600 text-white py-5 rounded-2xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                >
                    Send Message
                </button>
            </form>
        </div>
    </section>
);

// Map/Location
const MapSection = ({ title, address, height }: any) => {
    const encodedAddress = encodeURIComponent(address || "New York, NY");
    return (
        <section className="py-24 px-8">
            <div className="max-w-7xl mx-auto">
                <h2 className="text-4xl font-black text-center mb-12 tracking-tight italic uppercase">{title || "Find Us"}</h2>
                <div
                    className="bg-zinc-200 dark:bg-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white dark:border-zinc-900"
                    style={{ height: height || '500px' }}
                >
                    <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        marginHeight={0}
                        marginWidth={0}
                        src={`https://maps.google.com/maps?q=${encodedAddress}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                        title="Location Map"
                        className="w-full h-full grayscale active:grayscale-0 transition-all duration-700"
                    ></iframe >
                </div >
                {address && <div className="mt-8 text-center"><span className="bg-zinc-900 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm">{address}</span></div>}
            </div >
        </section >
    );
};

// Pricing Table
const PricingTable = ({ title, plans, backgroundColor }: any) => (
    <section
        className="py-32 px-8 transition-colors"
        style={{ backgroundColor: backgroundColor || '#fafafa' }}
    >
        <div className="max-w-7xl mx-auto">
            <h2 className="text-6xl font-black text-center mb-24 tracking-tighter italic italic">{title || "Membership Plans"}</h2>
            <div className="grid md:grid-cols-3 gap-10">
                {(plans || [{ name: "Standard", price: "49", benefits: ["2 Classes / Week", "Access to Community"] }]).map((p: any, i: number) => (
                    <div key={i} className={`bg-white dark:bg-zinc-900 p-12 rounded-[3.5rem] shadow-2xl transition-all hover:scale-[1.05] border-2 group ${p.isPopular ? 'border-blue-600 ring-8 ring-blue-600/5' : 'border-zinc-100 dark:border-zinc-800'}`}>
                        {p.isPopular && <div className="bg-blue-600 text-white text-[10px] uppercase font-black px-4 py-2 rounded-full mb-10 inline-block tracking-[0.3em]">Best Value</div>}
                        <h3 className="text-3xl font-black mb-4 tracking-tight group-hover:text-blue-600 transition-colors italic">{p.name || "Membership"}</h3>
                        <div className="flex items-baseline gap-2 mb-12">
                            <span className="text-7xl font-serif text-zinc-900 dark:text-white">$</span>
                            <span className="text-8xl font-black tracking-tighter">{p.price || "0"}</span>
                            <span className="text-zinc-400 font-black uppercase tracking-widest text-xs">/mo</span>
                        </div>
                        <ul className="space-y-6 mb-16">
                            {(p.benefits || []).map((b: any, j: number) => (
                                <li key={j} className="text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-4 text-lg">
                                    <div className="h-3 w-3 rounded-full bg-blue-600 shadow-lg shadow-blue-500/50" /> {b.benefit || b}
                                </li>
                            ))}
                        </ul>
                        <button className={`w-full py-6 rounded-[2rem] font-black text-xl transition-all shadow-2xl active:scale-95 ${p.isPopular ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/40' : 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-500/20'}`}>
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
    <section className="py-24 px-8 max-w-7xl mx-auto">
        <h2 className="text-4xl font-black text-center mb-12 tracking-tight italic uppercase">{title || "Our Memberships"}</h2>
        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-[3rem] p-24 text-center border-4 border-dashed border-zinc-200 dark:border-zinc-800">
            <p className="text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-[0.4em] text-sm">Automated Live Feed</p>
            <p className="text-zinc-500 dark:text-zinc-400 font-bold text-2xl mt-4 italic">Your current studio memberships will sync and appear here automatically.</p>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 opacity-20 grayscale filter blur-[2px] pointer-events-none">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white dark:bg-zinc-800 h-64 rounded-[2.5rem]" />
                ))}
            </div>
        </div>
    </section>
);

// FAQ Block - Fetches FAQs from API and renders as accordion
// Note: In Puck editor, shows static preview. On live site, fetches dynamically.
const FAQBlock = ({ title, category, maxItems, backgroundColor, textColor }: any) => {
    // Static preview for Puck editor
    const previewFaqs = [
        { id: '1', question: 'How do I get started?', answer: 'Sign up for a free trial and follow our setup wizard to configure your studio.' },
        { id: '2', question: 'Can students book classes online?', answer: 'Yes! Students can book classes 24/7 from your website or mobile app.' },
        { id: '3', question: 'What payment methods are supported?', answer: 'We support all major credit cards, Apple Pay, Google Pay, and ACH transfers via Stripe.' }
    ];

    const displayFaqs = previewFaqs.slice(0, maxItems || 10);

    return (
        <section
            className="py-24 px-8 transition-colors"
            style={{ backgroundColor: backgroundColor || '#fafafa', color: textColor || 'inherit' }}
        >
            <div className="max-w-3xl mx-auto">
                <h2 className="text-4xl font-black text-center mb-12 tracking-tight">
                    {title || "Frequently Asked Questions"}
                </h2>
                <div className="space-y-4">
                    {displayFaqs.map((faq: any, i: number) => (
                        <details
                            key={faq.id || i}
                            className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden"
                        >
                            <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition list-none font-semibold text-lg">
                                {faq.question}
                                <svg
                                    className="w-5 h-5 text-zinc-400 transition-transform group-open:rotate-180"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <div className="px-6 pb-6 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                {faq.answer}
                            </div>
                        </details>
                    ))}
                </div>
                <p className="text-center text-zinc-400 text-sm mt-8 italic">
                    {category ? `Showing FAQs from: ${category}` : 'Showing all FAQs'} • Managed in Admin
                </p>
            </div>
        </section>
    );
};

// --- Puck Config Export ---

export const puckConfig: Config = {
    root: {
        fields: {
            title: { type: "text", label: "Page Title" },
            primaryColor: { type: "text", label: "Primary Color (Hex)" },
            secondaryColor: { type: "text", label: "Secondary Color (Hex)" },
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
            primaryColor: "#2563eb",
            secondaryColor: "#18181b",
            chatEnabled: true,
        },
    },
    components: {
        Hero: {
            label: "Hero Section",
            fields: {
                title: { type: "text" },
                subtitle: { type: "textarea" },
                ctaText: { type: "text", label: "Button Text" },
                ctaLink: { type: "text", label: "Button Link" },
                backgroundImage: { type: "text", label: "Background Image URL" },
                alignment: { type: "select", options: [{ label: "Center", value: "center" }, { label: "Left", value: "left" }] },
                overlayOpacity: { type: "number", label: "Overlay Opacity (0-1)" },
                backgroundColor: { type: "text", label: "Background Color (Hex)" },
                textColor: { type: "text", label: "Text Color (Hex)" },
            },
            defaultProps: {
                title: "Welcome to Our Studio",
                subtitle: "Your wellness journey starts here",
                ctaText: "Book a Class",
                ctaLink: "/schedule",
                alignment: "center",
                overlayOpacity: 0.5,
                backgroundColor: "#18181b",
                textColor: "#ffffff"
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
                backgroundColor: { type: "text", label: "Background Color" },
                textColor: { type: "text", label: "Text Color" },
                padding: { type: "select", options: [{ label: "Small", value: "small" }, { label: "Medium", value: "medium" }, { label: "Large", value: "large" }] }
            },
            defaultProps: {
                distribution: "1-1",
                padding: "medium"
            },
            render: Columns,
        },
        TextBlock: {
            label: "Text Block",
            fields: {
                content: { type: "textarea" },
                alignment: { type: "select", options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }] },
                backgroundColor: { type: "text", label: "Background Color" },
                textColor: { type: "text", label: "Text Color" },
            },
            defaultProps: {
                content: "<p>Add your content here...</p>",
                alignment: "left",
            },
            render: TextBlock,
        },
        Image: {
            label: "Photo / Image",
            fields: {
                src: { type: "text", label: "Image URL" },
                alt: { type: "text" },
                caption: { type: "text" },
                maxWidth: { type: "text", label: "Max Width (e.g. 500px, 100%)" },
                borderRadius: { type: "text", label: "Border Radius (e.g. 20px, 100%)" },
                aspectRatio: { type: "text", label: "Aspect Ratio (e.g. 1/1, 16/9)" }
            },
            defaultProps: {
                maxWidth: "100%",
                borderRadius: "20px"
            },
            render: ImageComponent
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
                backgroundColor: { type: "text" },
                cardColor: { type: "text" },
                textColor: { type: "text" },
            },
            defaultProps: {
                features: [
                    { icon: "🧘", title: "Expert Instructors", description: "Learn from certified professionals" },
                    { icon: "📅", title: "Flexible Schedule", description: "Classes available 7 days a week" },
                    { icon: "🏆", title: "Results Driven", description: "Achieve your wellness goals" },
                ],
                backgroundColor: "#f4f4f5",
                cardColor: "#ffffff"
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
                backgroundColor: { type: "text" },
                textColor: { type: "text" },
            },
            defaultProps: {
                testimonials: [
                    { quote: "This studio changed my life!", author: "Happy Student" },
                ],
            },
            render: Testimonials,
        },
        TestimonialCarousel: {
            label: "Testimonial Carousel",
            fields: {
                testimonials: {
                    type: "array",
                    arrayFields: {
                        quote: { type: "textarea" },
                        author: { type: "text" },
                    }
                },
                backgroundColor: { type: "text" },
                textColor: { type: "text" },
            },
            defaultProps: {
                testimonials: [
                    { quote: "An absolute game changer for my fitness.", author: "Sarah J." },
                    { quote: "The community is so welcoming.", author: "David B." },
                    { quote: "Expert guidance in every class.", author: "Emily R." },
                ],
                backgroundColor: "#ffffff",
                textColor: "#000000"
            },
            render: TestimonialCarousel,
        },
        ContactForm: {
            label: "Contact Form",
            fields: {
                title: { type: "text" },
                email: { type: "text", label: "Recipient Email" },
                backgroundColor: { type: "text" },
            },
            defaultProps: {
                title: "Get in Touch",
                backgroundColor: "#18181b"
            },
            render: ContactForm,
        },
        MapSection: {
            label: "Map/Location",
            fields: {
                title: { type: "text" },
                address: { type: "text" },
                height: { type: "text", label: "Height (e.g. 500px)" }
            },
            defaultProps: {
                title: "Visit Us",
                address: "123 Studio Street, City, State",
                height: "500px"
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
                },
                backgroundColor: { type: "text" }
            },
            defaultProps: {
                title: "Membership Plans",
                plans: [
                    { name: "Starter", price: "29", isPopular: false, benefits: ["1 Class / Week"], ctaText: "Join Now" },
                    { name: "Unlimited", price: "99", isPopular: true, benefits: ["All Classes", "Free Guest Pass"], ctaText: "Go Pro" }
                ],
                backgroundColor: "#fafafa"
            },
            render: PricingTable
        },
        FAQBlock: {
            label: "FAQ Section",
            fields: {
                title: { type: "text", label: "Section Title" },
                category: {
                    type: "select",
                    label: "FAQ Category",
                    options: [
                        { label: "All FAQs", value: "" },
                        { label: "Features", value: "features" },
                        { label: "Pricing", value: "pricing" },
                        { label: "Support", value: "support" },
                        { label: "Getting Started", value: "getting_started" }
                    ]
                },
                maxItems: { type: "number", label: "Max FAQs to Show" },
                backgroundColor: { type: "text", label: "Background Color (Hex)" },
                textColor: { type: "text", label: "Text Color (Hex)" }
            },
            defaultProps: {
                title: "Frequently Asked Questions",
                category: "",
                maxItems: 10,
                backgroundColor: "#fafafa",
                textColor: "#18181b"
            },
            render: FAQBlock
        },
    },
};

export default puckConfig;
