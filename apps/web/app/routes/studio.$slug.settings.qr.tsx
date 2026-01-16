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

    // Construct URLs with UTM parameters
    const utmParams = "?utm_source=qr&utm_medium=offline";

    // 1. Public Website
    const publicUrl = (tenant.customDomain
        ? `https://${tenant.customDomain}`
        : `${baseUrl}/site/${tenant.slug}`) + utmParams;

    // 2. Class Schedule (Direct Link)
    const scheduleUrl = `${publicUrl}/classes${utmParams}`; // Already has params, correct? No publicUrl has it. 
    // Wait, publicUrl + utmParams + /classes + utmParams is wrong.
    // Let's keep base URLs clean and append params at the end.

    // Clean Base Public URL
    const cleanPublicUrl = tenant.customDomain
        ? `https://${tenant.customDomain}`
        : `${baseUrl}/site/${tenant.slug}`;

    const publicUrlWithUtm = `${cleanPublicUrl}${utmParams}`;
    const scheduleUrlWithUtm = `${cleanPublicUrl}/classes${utmParams}`;
    const kioskUrlWithUtm = `${baseUrl}/studio/${tenant.slug}/checkin/kiosk${utmParams}`;

    // Mobile Link might need different handling (Draftbit/Expo), but we'll append query for now.
    const appUrl = tenant.mobileAppConfig?.publicDownloadUrl ? `${tenant.mobileAppConfig.publicDownloadUrl}${utmParams}` : "";

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
                    value={publicUrlWithUtm}
                    title="Studio Website"
                    description="Direct link to your studio's home page."
                    color={tenant.branding?.primaryColor || "#000000"}
                />

                <QRCodeDisplay
                    value={kioskUrlWithUtm}
                    title="Kiosk Check-in"
                    description="Display this at your front desk for quick student check-ins."
                    color={tenant.branding?.primaryColor || "#000000"}
                />

                <QRCodeDisplay
                    value={scheduleUrlWithUtm}
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
