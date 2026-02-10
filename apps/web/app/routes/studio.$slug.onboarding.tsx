
import { useLoaderData, useOutletContext, Form, useNavigation, useSubmit, Link, useNavigate } from "react-router";
import { type LoaderFunctionArgs, type ActionFunctionArgs, redirect, useFetcher, useActionData } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { CheckCircle2, MapPin, Calendar, Palette, ArrowRight, Loader2, Upload, Users, Plus, X } from "lucide-react";
import { cn } from "~/utils/cn";

export const loader = async (args: LoaderFunctionArgs) => {
    // Standard auth check
    const { getToken, userId } = await getAuth(args);
    if (!userId) return null; // Let parent handle redirect if needed, but this is a protected route anyway
    return {};
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    const formData = await args.request.formData();
    const step = formData.get("step");

    try {
        // Step 1: Template
        if (step === "template") {
            const template = formData.get("template");
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({
                    branding: { template },
                    onboardingStep: 2
                }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 2 };
        }

        // Step 2: Branding
        if (step === "branding") {
            const primaryColor = formData.get("primaryColor");
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({
                    branding: { primaryColor, logoUrl: formData.get("logoUrl") },
                    onboardingStep: 3
                }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 3 };
        }

        // Step 3: Location
        if (step === "location") {
            const name = formData.get("name");
            const address = formData.get("address");
            await apiRequest(`/locations`, token, {
                method: "POST",
                body: JSON.stringify({ name, address }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({ onboardingStep: 4 }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 4 };
        }

        // Step 4: Schedule
        if (step === "schedule") {
            const title = formData.get("title");
            const startTime = formData.get("startTime");
            const price = formData.get("price");
            await apiRequest(`/classes`, token, {
                method: "POST",
                body: JSON.stringify({
                    title,
                    startTime,
                    durationMinutes: 60,
                    capacity: 10,
                    price: price ? parseInt(price.toString()) : 2000
                }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({ onboardingStep: 5 }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 5 };
        }

        // Step 5: Team Invites
        if (step === "team") {
            const intent = formData.get("intent");
            if (intent === 'skip') {
                // Just advance
                await apiRequest(`/tenant/settings`, token, {
                    method: "PATCH",
                    body: JSON.stringify({ onboardingStep: 6 }),
                    headers: { 'X-Tenant-Slug': slug! }
                });
                return { step: 6 };
            }

            const emails = formData.getAll("emails[]").filter(e => e.toString().trim() !== '');

            if (emails.length > 0) {
                // Invite each member
                await Promise.all(emails.map(email =>
                    apiRequest(`/members`, token, {
                        method: "POST",
                        body: JSON.stringify({
                            email,
                            firstName: '', // Optional for quick invite
                            lastName: '',
                            role: 'instructor'
                        }),
                        headers: { 'X-Tenant-Slug': slug! }
                    }).catch(e => console.error(`Failed to invite ${email}`, e))
                ));
            }

            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({ onboardingStep: 6 }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 6 };
        }

        // Step 6: Import Complete (Advanced by Skipping or Success)
        if (step === "import_complete") {
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({ onboardingStep: 7 }), // 7 = Completed
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 7 };
        }

        return null;
    } catch (e: any) {
        return { error: e.message || "Action failed" };
    }
};

import { DataImportForm } from "~/components/DataImportForm";


import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const OnboardingPage = lazy(() => import("../components/routes/OnboardingPage"));

export default function StudioOnboarding() {
    return (
        <ClientOnly fallback={<div className="min-h-screen flex items-center justify-center">Loading Onboarding...</div>}>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading Onboarding...</div>}>
                <OnboardingPage />
            </Suspense>
        </ClientOnly>
    );
}
