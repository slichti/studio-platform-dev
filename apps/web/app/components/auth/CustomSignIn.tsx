import { useSignIn } from "@clerk/react-router";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

export function CustomSignIn() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    if (!isLoaded) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });

            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                navigate("/studio/test-studio"); // Default redirect for now
            } else {
                console.log(result);
                setError("Login incomplete. MFA not supported in this custom form yet.");
            }
        } catch (err: any) {
            console.error(err);
            setError(err.errors?.[0]?.message || "Failed to sign in");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Welcome Back</h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                    Enter your credentials to access your studio.
                </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                        Email Address
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white"
                        placeholder="you@example.com"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                        Password
                    </label>
                    <div className="relative">
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white pr-10"
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-sm">
                        <Link to="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                            Forgot password?
                        </Link>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold py-2.5 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isLoading && <Loader2 size={16} className="animate-spin" />}
                    Sign In
                </button>
            </form>

            <div className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Don't have an account?{' '}
                <Link to="/sign-up" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                    Sign up
                </Link>
            </div>
        </div>
    );
}
