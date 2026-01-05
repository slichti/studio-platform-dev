import { useState, useEffect } from "react";
import { useUser } from "@clerk/react-router";

export function useAdminPrivacy(isSystemAdmin: boolean = false) {
    const [isPrivacyMode, setIsPrivacyMode] = useState(false);

    useEffect(() => {
        // Only relevant if user is System Admin (or we are in admin context)
        // If passed isSystemAdmin is false, maybe we check generic token or similar?
        // But mainly this relies on localStorage toggled by Admin.

        // If we want to strictly enforce "Only System Admins see this", the backend handles data security.
        // This is purely for "Polite Privacy" masking.
        if (typeof window !== "undefined") {
            const showFinancials = localStorage.getItem('admin_show_financials') === 'true';
            // Privacy Mode is TRUE if showFinancials is FALSE
            setIsPrivacyMode(!showFinancials);
        }
    }, []);

    // Listen for storage events (if tabs change or toggle changes in same window context?)
    // In same window, storage event doesn't fire. But we might need a custom event or context if we want instant update across components.
    // For now, simple fetch on mount is okay.

    return { isPrivacyMode };
}
