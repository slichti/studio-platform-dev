
import { useState, useEffect } from "react";
import { useParams, useOutletContext } from "react-router";
import { apiRequest } from "~/utils/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/Card";
import { Trash2, Loader2, Key, MessageSquare, Mail, Save, CreditCard, CheckCircle, Smartphone, Send, Shield, Layers } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";


import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const IntegrationsPage = lazy(() => import("~/components/routes/IntegrationsPage"));

export default function Integrations() {
    return (
        <ClientOnly fallback={<div className="p-8">Loading Integrations...</div>}>
            <Suspense fallback={<div className="p-8">Loading Integrations...</div>}>
                <IntegrationsPage />
            </Suspense>
        </ClientOnly>
    );
}

