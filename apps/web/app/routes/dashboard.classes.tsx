import { json, LoaderFunction, ActionFunction } from "@remix-run/cloudflare";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { getAuth } from "@clerk/remix/ssr.server";
import { apiRequest } from "../utils/api";

type ClassItem = {
    id: string;
    title: string;
    startTime: string;
    zoomMeetingUrl?: string; // Optional
};

export const loader: LoaderFunction = async (args) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const classes = await apiRequest("/classes", token);
    return json({ classes });
};

export const action: ActionFunction = async (args) => {
    const { request } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();

    const title = formData.get("title");
    const startTime = formData.get("startTime");
    const duration = formData.get("duration");
    const createZoom = formData.get("createZoom") === "on";

    try {
        await apiRequest("/classes", token, {
            method: "POST",
            body: JSON.stringify({
                title,
                description: "Class created via Dashboard",
                startTime,
                durationMinutes: Number(duration),
                capacity: 20, // Default
                createZoomMeeting: createZoom
            })
        });
        return json({ success: true });
    } catch (e: any) {
        return json({ error: e.message }, { status: 500 });
    }
};

export default function ClassesRoute() {
    const { classes } = useLoaderData<{ classes: ClassItem[] }>();
    const actionData = useActionData();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Classes</h2>
            </div>

            {/* Create Class Form (Simple inline for now) */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e4e4e7', marginBottom: '40px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'semibold', marginBottom: '15px' }}>Create New Class</h3>
                <Form method="post" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '20px', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '5px' }}>Title</label>
                        <input name="title" required type="text" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d4d4d8' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '5px' }}>Start Time</label>
                        <input name="startTime" required type="datetime-local" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d4d4d8' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '5px' }}>Duration (min)</label>
                        <input name="duration" required type="number" defaultValue="60" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d4d4d8' }} />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                            <input name="createZoom" type="checkbox" />
                            Auto-create Zoom?
                        </label>
                    </div>

                    <button disabled={isSubmitting} type="submit" style={{ padding: '10px 20px', background: '#18181b', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                        {isSubmitting ? 'Creating...' : 'Create Class'}
                    </button>
                </Form>
                {actionData?.error && <p style={{ color: 'red', marginTop: '10px' }}>{actionData.error}</p>}
            </div>

            {/* Classes List */}
            <div style={{ display: 'grid', gap: '15px' }}>
                {classes.map((cls) => (
                    <div key={cls.id} style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h4 style={{ fontWeight: 'bold' }}>{cls.title}</h4>
                            <p style={{ color: '#71717a', fontSize: '0.875rem' }}>{new Date(cls.startTime).toLocaleString()}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            {cls.zoomMeetingUrl && (
                                <a href={cls.zoomMeetingUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.875rem', color: '#2563eb' }}>
                                    Zoom Link
                                </a>
                            )}
                            <a href={`/dashboard/classes/${cls.id}/roster`} style={{ fontSize: '0.875rem', textDecoration: 'underline' }}>View Roster</a>
                        </div>
                    </div>
                ))}
                {classes.length === 0 && <p style={{ color: '#71717a' }}>No classes found.</p>}
            </div>
        </div>
    );
}
