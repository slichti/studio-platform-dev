import { Calendar, User, MapPin, Clock } from "lucide-react";
import { Link } from "react-router";

export default function PrivateSessionsGuide() {
    return (
        <div className="space-y-10 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
                    <Link to="/documentation" className="hover:text-zinc-900">Docs</Link>
                    <span>/</span>
                    <span className="text-zinc-900">How-to Guides</span>
                </div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">Offer Private Sessions</h1>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    End‑to‑end workflow for letting students book 1:1 appointments (e.g. Private Yoga Session)
                    from your studio portal.
                </p>
            </div>

            {/* Step 1 */}
            <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Calendar className="text-indigo-500" size={18} /> 1. Create the appointment service
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    In your studio sidebar, go to <strong>Appointments</strong>. Click <strong>New Appointment Service</strong> (or
                    edit an existing one) and define:
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                    <li><strong>Title</strong> – e.g. <em>Private yoga session</em></li>
                    <li><strong>Duration</strong> – length of the session in minutes (60 is common)</li>
                    <li><strong>Price</strong> – what the student pays per session</li>
                </ul>
            </section>

            {/* Step 2 */}
            <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <User className="text-emerald-500" size={18} /> 2. Set instructor availability
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Each instructor who takes private sessions must define their weekly windows.
                </p>
                <ol className="list-decimal list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                    <li>Open the studio and go to <strong>Profile</strong> for the instructor.</li>
                    <li>Scroll to <strong>Instructor Availability</strong>.</li>
                    <li>Add one or more slots, e.g. <em>Tuesday 5:00–8:00 PM</em>, <em>Saturday 9:00–12:00 PM</em>.</li>
                </ol>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Behind the scenes this writes to <code>/appointments/availability</code>, which the public bookings
                    screen uses to build time slots.
                </p>
            </section>

            {/* Step 3 */}
            <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Clock className="text-blue-500" size={18} /> 3. Test the booking flow
                </h2>
                <ol className="list-decimal list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                    <li>From the studio sidebar, click <strong>Appointments</strong> &rarr; <strong>Book a Session</strong>.</li>
                    <li>Select your service (e.g. <em>Private yoga session</em>).</li>
                    <li>Pick a date that matches one of the availability days you configured.</li>
                </ol>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    You should now see available time slots instead of &quot;No availability on this date.&quot;
                    Booking an appointment here will also show up on the internal Appointments calendar.
                </p>
            </section>

            {/* Step 4 */}
            <section className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 space-y-3">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide flex items-center gap-2">
                    <MapPin className="text-zinc-400" size={16} /> Quick checklist
                </h2>
                <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                    <li>☑️ At least one <strong>Appointment Service</strong> is active.</li>
                    <li>☑️ The instructor you expect to book with has weekly <strong>availability</strong> set.</li>
                    <li>☑️ You are testing from the correct studio (slug) and tenant.</li>
                </ul>
            </section>
        </div>
    );
}

