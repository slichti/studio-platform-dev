import { Link } from "react-router";

export default function WaiverGuide() {
    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
                    <Link to="/documentation" className="hover:text-zinc-900">Docs</Link>
                    <span>/</span>
                    <span className="text-zinc-900">How-to Guides</span>
                </div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">How to Create a Digital Waiver</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400">
                    Learn how to set up a legally binding liability waiver for your studio.
                </p>
            </div>

            <div className="prose dark:prose-invert max-w-none">
                <h3>Why do I need a waiver?</h3>
                <p>
                    A liability waiver protects your business from potential lawsuits arising from injuries during classes.
                    With Studio Platform, waivers are digital, stored securely, and automatically presented to students before their first booking.
                </p>

                <h3>Step 1: Navigate to Waiver Settings</h3>
                <p>
                    Go to your Studio Dashboard and click on <strong>Settings</strong> in the sidebar, then select <strong>Waivers</strong>.
                </p>
                <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-lg my-4 border border-zinc-200 dark:border-zinc-800 text-sm font-mono text-zinc-600 dark:text-zinc-400">
                    Dashboard &gt; Settings &gt; Waivers &gt; Create New
                </div>

                <h3>Step 2: Define your Terms</h3>
                <p>
                    Enter a title (e.g., "General Liability Release") and the body text.
                    Be sure to cover:
                </p>
                <ul>
                    <li>Assumption of Risk</li>
                    <li>Release of Liability</li>
                    <li>Photo/Video Release (optional)</li>
                </ul>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500 my-6">
                    <h4 className="text-blue-800 dark:text-blue-200 mt-0">Legal Compliance Tip (2026)</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-0">
                        Ensure your waiver includes a "Consumer Disclosure" agreeing to electronic business.
                        Our platform handles the audit trail (IP address, timestamp) automatically for ESIGN compliance.
                    </p>
                </div>

                <h3>Step 3: Enable for Registration</h3>
                <p>
                    Toggle "Require for New Students" to ON. This ensures no one can book a class without signing first.
                </p>

                <h3>Step 4: Publish</h3>
                <p>
                    Click "Publish". Your waiver is now live!
                </p>
            </div>
        </div>
    );
}
