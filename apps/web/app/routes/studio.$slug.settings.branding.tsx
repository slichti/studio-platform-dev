
import { useState } from "react";

import { useOutletContext, useLoaderData, useRevalidator } from "react-router";
import { apiRequest } from "../utils/api";
import { getAuth } from "@clerk/react-router/server";
import { Upload, X, Trash2, Video, CheckCircle, Circle, Play, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";


export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const assets = await apiRequest('/video-management/branding', token);
        return { assets };
    } catch {
        return { assets: [] };
    }
}


import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const BrandingPage = lazy(() => import("~/components/routes/BrandingPage"));

export default function Branding() {
    return (
        <ClientOnly fallback={<div className="p-8">Loading Branding...</div>}>
            <Suspense fallback={<div className="p-8">Loading Branding...</div>}>
                <BrandingPage />
            </Suspense>
        </ClientOnly>
    );
}

