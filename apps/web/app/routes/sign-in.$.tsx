import { SignIn } from "@clerk/react-router";

export default function SignInPage() {
    return (
        <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden" }}>
            {/* Left Side - Hero/Branding */}
            <div style={{
                flex: "1",
                background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "60px",
                color: "white",
                position: "relative"
            }}>
                {/* Abstract Pattern overlay */}
                <div style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0, bottom: 0,
                    opacity: 0.1,
                    backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0%, transparent 20%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.4) 0%, transparent 20%)"
                }} />

                <div style={{ position: "relative", zIndex: 1 }}>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", letterSpacing: "-0.025em" }}>Studio Platform</h1>
                </div>

                <div style={{ position: "relative", zIndex: 1, maxWidth: "480px" }}>
                    <h2 style={{ fontSize: "3rem", fontWeight: "bold", lineHeight: "1.1", marginBottom: "20px", letterSpacing: "-0.03em" }}>
                        Manage your wellness business with elegance.
                    </h2>
                    <p style={{ fontSize: "1.125rem", opacity: 0.8, lineHeight: "1.6" }}>
                        Everything you need to run your studio, engage students, and grow your community in one beautiful platform.
                    </p>
                </div>

                <div style={{ position: "relative", zIndex: 1, opacity: 0.6, fontSize: "0.875rem" }}>
                    © 2025 Studio Platform Inc.
                </div>
            </div>

            {/* Right Side - Auth Form */}
            <div style={{
                flex: "1",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#ffffff",
                padding: "40px"
            }}>
                <SignIn
                    appearance={{
                        elements: {
                            rootBox: {
                                width: "100%",
                                maxWidth: "400px"
                            },
                            card: {
                                boxShadow: "none",
                                border: "none",
                                width: "100%"
                            },
                            headerTitle: {
                                fontSize: "1.75rem",
                                fontWeight: "700",
                                color: "#111827"
                            },
                            headerSubtitle: {
                                color: "#6b7280",
                                fontSize: "1rem"
                            },
                            formButtonPrimary: {
                                backgroundColor: "#4338ca",
                                fontSize: "0.95rem",
                                fontWeight: "600",
                                textTransform: "none",
                                padding: "12px",
                                '&:hover': {
                                    backgroundColor: "#3730a3"
                                }
                            },
                            formFieldInput: {
                                borderRadius: "8px",
                                borderColor: "#e5e7eb",
                                padding: "10px 12px",
                                fontSize: "1rem"
                            },
                            socialButtonsBlockButton: {
                                borderRadius: "8px",
                                borderColor: "#e5e7eb",
                                textTransform: "none",
                                fontWeight: "500"
                            },
                            footerActionLink: {
                                color: "#4338ca",
                                fontWeight: "600"
                            }
                        },
                        layout: {
                            socialButtonsPlacement: "bottom",
                            logoPlacement: "none"
                        }
                    }}
                />
            </div>
        </div>
    );
}
