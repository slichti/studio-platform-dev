
import { Calendar, Users, Video } from "lucide-react";

export default function HelpClasses() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Creating & Managing Classes</h1>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Learn how to schedule classes, manage rosters, and handle check-ins.
                </p>
            </div>

            <div className="space-y-8">
                <div className="prose dark:prose-invert max-w-none">
                    <h3>The Schedule View</h3>
                    <p>
                        The <strong>Schedule</strong> tab is your command center. It shows a calendar view of all your upcoming classes.
                        You can view by day, week, or month.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl">
                        <Calendar className="w-8 h-8 text-blue-500 mb-4" />
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Scheduling a Class</h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Click the "New Class" button or drag on the calendar to create a session.
                            You can set recurrence rules (e.g., "Every Monday at 9am").
                        </p>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl">
                        <Users className="w-8 h-8 text-green-500 mb-4" />
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Managing Rosters</h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Click on any class to view its roster. You can manually add students,
                            cancel bookings, or check students in as they arrive.
                        </p>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl">
                        <Video className="w-8 h-8 text-purple-500 mb-4" />
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 mb-2">Virtual Classes</h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            If you enable "Virtual" for a class, a Zoom/Video link will be automatically
                            generated and emailed to registered students.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
