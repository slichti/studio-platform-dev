
import { type LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { API_URL } from "../utils/api";
import { lazy, Suspense } from "react";
import { ClientOnly } from "../components/ClientOnly";

const AdminBackupsPage = lazy(() => import("../components/routes/AdminBackupsPage"));

export async function loader(args: LoaderFunctionArgs) {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const [backupsRes, tenantsRes, historyRes, systemRes] = await Promise.all([
            fetch(`${API_URL}/admin/backups`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_URL}/admin/backups/tenants`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_URL}/admin/backups/history`, {
                headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_URL}/admin/backups/system`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        ]);

        const backupsData = await backupsRes.json() as any;
        const tenantsData = await tenantsRes.json() as any;
        const historyData = await historyRes.json() as any;
        const systemData = await systemRes.json() as any;

        return {
            backups: backupsData.backups || [],
            r2Summary: backupsData.r2Summary || { system: 0, tenant: 0 },
            tenants: tenantsData.tenants || [],
            history: historyData.history || [],
            systemBackups: systemData.backups || []
        };
    } catch (error) {
        console.error("Failed to load backup data:", error);
        return { backups: [], r2Summary: { system: 0, tenant: 0 }, tenants: [], history: [], systemBackups: [] };
    }
}

export default function AdminBackups() {
    return (
        <ClientOnly fallback={
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        }>
            <Suspense fallback={
                <div className="p-8 flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            }>
                <AdminBackupsPage />
            </Suspense>
        </ClientOnly>
    );
}
