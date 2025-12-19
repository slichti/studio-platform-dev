import { SignIn } from "@clerk/remix";

export default function SignInPage() {
    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            <SignIn />
        </div>
    );
}
