import { useSignUp } from "@clerk/react-router";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

export function CustomSignUp() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingVerification, setPendingVerification] = useState(false);
    const [code, setCode] = useState("");

    const navigate = useNavigate();

    if (!isLoaded) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await signUp.create({
                emailAddress: email,
                password,
                firstName,
                lastName
            });

            // Start email verification
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            setPendingVerification(true);
        } catch (err: any) {
            console.error(err);
            setError(err.errors?.[0]?.message || "Failed to create account");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code,
            });

            if (completeSignUp.status !== "complete") {
                setError(JSON.stringify(completeSignUp, null, 2));
            }

            if (completeSignUp.status === "complete") {
                await setActive({ session: completeSignUp.createdSessionId });
                navigate("/create-studio"); // Redirect to onboarding
            }
        } catch (err: any) {
            console.error(err);
            setError(err.errors?.[0]?.message || "Verification failed");
        } finally {
            setIsLoading(false);
        }
    };

    if (pendingVerification) {
        return (
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Verify Email</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                        Enter the code sent to {email}
                    </p>
                </div>
                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
                )}
                <form onSubmit={handleVerify} className="space-y-5">
                    <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-center text-2xl tracking-widest"
                        placeholder="000000"
                    />
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg">
                        {isLoading ? "Verifying..." : "Verify & Continue"}
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Create Account</h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                    Get started with Studio Platform today.
                </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">First Name</label>
                        <input
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Last Name</label>
                        <input
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg pr-10"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold py-2.5 rounded-lg hover:bg-zinc-800 mt-2"
                >
                    {isLoading ? "Creating..." : "Sign Up"}
                </button>
            </form>
            <div className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Already have an account?{' '}
                <Link to="/sign-in" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                    Sign in
                </Link>
            </div>
        </div>
    );
}
