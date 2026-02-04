
import { LoaderFunction, ActionFunction } from "react-router";

import { useLoaderData, Form, useActionData, useNavigation } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { UserProfile } from "@clerk/react-router";
import { apiRequest } from "../utils/api";

type UserProfile = {
    id: string;
    email: string;
    profile: {
        firstName?: string;
        lastName?: string;
        phoneNumber?: string;
        address?: string;
        contactPreferences?: {
            email?: boolean;
            sms?: boolean;
        };
    };
};

export const loader: LoaderFunction = async (args) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const user = await apiRequest("/users/me", token);
        return { user };
    } catch (e) {
        // If user not found or error, likely explicit access denied or new user issue
        return { user: null, error: "Could not load profile" };
    }
};

export const action: ActionFunction = async (args) => {
    const { request } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();

    const phoneNumber = formData.get("phoneNumber");
    const address = formData.get("address");
    const emailPref = formData.get("pref_email") === "on";
    const smsPref = formData.get("pref_sms") === "on";

    try {
        await apiRequest("/users/me/profile", token, {
            method: "PUT",
            body: JSON.stringify({
                phoneNumber,
                address,
                contactPreferences: {
                    email: emailPref,
                    sms: smsPref
                }
            })
        });
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
};

export default function ProfileRoute() {
    const { user, error } = useLoaderData<{ user: UserProfile | null, error?: string }>();

    if (error || !user) {
        return <div style={{ color: 'red' }}>Error loading profile: {error || "Unknown error"}</div>;
    }

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Account Settings</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">Manage your personal details and security settings.</p>
            </div>

            {/* Clerk User Profile Component */}
            <div className="clerk-profile-wrapper">
                <UserProfile
                    path="/dashboard/profile"
                    routing="path"
                    appearance={{
                        elements: {
                            rootBox: "w-full",
                            card: "w-full shadow-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl",
                            navbar: "hidden md:flex",
                            navbarButton: "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
                            headerTitle: "text-zinc-900 dark:text-zinc-100",
                            headerSubtitle: "text-zinc-500 dark:text-zinc-400",
                            profileSectionTitleText: "text-zinc-900 dark:text-zinc-100 font-bold",
                            accordionTriggerButton: "text-zinc-900 dark:text-zinc-100",
                        }
                    }}
                />
            </div>
        </div>
    );
}
