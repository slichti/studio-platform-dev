import { useState } from 'react';
import { Users, LogOut, ChevronDown, Check } from 'lucide-react';
import { Menu } from '@headlessui/react';
import { useClerk } from '@clerk/react-router';
// @ts-ignore
import { useSubmit } from "react-router";

interface ImpersonationBannerProps {
    tenantName: string;
    userName: string;
    currentRole: string; // 'owner' | 'instructor' | 'student'
    availableRoles?: string[]; // Optional: if we want to restrict to actual roles, but for sysadmin we allow all
}

export function ImpersonationBanner({ tenantName, userName, currentRole }: { tenantName: string, userName: string, currentRole: string }) {
    const roles = ['owner', 'instructor', 'student'];
    const { signOut } = useClerk();

    const handleRoleChange = (role: string) => {
        // Set cookie
        document.cookie = `__impersonate_role=${role}; path=/; SameSite=Lax`;
        window.location.reload();
    };

    const handleExit = async () => {
        // Clear impersonation cookies
        localStorage.removeItem("impersonation_token");
        document.cookie = "__impersonate_token=; path=/; max-age=0; SameSite=Lax";
        document.cookie = "__impersonate_role=; path=/; max-age=0; SameSite=Lax";
        // Perform full Clerk logout
        await signOut({ redirectUrl: "/admin/users" });
    };

    // Determine banner color/style based on role
    const getRoleColor = (r: string) => {
        switch (r) {
            case 'owner': return 'bg-purple-600';
            case 'instructor': return 'bg-blue-600';
            case 'student': return 'bg-emerald-600';
            default: return 'bg-zinc-700';
        }
    };

    const bannerColor = getRoleColor(currentRole);

    return (
        <div className={`${bannerColor} text-white px-4 py-2 flex items-center justify-between shadow-md relative z-50`}>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full text-sm font-medium">
                    <Users size={16} />
                    <span>Impersonating</span>
                </div>
                <div className="text-sm">
                    Viewing <strong>{tenantName}</strong> as <strong>{userName}</strong>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Menu as="div" className="relative">
                    <Menu.Button className="flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors">
                        <span>View as: <strong>{currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}</strong></span>
                        <ChevronDown size={14} />
                    </Menu.Button>
                    <Menu.Items className="absolute right-0 mt-1 w-40 bg-white dark:bg-zinc-800 rounded-md shadow-lg py-1 border border-zinc-200 dark:border-zinc-700 focus:outline-none text-zinc-800 dark:text-zinc-200">
                        {roles.map((role) => (
                            <Menu.Item key={role}>
                                {({ active }) => (
                                    <button
                                        onClick={() => handleRoleChange(role)}
                                        className={`${active ? 'bg-zinc-100 dark:bg-zinc-700' : ''
                                            } group flex w-full items-center justify-between px-3 py-2 text-sm`}
                                    >
                                        <span className="capitalize">{role}</span>
                                        {currentRole === role && <Check size={14} className="text-green-500" />}
                                    </button>
                                )}
                            </Menu.Item>
                        ))}
                    </Menu.Items>
                </Menu>

                <div className="h-4 w-px bg-white/30 mx-2" />

                <button
                    onClick={handleExit}
                    className="flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-red-500/80 rounded text-sm transition-colors"
                >
                    <LogOut size={14} />
                    <span>Exit</span>
                </button>
            </div>
        </div>
    );
}
