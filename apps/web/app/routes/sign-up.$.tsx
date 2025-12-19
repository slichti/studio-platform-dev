import { SignUp } from "@clerk/remix";

export default function SignUpPage() {
    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            <SignUp />
        </div>
    );
}
