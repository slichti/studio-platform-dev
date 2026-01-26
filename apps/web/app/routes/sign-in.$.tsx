import { SignIn } from "@clerk/react-router";

export default function SignInPage() {
    return (
        <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900 p-4">
            <SignIn path="/sign-in" />
        </main>
    );
}
