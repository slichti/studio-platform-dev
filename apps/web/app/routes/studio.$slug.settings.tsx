import { ActionFunction, LoaderFunction } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation, useOutletContext } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";

export const action: ActionFunction = async (args) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const name = formData.get("name");
    const primaryColor = formData.get("primaryColor");

    // We need to update the tenant. Endpoint might be PATCH /tenant or similar.
    // Assuming apiRequest handles the header automatically if we pass it, OR we need to pass X-Tenant-Slug explicitly
    // But better: PATCH /tenant/settings

    try {
        await apiRequest("/tenant/settings", token, {
            method: "PATCH",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({ name, branding: { primaryColor } })
        });
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export default function StudioSettings() {
    const { tenant } = useOutletContext<any>();
    const actionData = useActionData();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="max-w-2xl">
            <h2 className="text-2xl font-bold mb-6">Studio Settings</h2>

            <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
                <Form method="post" className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Studio Name</label>
                        <input
                            name="name"
                            defaultValue={tenant.name}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Primary Brand Color</label>
                        <div className="flex gap-2 items-center">
                            <input
                                type="color"
                                name="primaryColor"
                                defaultValue={tenant.branding?.primaryColor || "#4f46e5"}
                                className="h-9 w-9 p-0 border border-zinc-300 rounded"
                            />
                            <input
                                type="text"
                                name="primaryColorText"
                                defaultValue={tenant.branding?.primaryColor || "#4f46e5"}
                                className="w-32 px-3 py-2 border border-zinc-300 rounded-md font-mono text-sm"
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </button>
                    </div>

                    {actionData?.success && (
                        <p className="text-green-600 text-sm">Settings saved successfully.</p>
                    )}
                    {actionData?.error && (
                        <p className="text-red-600 text-sm">{actionData.error}</p>
                    )}
                </Form>
            </div>
        </div>
    );
}
