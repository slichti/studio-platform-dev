import { useParams, Link, useOutletContext } from "react-router";
import { useState } from "react";
import { Search, UserPlus, Filter, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/Card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/Badge";
import { Select } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/Table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "~/components/ui/DropdownMenu";
import { ConfirmationDialog } from "~/components/Dialogs";
import { useStudents } from "~/hooks/useStudents";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";


import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const StudentsPage = lazy(() => import("../components/routes/StudentsPage"));

export default function StudioStudents() {
    return (
        <ClientOnly fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Students...</div>}>
            <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Students...</div>}>
                <StudentsPage />
            </Suspense>
        </ClientOnly>
    );
}
