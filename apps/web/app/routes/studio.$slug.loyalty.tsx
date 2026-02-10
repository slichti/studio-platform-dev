

import { useLoaderData, useActionData, Form, useNavigation, useSubmit, redirect, useOutletContext } from "react-router";

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { apiRequest } from "~/utils/api";
import { getAuth } from "@clerk/react-router/server";
import { Award, Plus, Trash2, Calendar, Target, Gift } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    try {
        const challenges = await apiRequest('/challenges/my-progress', token, {
            headers: { 'X-Tenant-Slug': slug! }
        });
        return {
            challenges: Array.isArray(challenges) ? challenges : [],
            isOwnerOrAdmin: false, // Default, will override in component via Context or check Me here
            error: null
        };
    } catch (e) {
        return { challenges: [], isOwnerOrAdmin: false, error: "Failed to load challenges" };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = params;

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "join") {
        const challengeId = formData.get("challengeId");
        try {
            await apiRequest(`/challenges/${challengeId}/join`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { success: true };
        } catch (e: any) {
            return { error: e.message || "Failed to join challenge" };
        }
    }

    if (intent === "create") {
        const rewardType = formData.get("rewardType");
        let rewardValue = {};

        if (rewardType === 'retail_credit') {
            rewardValue = { creditAmount: formData.get("creditAmount") };
        } else if (formData.get("rewardValue")) {
            try {
                rewardValue = JSON.parse(formData.get("rewardValue") as string);
            } catch (e) { }
        }

        const data = {
            title: formData.get("title"),
            description: formData.get("description"),
            type: formData.get("type"),
            targetValue: parseInt(formData.get("targetValue") as string || "0"),
            frequency: parseInt(formData.get("frequency") as string || "1"),
            period: formData.get("period"),
            rewardType,
            rewardValue,
            startDate: formData.get("startDate"),
            endDate: formData.get("endDate")
        };

        try {
            await apiRequest('/challenges', token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify(data)
            });
            return { success: true };
        } catch (e: any) {
            return { error: e.message || "Failed to create" };
        }
    }

    return null;
};


import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const LoyaltyPage = lazy(() => import("../components/routes/LoyaltyPage"));

export default function Loyalty() {
    return (
        <ClientOnly fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Challenges...</div>}>
            <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Challenges...</div>}>
                <LoyaltyPage />
            </Suspense>
        </ClientOnly>
    );
}
