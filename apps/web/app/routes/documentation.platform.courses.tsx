export default function DocumentationPlatformCourses() {
    return (
        <article className="prose prose-zinc dark:prose-invert max-w-3xl">
            <h1>Course Management — Platform Feature Guide</h1>
            <p className="lead text-zinc-500 dark:text-zinc-400">
                Course Management is an opt-in platform feature that enables tenants to build hybrid,
                standalone course offerings combining live sessions, on-demand video, and quizzes.
            </p>

            <div className="not-prose my-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-1">Platform Admin Only</h3>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                    Course Management must be enabled at the <strong>platform level</strong> before any tenant can activate it.
                    Use the <a href="/admin/features" className="underline">Platform Features</a> toggle to control global availability.
                </p>
            </div>

            <h2>Architecture Overview</h2>
            <p>
                The Course Management system introduces two new database entities that sit above the existing class and video infrastructure:
            </p>
            <ul>
                <li><strong><code>courses</code></strong> — A standalone course entity with title, slug, pricing, and status. Links to a default <code>contentCollectionId</code> (video collection) for its on-demand curriculum.</li>
                <li><strong><code>courseEnrollments</code></strong> — Tracks a user's enrollment, progress (0–100%), and completion status per course.</li>
            </ul>
            <p>
                Individual <strong>live sessions</strong> (classes) are linked via <code>classes.courseId</code>,
                allowing a course to have multiple scheduled live events as part of its curriculum.
            </p>

            <h2>Feature Flag Hierarchy</h2>
            <p>Enablement follows a two-tier system:</p>
            <ol>
                <li>
                    <strong>Platform Level (<code>feature_course_management</code>)</strong> — Controlled via
                    <a href="/admin/features"> Admin → Platform Features</a>. When disabled globally, no tenant sidebar
                    will show the Courses link, even if their local flag is set.
                </li>
                <li>
                    <strong>Tenant Level (<code>course_management</code>)</strong> — Controlled via
                    <a href="/admin/tenants"> Admin → Tenants → [Tenant] → Features</a>.
                    Platform must be enabled first; this acts as an opt-in on a per-studio basis.
                </li>
            </ol>

            <h2>Enabling for a Tenant</h2>
            <ol>
                <li>Ensure <code>feature_course_management</code> is <strong>Enabled</strong> on the Platform Features page.</li>
                <li>Navigate to <strong>Admin → Tenants</strong> and select the target studio.</li>
                <li>Open the <strong>Features</strong> tab and toggle <strong>Course Management</strong> on.</li>
                <li>The "Courses" link will appear in the studio's sidebar immediately.</li>
            </ol>

            <h2>API Endpoints</h2>
            <table>
                <thead>
                    <tr><th>Method</th><th>Path</th><th>Description</th></tr>
                </thead>
                <tbody>
                    <tr><td>GET</td><td><code>/courses</code></td><td>List all courses for the tenant</td></tr>
                    <tr><td>POST</td><td><code>/courses</code></td><td>Create a new course</td></tr>
                    <tr><td>GET</td><td><code>/courses/:id</code></td><td>Get course details (includes live sessions + curriculum)</td></tr>
                    <tr><td>PATCH</td><td><code>/courses/:id</code></td><td>Update course details</td></tr>
                    <tr><td>DELETE</td><td><code>/courses/:id</code></td><td>Delete a course</td></tr>
                    <tr><td>POST</td><td><code>/courses/:id/enroll</code></td><td>Enroll a user in a course</td></tr>
                    <tr><td>POST</td><td><code>/courses/:id/progress</code></td><td>Update enrollment progress (0–100)</td></tr>
                </tbody>
            </table>

            <h2>Tenant-Facing UI Routes</h2>
            <ul>
                <li><code>/studio/:slug/courses</code> — Course list and creation</li>
                <li><code>/studio/:slug/courses/:id</code> — Course editor and curriculum builder</li>
            </ul>

            <h2>Billing & Tiers</h2>
            <p>
                Course Management is available on <strong>Scale</strong> tier and above.
                Platform admins can manually override this for specific tenants using the tenant-level feature flag.
            </p>
        </article>
    );
}
