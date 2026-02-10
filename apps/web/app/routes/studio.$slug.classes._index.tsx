import { useParams, useOutletContext, useSearchParams } from "react-router";
import { useState } from "react";
import { Plus, Archive, ArchiveRestore, Filter, Calendar as CalendarIcon, Clock, Users, Video } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";

import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "~/components/ui/dialog";
import { ConfirmationDialog } from "~/components/Dialogs";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { CreateClassModal } from "../components/CreateClassModal";
import { BookingModal } from "../components/BookingModal";

import { useClasses } from "~/hooks/useClasses";
import { useUser } from "~/hooks/useUser";
import { useMembers } from "~/hooks/useMembers"; // Hijack for instructors
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";

// Types
type ClassEvent = {
    id: string;
    title: string;
    description: string;
    startTime: string;
    durationMinutes: number;
    instructorId: string;
    price: number;
    capacity?: number;
    confirmedCount?: number;
    userBookingStatus?: string;
    zoomEnabled?: boolean;
    virtualCount?: number;
    inPersonCount?: number;
    userBooking?: {
        id: string;
        attendanceType: 'in_person' | 'zoom';
    };
    status: 'active' | 'cancelled' | 'archived';
    instructor?: {
        user?: {
            profile?: {
                firstName: string;
                lastName: string;
            }
        }
    }
};


import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const ClassesPage = lazy(() => import("../components/routes/ClassesPage"));

export default function StudioPublicClasses() {
    return (
        <ClientOnly fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Schedule...</div>}>
            <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Schedule...</div>}>
                <ClassesPage />
            </Suspense>
        </ClientOnly>
    );
}
