// @ts-ignore
import { LoaderFunction, ActionFunction } from "react-router";
// @ts-ignore
import { useLoaderData, Form, useActionData, useNavigation } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
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
    const actionData = useActionData();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    if (error || !user) {
        return <div style={{ color: 'red' }}>Error loading profile: {error || "Unknown error"}</div>;
    }

    const profile = user.profile || {};

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '20px', color: 'var(--text)' }}>My Profile</h2>

            <div style={{ background: 'var(--card-bg)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                {actionData?.success && (
                    <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '6px', marginBottom: '20px', border: '1px solid #10b981' }}>
                        Profile updated successfully!
                    </div>
                )}
                {actionData?.error && (
                    <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', marginBottom: '20px', border: '1px solid #ef4444' }}>
                        Error: {actionData.error}
                    </div>
                )}

                <Form method="post" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Basic Info (Read Only from Clerk usually, but let's show email) */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '5px', color: 'var(--text-muted)' }}>Email</label>
                        <input disabled value={user.email} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'not-allowed' }} />
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '5px', color: 'var(--text)' }}>Phone Number</label>
                        <input name="phoneNumber" type="tel" defaultValue={profile.phoneNumber || ''} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} placeholder="+1 (555) 000-0000" />
                    </div>

                    {/* Address */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '5px', color: 'var(--text)' }}>Home Address</label>
                        <textarea name="address" rows={3} defaultValue={profile.address || ''} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }} placeholder="123 Yoga Lane..." />
                    </div>

                    {/* Preferences */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '10px', color: 'var(--text)', fontWeight: '600' }}>Contact Preferences</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)' }}>
                                <input name="pref_email" type="checkbox" defaultChecked={profile.contactPreferences?.email ?? true} />
                                Receive Email Notifications
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)' }}>
                                <input name="pref_sms" type="checkbox" defaultChecked={profile.contactPreferences?.sms ?? false} />
                                Receive SMS Notifications
                            </label>
                        </div>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button disabled={isSubmitting} type="submit" style={{ padding: '10px 24px', background: 'var(--accent)', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', opacity: isSubmitting ? 0.7 : 1 }}>
                            {isSubmitting ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </Form>
            </div>
        </div>
    );
}
