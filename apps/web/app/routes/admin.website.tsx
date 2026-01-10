// Admin Website Builder - Platform-wide website management

import { useLoaderData, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { Globe, ExternalLink, Settings, Users } from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        // Get all tenants with website feature enabled
        const tenants = await apiRequest<any[]>("/admin/tenants", token);
        return { tenants, error: null };
    } catch (e: any) {
        return { tenants: [], error: e.message };
    }
};

export default function AdminWebsite() {
    const { tenants, error } = useLoaderData<any>();

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                    Error: {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                    <Globe className="text-blue-600" />
                    Website Builder
                </h1>
                <p className="text-zinc-500 mt-1">Manage tenant website pages and settings</p>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                    <div className="text-3xl font-bold text-zinc-900">{tenants?.length || 0}</div>
                    <div className="text-sm text-zinc-500">Total Tenants</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                    <div className="text-3xl font-bold text-green-600">
                        {tenants?.filter((t: any) => t.features?.includes('website_builder'))?.length || 0}
                    </div>
                    <div className="text-sm text-zinc-500">With Website Builder</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                    <div className="text-3xl font-bold text-blue-600">—</div>
                    <div className="text-sm text-zinc-500">Published Pages</div>
                </div>
            </div>

            {/* Tenant List */}
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 bg-zinc-50">
                    <h2 className="font-medium text-zinc-900">Tenant Websites</h2>
                </div>
                {tenants.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">
                        No tenants available
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100">
                        {tenants.map((tenant: any) => (
                            <div key={tenant.id} className="p-4 flex items-center justify-between hover:bg-zinc-50">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-medium">
                                        {tenant.name?.charAt(0) || "?"}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-zinc-900">{tenant.name}</h3>
                                        <p className="text-sm text-zinc-500">{tenant.slug}.studio-platform.com</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link
                                        to={`/studio/${tenant.slug}/website/pages`}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                                    >
                                        <Settings size={14} />
                                        Manage
                                    </Link>
                                    <a
                                        href={`https://${tenant.slug}.studio-platform.com`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg"
                                    >
                                        <ExternalLink size={14} />
                                        View Site
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Help Section */}
            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h4 className="font-medium text-blue-900 mb-2">Website Builder Features</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <strong>Puck Editor:</strong> Drag-and-drop visual page builder</li>
                    <li>• <strong>8 Components:</strong> Hero, TextBlock, FeatureGrid, ClassSchedule, InstructorGrid, Testimonials, ContactForm, MapSection</li>
                    <li>• <strong>Custom Domains:</strong> Tenants can connect their own domains</li>
                </ul>
            </div>
        </div>
    );
}
