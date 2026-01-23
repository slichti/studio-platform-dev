
import { Smartphone, Check } from "lucide-react";

export default function MobileBuilderGuide() {
    return (
        <article className="prose prose-zinc dark:prose-invert max-w-none">
            <div className="flex items-center gap-3 mb-6 not-prose">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                    <Smartphone size={24} />
                </div>
                <div className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Feature Guide</div>
            </div>

            <h1 className="text-4xl font-bold mb-6">White Label Mobile App Builder</h1>
            <p className="text-xl text-zinc-500 mb-8 leading-relaxed">
                Transform your studio's digital presence with a fully branded "White Label" mobile app. Your students can book classes, manage memberships, and receive push notifications directly from their home screen.
            </p>

            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-6 mb-8 border border-zinc-200 dark:border-zinc-800 not-prose">
                <h3 className="text-lg font-bold mb-4">What's Included?</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <li className="flex items-center gap-2">
                        <Check size={16} className="text-green-500" />
                        <span>Custom App Icon & Name</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <Check size={16} className="text-green-500" />
                        <span>Branded Splash Screen</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <Check size={16} className="text-green-500" />
                        <span>Native Biometric Login (FaceID)</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <Check size={16} className="text-green-500" />
                        <span>Push Notifications</span>
                    </li>
                </ul>
            </div>

            <h2>Getting Started</h2>
            <p>
                To configure your app, navigate to <strong>Settings &gt; Mobile App</strong> in your studio dashboard.
            </p>

            <ol>
                <li>
                    <strong>App Identity:</strong> Choose the name that will appear under your app icon on user devices (e.g., "My Studio").
                </li>
                <li>
                    <strong>Primary Color:</strong> Select your brand's main color. This will tint buttons, active tabs, and highlights throughout the app.
                </li>
                <li>
                    <strong>Assets:</strong> Upload a high-resolution App Icon (1024x1024 PNG) and a Splash Screen image.
                </li>
            </ol>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg my-6 not-prose">
                <h4 className="font-bold text-blue-700 dark:text-blue-300 mb-1">Pro Tip</h4>
                <p className="text-blue-600 dark:text-blue-400 text-sm">
                    Keep your app icon simple. Avoid small text or complex details, as it will be viewed at very small sizes on phone screens.
                </p>
            </div>

            <h2>Publishing Process</h2>
            <p>
                Once you save your configuration, our automated build system (powered by Expo EAS) will generate the native binaries (`.ipa` and `.aab`) for iOS and Android.
            </p>
            <p>
                <i>Note: Publishing to the Apple App Store requires an Apple Developer Account enrolled in the Apple Business Manager program if you are a business entity.</i>
            </p>

        </article>
    );
}
