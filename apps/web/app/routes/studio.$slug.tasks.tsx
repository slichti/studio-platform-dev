
import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Suspense, lazy } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const TasksPage = lazy(() => import("~/components/routes/TasksPage"));

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    try {
        const tasks = await apiRequest("/tasks", token, { headers: { 'X-Tenant-Slug': slug } }) as any[];
        // Also fetch me to filter "mine"
        const me: any = await apiRequest("/tenant/me", token, { headers: { 'X-Tenant-Slug': slug } });
        return { initialTasks: tasks || [], me, token, slug };
    } catch (e: any) {
        return { initialTasks: [], me: null, token, slug, error: e.message };
    }
};

export default function TasksRoute() {
    return (
        <ClientOnly fallback={<div className="p-10 text-center text-zinc-500">Loading tasks...</div>}>
            {() => (
                <Suspense fallback={<div className="p-10 text-center text-zinc-500">Loading tasks...</div>}>
                    <TasksPage />
                </Suspense>
            )}
        </ClientOnly>
    );
}
