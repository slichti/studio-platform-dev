
import { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { useLoaderData, useSubmit, Form, redirect, useRevalidator, useOutletContext, useActionData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState, useEffect } from "react";
import { Trophy, Target, Users, Calendar, ChevronRight, Plus, Star, Medal, Flame, TrendingUp, Check, Clock, X, Gift } from "lucide-react";
import { toast } from "sonner";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();

    try {
        const [challengesData, myProgressData, leaderboardData] = await Promise.all([
            apiRequest('/challenges', token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest('/challenges/my-progress', token, { headers: { 'X-Tenant-Slug': slug } }).catch(() => []),
            apiRequest('/challenges/leaderboard', token, { headers: { 'X-Tenant-Slug': slug } }).catch(() => [])
        ]) as any[];

        return {
            challenges: challengesData || [],
            myProgress: myProgressData || [],
            leaderboard: leaderboardData || []
        };
    } catch (e) {
        console.error("Challenges Loader Error", e);
        return { challenges: [], myProgress: [], leaderboard: [] };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const { slug } = args.params;
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    if (intent === 'join') {
        await apiRequest(`/challenges/${formData.get("challengeId")}/join`, token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug }
        });
        return { success: true };
    }

    if (intent === 'create') {
        const rewardType = formData.get("rewardType");
        let rewardValue = {};

        if (rewardType === 'retail_credit') {
            rewardValue = { creditAmount: parseInt(formData.get("creditAmount") as string || "0") };
        }

        const data = {
            title: formData.get("title"),
            description: formData.get("description") || null,
            type: formData.get("type"),
            targetValue: parseInt(formData.get("targetValue") as string || "10"),
            frequency: parseInt(formData.get("frequency") as string || "1"),
            period: formData.get("period") || "week",
            rewardType,
            rewardValue: JSON.stringify(rewardValue),
            startDate: formData.get("startDate") || new Date().toISOString().split('T')[0],
            endDate: formData.get("endDate")
        };

        try {
            await apiRequest('/challenges', token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify(data)
            });
            return { success: true, created: true };
        } catch (e: any) {
            return { error: e.message || "Failed to create challenge" };
        }
    }

    return { success: true };
};


import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const ChallengesPage = lazy(() => import("../components/routes/ChallengesPage"));

export default function ChallengesPrograms() {
    return (
        <ClientOnly fallback={<div className="h-screen flex items-center justify-center">Loading Challenges...</div>}>
            <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading Challenges...</div>}>
                <ChallengesPage />
            </Suspense>
        </ClientOnly>
    );
}
