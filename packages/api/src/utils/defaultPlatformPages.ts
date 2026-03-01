export const defaultPlatformPages: Record<string, any> = {
    about: {
        root: {
            props: {
                title: "About Studio Platform",
                primaryColor: "#2563eb",
                secondaryColor: "#18181b",
                chatEnabled: true
            }
        },
        content: [
            {
                type: "Columns",
                props: {
                    id: "cols-about",
                    distribution: "1-1",
                    padding: "large",
                    backgroundColor: "transparent",
                    textColor: "inherit"
                }
            }
        ],
        zones: {
            "cols-about:left": [
                {
                    type: "TextBlock",
                    props: {
                        id: "text-about-mission",
                        alignment: "left",
                        content: "<h1 style=\"font-size: 3rem; font-weight: 900; margin-bottom: 2rem;\">Our Mission</h1><p style=\"font-size: 1.25rem; line-height: 1.8; margin-bottom: 1.5rem; color: #52525b;\">For too long, studio owners have been forced to choose between clunky legacy software or piecing together a dozen expensive tools just to run their business.</p><p style=\"font-size: 1.25rem; line-height: 1.8; color: #52525b;\">Studio Platform changes that. We provide an all-in-one, beautifully designed operating system that handles everything from class scheduling and automatic billing to website building and point-of-sale — so owners can focus on what they do best: teaching and building community.</p>"
                    }
                }
            ],
            "cols-about:center": [
                {
                    type: "FeatureGrid",
                    props: {
                        id: "features-about",
                        backgroundColor: "transparent",
                        cardColor: "#ffffff",
                        textColor: "#18181b",
                        features: [
                            { icon: "💖", title: "Community First", description: "Tools designed specifically to foster connection." },
                            { icon: "📈", "title": "Built for Growth", "description": "Marketing and CRM tools that fill your classes." },
                            { icon: "🔒", "title": "Reliable & Secure", "description": "Enterprise-grade infrastructure you can trust." },
                            { icon: "✨", "title": "Modern Design", "description": "A premium experience for you and your students." }
                        ]
                    }
                }
            ]
        }
    },
    privacy: {
        root: {
            props: {
                title: "Privacy Policy",
            }
        },
        content: [
            {
                type: "TextBlock",
                props: {
                    id: "text-privacy",
                    alignment: "left",
                    content: "<h1>Privacy Policy</h1><p>Last Updated: February 2026</p><h2>1. Information We Collect</h2><p>We collect several types of information from and about users of our Website...</p><h2>2. How We Use Your Information</h2><p>We use information that we collect about you or that you provide to us...</p>"
                }
            }
        ],
        zones: {}
    },
    terms: {
        root: {
            props: {
                title: "Terms of Service",
            }
        },
        content: [
            {
                type: "TextBlock",
                props: {
                    id: "text-terms",
                    alignment: "left",
                    content: "<h1>Terms of Service</h1><p>Last Updated: February 2026</p><h2>1. Subscriptions & Billing</h2><p>Some parts of the Service are billed on a subscription basis...</p>"
                }
            }
        ],
        zones: {}
    }
};
