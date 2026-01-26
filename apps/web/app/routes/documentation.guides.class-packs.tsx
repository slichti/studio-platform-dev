import { Link } from "react-router";

export default function ClassPacksGuide() {
    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
                    <Link to="/documentation" className="hover:text-zinc-900">Docs</Link>
                    <span>/</span>
                    <span className="text-zinc-900">How-to Guides</span>
                </div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">How to Setup Class Packs</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400">
                    Create flexible pricing options like "10 Class Pack" or "Drop-ins".
                </p>
            </div>

            <div className="prose dark:prose-invert max-w-none">
                <h3>Overview</h3>
                <p>
                    Class Packs allow students to purchase a set number of credits to book classes.
                    Unlike recurring memberships, these are one-time purchases (though they can have expiration dates).
                </p>

                <h3>Step 1: Go to Commerce</h3>
                <p>
                    Navigate to <strong>Commerce</strong> &gt; <strong>Packs & Retail</strong>.
                </p>

                <h3>Step 2: Create New Pack</h3>
                <p>
                    Click the "Create Product" button and select "Class Pack".
                </p>

                <h3>Step 3: Configure Details</h3>
                <ul>
                    <li><strong>Name:</strong> e.g., "10 Class Summer Pack"</li>
                    <li><strong>Credits:</strong> How many classes does this buy? (e.g., 10)</li>
                    <li><strong>Price:</strong> Total price (e.g., $150)</li>
                    <li><strong>Expiration:</strong> (Optional) Set to expire 3, 6, or 12 months after purchase.</li>
                </ul>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-l-4 border-yellow-500 my-6">
                    <h4 className="text-yellow-800 dark:text-yellow-200 mt-0">Pricing Tip</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-0">
                        Class packs usually offer a discount per class compared to a drop-in rate.
                        Make sure to highlight this value!
                    </p>
                </div>

                <h3>Step 4: Save</h3>
                <p>
                    Hit Save. The pack is now available for purchase on your public page and mobile app.
                </p>
            </div>
        </div>
    );
}
