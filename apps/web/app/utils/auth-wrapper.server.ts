import { getAuth as clerkGetAuth, rootAuthLoader as clerkRootAuthLoader } from "@clerk/react-router/server";
import { type LoaderFunctionArgs, redirect } from "react-router";

/**
 * Enhanced getAuth that supports E2E bypass cookies in non-production environments.
 */
export async function getAuth(args: any) {
    const isDev = process.env.NODE_ENV === 'development' || process.env.ENVIRONMENT === 'test';

    if (isDev) {
        const cookieHeader = args.request.headers.get("Cookie") || "";
        // Use a more robust regex or just check inclusion if preferred, but let's try this
        const match = cookieHeader.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match && match[1]) {
            const userId = match[1].replace(/["']/g, ''); // Handle quoted values if any
            return {
                userId,
                sessionId: "mock-session",
                getToken: async () => userId, // The API authMiddleware handles 'user_' prefix
                claims: { sub: userId, role: userId.includes('owner') ? 'admin' : 'member' },
                isE2EBypassed: true
            };
        }
    }

    return { ...(await clerkGetAuth(args)), isE2EBypassed: false };
}

/**
 * Enhanced rootAuthLoader that supports E2E bypass.
 */
export async function rootAuthLoader(args: LoaderFunctionArgs, callback: (args: any) => any) {
    const isDev = process.env.NODE_ENV === 'development' || process.env.ENVIRONMENT === 'test';

    if (isDev) {
        const cookieHeader = args.request.headers.get("Cookie") || "";
        console.log(`[DEBUG AUTH] Cookie Header: ${cookieHeader}`);
        const match = cookieHeader.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match && match[1]) {
            const userId = match[1];
            console.log(`[DEBUG AUTH] BYPASS MATCHED! userId: ${userId}`);
            // Simulate the root auth loader response if bypassed
            const result = await callback({
                ...args,
                auth: { userId, sessionId: "mock-session" }
            });

            return {
                ...result,
                isE2EBypassed: true,
                __clerk_ssr_state: {
                    userId,
                    sessionId: "mock-session",
                    user: {
                        id: userId,
                        primaryEmailAddress: { emailAddress: "e2e@test.com", verification: { status: 'verified' } },
                        firstName: "E2E",
                        lastName: "Tester",
                        fullName: "E2E Tester",
                        imageUrl: "https://img.clerk.com/static/placeholder.png"
                    },
                    session: { id: "mock-session", userId, status: "active" },
                    orgId: null,
                    orgRole: null,
                    orgPermissions: []
                }
            };
        }
    }

    return clerkRootAuthLoader(args, callback);
}
