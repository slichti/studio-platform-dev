import { useOutletContext } from "react-router";
import { QRCodeDisplay } from "~/components/QRCodeDisplay";
import { useState, useEffect } from "react";

export default function StudioQRCodes() {
    const { tenant } = useOutletContext<any>();
    const [baseUrl, setBaseUrl] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            setBaseUrl(window.location.origin);
        }
    }, []);

    // Construct URLs
    // 1. Public Website
    const publicUrl = tenant.customDomain
        ? `https://${tenant.customDomain}`
        : `${baseUrl}/site/${tenant.slug}`;

    // 2. Class Schedule (Direct Link)
    // Assuming /site/:slug/classes matches the likely public route, or fallback to internal if public paths enabled
    const scheduleUrl = `${publicUrl}/classes`;

    // 3. Kiosk Mode (Internal but shared)
    const kioskUrl = `${baseUrl}/studio/${tenant.slug}/checkin/kiosk`;

    // 4. Mobile App (Placeholder)
    const appUrl = tenant.mobileAppConfig?.publicDownloadUrl || "";

    if (!baseUrl) return null; // Hydration wait

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">QR Codes</h1>
                <p className="text-zinc-500 dark:text-zinc-400">
                    Download and print these QR codes to display in your studio or share with students.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <QRCodeDisplay
                    value={publicUrl}
                    title="Studio Website"
                    description="Direct link to your studio's home page."
                    color={tenant.branding?.primaryColor || "#000000"}
                />

                <QRCodeDisplay
                    value={kioskUrl}
                    title="Kiosk Check-in"
                    description="Display this at your front desk for quick student check-ins."
                    color={tenant.branding?.primaryColor || "#000000"}
                />

                <QRCodeDisplay
                    value={scheduleUrl}
                    title="Class Schedule"
                    description="Direct link for students to view classes and book."
                    color={tenant.branding?.primaryColor || "#000000"}
                />

                {appUrl && (
                    <QRCodeDisplay
                        value={appUrl}
                        title="Download App"
                        description="Direct link to download your studio's mobile app."
                        color={tenant.branding?.primaryColor || "#000000"}
                    />
                )}
            </div>

            <div className="mt-12 p-6 bg-blue-50 dark:bg-zinc-900 border border-blue-100 dark:border-zinc-800 rounded-xl">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Tips for using QR Codes</h3>
                <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>Print the <strong>Kiosk Check-in</strong> code and place it on your front desk.</li>
                    <li>Add the <strong>Studio Website</strong> code to your business cards or flyers.</li>
                    <li>Post the <strong>Download App</strong> code in your lobby to encourage students to book via the app.</li>
                </ul>
            </div>
        </div>
    );
}
