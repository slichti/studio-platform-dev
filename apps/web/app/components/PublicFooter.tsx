import { Link } from "react-router";

export function PublicFooter() {
    return (
        <footer className="py-12 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
                    {/* Product */}
                    <div>
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-4">Product</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/features" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Features</Link></li>
                            <li><Link to="/pricing" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Pricing</Link></li>
                            <li><Link to="/pricing/compare" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Compare Plans</Link></li>
                        </ul>
                    </div>
                    {/* Resources */}
                    <div>
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-4">Resources</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/documentation" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Documentation</Link></li>
                            <li><Link to="/sign-up" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Get Started</Link></li>
                        </ul>
                    </div>
                    {/* Company */}
                    <div>
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-4">Company</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/about" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">About</Link></li>
                        </ul>
                    </div>
                    {/* Legal */}
                    <div>
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-4">Legal</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/privacy" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Privacy</Link></li>
                            <li><Link to="/terms" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Terms</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                    © {new Date().getFullYear()} Studio Platform. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
