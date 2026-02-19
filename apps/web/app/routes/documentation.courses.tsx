
import { GraduationCap, DollarSign, Users, Video, CheckCircle2 } from "lucide-react";

export default function HelpCourses() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Course Setup & Monetization</h1>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Courses are specialized class types that can be monetized separately from standard memberships, providing a powerful way to generate revenue from workshops, masterclasses, and specialized training programs.
                </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    What is a Course?
                </h3>
                <p className="text-blue-800 dark:text-blue-200">
                    Unlike standard classes that are often included in memberships, a <strong>Course</strong> is treated as a premium offering. When a class is marked as a course, standard VOD access (via membership) is automatically disabled for that content, requiring students to either book the specific session or purchase the recording standalone.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Key Features</h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl">
                        <DollarSign className="w-8 h-8 text-amber-500 mb-4" />
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Standalone Monetization</h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Set a specific <strong>Recording Price</strong> to allow non-members and members alike to buy permanent access to the recording without needing a subscription.
                        </p>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl">
                        <Users className="w-8 h-8 text-indigo-500 mb-4" />
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Non-Member Access</h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Non-members can purchase courses directly. This allows you to market workshops to your broader community without requiring them to sign up for a monthly plan.
                        </p>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl">
                        <Video className="w-8 h-8 text-purple-500 mb-4" />
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Premium VOD Protection</h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Content marked as a Course is protected. Standard "Membership VOD" access is ignored, ensuring that only paying students can view the curriculum.
                        </p>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-4" />
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Automatic Enrollment</h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            When a student books a course session, they are automatically granted access to the associated recordings and content collections.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Setup Instructions</h2>
                <div className="prose dark:prose-invert max-w-none">
                    <ol className="space-y-4">
                        <li>
                            <strong>Create a New Class:</strong> Go to the <em>Classes</em> section and click <em>New Class</em>.
                        </li>
                        <li>
                            <strong>Set as Course:</strong> In the configuration modal, toggle the <strong>Is Course</strong> option. (If you don't see this option, ensure the <em>VOD Monetization</em> feature is enabled in your Studio Settings).
                        </li>
                        <li>
                            <strong>Configure Pricing:</strong>
                            <ul>
                                <li>Set a <strong>Standard Price</strong> for live attendance.</li>
                                <li>Set a <strong>Recording Price</strong> for those who only want the VOD content.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Link Content:</strong> If the course includes supplementary materials, link it to a <em>Content Collection</em> in the Media settings.
                        </li>
                        <li>
                            <strong>Publish:</strong> Once published, students will see a "Purchase Course" option on the portal.
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
