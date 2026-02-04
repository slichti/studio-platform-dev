import { useEffect, useState } from "react";

import { useNavigate, useSearchParams } from "react-router";
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/react-router";
import { apiRequest } from "../utils/api";

export default function AcceptInvite() {
    const { isLoaded, isSignedIn, user } = useUser();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get("token");

    const [status, setStatus] = useState<'validating' | 'accepting' | 'success' | 'error'>('validating');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoaded) return;
        if (!token) {
            setStatus('error');
            setError("Invalid invitation link (no token).");
            return;
        }
        if (!isSignedIn) {
            // Wait for user to sign in (RedirectToSignIn below handles UI)
            return;
        }

        // Auto-accept if signed in
        acceptInvitation();
    }, [isLoaded, isSignedIn, token]);

    const acceptInvitation = async () => {
        setStatus('accepting');
        try {
            const authToken = await (window as any).Clerk?.session?.getToken();
            const res: any = await apiRequest('/members/accept-invite', authToken, {
                method: 'POST',
                body: JSON.stringify({ token })
            });

            if (res.success) {
                setStatus('success');
                // Fetch tenant slug? Or just redirect to home and let it figure out?
                // The API returned { success: true, tenantId: ... }
                // We won't have slug easily unless we ask for it.
                // Redirect user to home or dashboard. 
                // Ideally API returns slug.
                // For now, redirect to /studio/[slug]/dashboard is hard without slug.
                // Let's redirect to root, or fetch memberships.
                setTimeout(() => {
                    navigate('/'); // Root will redeliver them to their studio list
                }, 2000);
            } else {
                setStatus('error');
                setError(res.error || "Failed to accept invitation.");
            }
        } catch (e: any) {
            setStatus('error');
            setError(e.message || "An unexpected error occurred.");
        }
    };

    if (!isLoaded) return <div className="p-10 text-center">Loading...</div>;

    if (!token) {
        return (
            <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4">
                <div className="bg-white p-8 rounded shadow text-center max-w-md">
                    <h2 className="text-red-600 font-bold mb-2">Invalid Link</h2>
                    <p className="text-zinc-600">This invitation link appears to be missing a token.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4">
            <SignedOut>
                <div className="bg-white p-8 rounded shadow text-center max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-4">You've been invited!</h2>
                    <p className="text-zinc-600 mb-6">Please sign in or create an account to accept this invitation.</p>
                    <div className="flex justify-center">
                        <RedirectToSignIn afterSignInUrl={`/accept-invite?token=${token}`} />
                    </div>
                </div>
            </SignedOut>

            <SignedIn>
                <div className="bg-white p-8 rounded shadow text-center max-w-md w-full">
                    {status === 'accepting' && (
                        <div>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto mb-4"></div>
                            <h2 className="text-xl font-bold">Accepting Invitation...</h2>
                            <p className="text-zinc-500">Linking your account to the studio.</p>
                        </div>
                    )}
                    {status === 'success' && (
                        <div>
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-green-600">Welcome!</h2>
                            <p className="text-zinc-600 mt-2">Invitation accepted successfully.</p>
                            <p className="text-xs text-zinc-400 mt-4">Redirecting you...</p>
                        </div>
                    )}
                    {status === 'error' && (
                        <div>
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-red-600">Error</h2>
                            <p className="text-zinc-600 mt-2">{error}</p>
                            <button
                                onClick={() => navigate('/')}
                                className="mt-6 px-4 py-2 bg-zinc-900 text-white rounded hover:bg-zinc-800"
                            >
                                Go Home
                            </button>
                        </div>
                    )}
                </div>
            </SignedIn>
        </div>
    );
}
