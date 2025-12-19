import type { MetaFunction } from "react-router";
import { Link } from "react-router";
import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/react-router";
export const meta: MetaFunction = () => {
    return [
        { title: "Yoga Platform" },
        { name: "description", content: "Welcome to the Yoga Platform" },
    ];
};

export default function Index() {
    return (
        <div style={{ fontFamily: "Inter, sans-serif", lineHeight: "1.4" }}>
            <h1>Welcome to Yoga Platform</h1>
            <p>Multi-tenant Studio Management</p>
        </div>
    );
}
