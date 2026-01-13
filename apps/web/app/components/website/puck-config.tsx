// Puck Component Library for Studio Websites
// These components are used in the drag-and-drop website builder

import type { Config } from "@measured/puck";

// --- Component Definitions ---

// Hero Section
const Hero = ({ title, subtitle, ctaText, ctaLink, backgroundImage }: any) => (
    <section
        className="relative py-20 px-8 text-center bg-gradient-to-br from-blue-600 to-purple-700 text-white"
        style={backgroundImage ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover' } : {}}
    >
        <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">{title || "Welcome to Our Studio"}</h1>
            <p className="text-xl md:text-2xl opacity-90 mb-8">{subtitle || "Your journey starts here"}</p>
            {ctaText && (
                <a href={ctaLink || "#"} className="inline-block bg-white text-blue-600 px-8 py-3 rounded-full font-semibold hover:bg-blue-50 transition">
                    {ctaText}
                </a>
            )}
        </div>
    </section>
);

// Text Block
const TextBlock = ({ content, alignment }: any) => (
    <section className="py-12 px-8">
        <div className={`max-w-3xl mx-auto prose prose-lg ${alignment === 'center' ? 'text-center' : ''}`}>
            <div dangerouslySetInnerHTML={{ __html: content || "<p>Add your content here...</p>" }} />
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
                <div className="aspect-video bg-zinc-200 rounded-xl overflow-hidden shadow-sm">
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

// --- Puck Config Export ---

export const puckConfig: Config = {
    components: {
        Hero: {
            label: "Hero Section",
            fields: {
                title: { type: "text" },
                subtitle: { type: "text" },
                ctaText: { type: "text", label: "Button Text" },
                ctaLink: { type: "text", label: "Button Link" },
                backgroundImage: { type: "text", label: "Background Image URL" },
            },
            defaultProps: {
                title: "Welcome to Our Studio",
                subtitle: "Your wellness journey starts here",
                ctaText: "Book a Class",
                ctaLink: "/schedule",
            },
            render: Hero,
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
    },
};

export default puckConfig;
