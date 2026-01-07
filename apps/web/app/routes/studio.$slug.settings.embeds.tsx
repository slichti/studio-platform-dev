// @ts-ignore
import { useOutletContext, useParams } from "react-router";
import { Link, Code, Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";

export default function StudioSettingsEmbeds() {
    const { tenant } = useOutletContext<any>();
    const { slug } = useParams();
    const [copied, setCopied] = useState<string | null>(null);

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://platform.com'; // Fallback
    const calendarUrl = `${baseUrl}/embed/${slug}/calendar`;

    const getIframeCode = (url: string, height: number = 800) => {
        return `<iframe 
  src="${url}" 
  style="width: 100%; height: ${height}px; border: none; border-radius: 8px; overflow: hidden;"
  title="${tenant.name} Schedule"
></iframe>`;
    };

    const handleCopy = (code: string, id: string) => {
        navigator.clipboard.writeText(code);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="max-w-4xl p-8 animate-in fade-in duration-500">
            <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">Website Widgets</h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                    Embed your studio schedule directly into your website (Wix, Squarespace, WordPress, etc.).
                </p>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Calendar Widget */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl h-fit">
                                <Link size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Class Calendar</h3>
                                <p className="text-sm text-zinc-500 mt-1 max-w-lg">
                                    Display your upcoming classes. Students can view details and clear up availability. Booking actions will open in a secure window.
                                </p>
                            </div>
                        </div>
                        <a
                            href={calendarUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            <ExternalLink size={14} />
                            Preview
                        </a>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs overflow-x-auto relative group">
                        <code className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-all">
                            {getIframeCode(calendarUrl)}
                        </code>
                        <button
                            onClick={() => handleCopy(getIframeCode(calendarUrl), 'calendar')}
                            className="absolute top-4 right-4 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-sm hover:bg-zinc-50 transition-colors"
                        >
                            {copied === 'calendar' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-zinc-500" />}
                        </button>
                    </div>

                    <div className="mt-6 flex flex-col gap-4">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Setup Instructions</h4>
                        <ol className="list-decimal list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
                            <li>Copy the code snippet above.</li>
                            <li>Go to your website builder (Wix, Squarespace, etc.).</li>
                            <li>Add an <strong>Embed</strong> or <strong>HTML Code</strong> block.</li>
                            <li>Paste the code snippet and save.</li>
                        </ol>
                    </div>
                </div>

                {/* Pricing Widget */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl h-fit">
                                <Code size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Membership Pricing</h3>
                                <p className="text-sm text-zinc-500 mt-1 max-w-lg">
                                    Showcase your memberships and class packs. The layout is responsive and adapts to your site width.
                                </p>
                            </div>
                        </div>
                        <a
                            href={`${baseUrl}/embed/${slug}/pricing`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            <ExternalLink size={14} />
                            Preview
                        </a>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-mono text-xs overflow-x-auto relative group">
                        <code className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-all">
                            {getIframeCode(`${baseUrl}/embed/${slug}/pricing`, 600)}
                        </code>
                        <button
                            onClick={() => handleCopy(getIframeCode(`${baseUrl}/embed/${slug}/pricing`, 600), 'pricing')}
                            className="absolute top-4 right-4 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-sm hover:bg-zinc-50 transition-colors"
                        >
                            {copied === 'pricing' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-zinc-500" />}
                        </button>
                    </div>

                    <div className="mt-6 flex flex-col gap-4">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Usage Tips</h4>
                        <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
                            <li>Set the iframe height to <code>600px</code> or more to avoid scrollbars.</li>
                            <li>If you have no memberships created, a demo preview (based on average studio pricing) will appear to help you visualize the layout.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
