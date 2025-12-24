// @ts-ignore
import type { MetaFunction } from "react-router";
// @ts-ignore
import { Link } from "react-router";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/react-router";
// ... imports ...

export default function Index() {
    const { user } = useUser();

    return (
        <div style={{ fontFamily: "Inter, sans-serif", color: "#333", margin: 0, padding: 0 }}>
            {/* Navigation */}
            <nav style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem 2rem",
                borderBottom: "1px solid #eaeaea",
                backgroundColor: "#fff"
            }}>
                <div style={{ fontWeight: "700", fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span>🧘 Studio Management Platform</span>
                </div>
                <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                    <Link to="/admin" style={{ textDecoration: "none", color: "#666", fontSize: "0.9rem" }}>Admin</Link>
                    <SignedIn>
                        <Link to="/dashboard" style={{ textDecoration: "none", color: "#666", fontSize: "0.9rem" }}>Dashboard</Link>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "0.9rem", color: "#333" }}>
                                {user?.firstName ? `Hi, ${user.firstName}` : ''}
                            </span>
                            <UserButton afterSignOutUrl="/" />
                        </div>
                    </SignedIn>
                    <SignedOut>
                        <Link to="/sign-in" style={{ textDecoration: "none", color: "#666", fontSize: "0.9rem" }}>Sign In</Link>
                        <Link to="/sign-up" style={{
                            padding: "8px 16px",
                            backgroundColor: "#000",
                            color: "#fff",
                            borderRadius: "6px",
                            textDecoration: "none",
                            fontSize: "0.9rem"
                        }}>
                            Get Started
                        </Link>
                    </SignedOut>
                </div>
            </nav>

            {/* Hero Section */}
            <main style={{
                maxWidth: "1200px",
                margin: "0 auto",
                padding: "6rem 2rem",
                textAlign: "center"
            }}>
                <h1 style={{
                    fontSize: "3.5rem",
                    fontWeight: "800",
                    marginBottom: "1.5rem",
                    letterSpacing: "-0.02em",
                    background: "linear-gradient(to right, #2563eb, #9333ea)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                }}>
                    Modern Studio Management
                </h1>
                <p style={{
                    fontSize: "1.25rem",
                    color: "#666",
                    marginBottom: "3rem",
                    maxWidth: "600px",
                    marginLeft: "auto",
                    marginRight: "auto",
                    lineHeight: "1.6"
                }}>
                    Streamline your yoga studio operations with our comprehensive platform.
                    Manage classes, memberships, and students all in one place.
                </p>

                <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "2rem" }}>
                    <SignedIn>
                        <Link to="/dashboard" style={{
                            padding: "14px 28px",
                            backgroundColor: "#000",
                            color: "#fff",
                            borderRadius: "8px",
                            textDecoration: "none",
                            fontWeight: "600",
                            fontSize: "1.1rem"
                        }}>
                            Go to Dashboard
                        </Link>
                    </SignedIn>
                    <SignedOut>
                        <Link to="/sign-up" style={{
                            padding: "14px 28px",
                            backgroundColor: "#000",
                            color: "#fff",
                            borderRadius: "8px",
                            textDecoration: "none",
                            fontWeight: "600",
                            fontSize: "1.1rem"
                        }}>
                            Start Your Free Trial
                        </Link>
                        <Link to="/sign-in" style={{
                            padding: "14px 28px",
                            backgroundColor: "#fff",
                            color: "#000",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            textDecoration: "none",
                            fontWeight: "600",
                            fontSize: "1.1rem"
                        }}>
                            Log In
                        </Link>
                    </SignedOut>
                </div>
            </main>

            {/* Features Preview */}
            <div style={{ background: "#f9fafb", padding: "6rem 2rem" }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
                    {[
                        { title: "Class Scheduling", desc: "Easy to use calendar for managing all your classes and recurring sessions." },
                        { title: "Member Management", desc: "Track attendance, memberships, and payments for all your students." },
                        { title: "Instructor Portal", desc: "Give your instructors access to their schedules and rosters." }
                    ].map((feature, i) => (
                        <div key={i} style={{ background: "#fff", padding: "2rem", borderRadius: "12px", border: "1px solid #eaeaea" }}>
                            <h3 style={{ fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: "600" }}>{feature.title}</h3>
                            <p style={{ color: "#666", lineHeight: "1.5" }}>{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
