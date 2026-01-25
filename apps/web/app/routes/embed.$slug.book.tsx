import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { BookingWidget } from "../components/BookingWidget";

export async function loader({ params, context }: LoaderFunctionArgs) {
    const { slug } = params;
    if (!slug) throw new Response("Slug required", { status: 404 });
    return { slug, apiUrl: (context as any).cloudflare?.env.API_URL || process.env.API_URL };
}

export default function EmbedBookingPage() {
    const { slug, apiUrl } = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
            <BookingWidget tenantSlug={slug} apiUrl={apiUrl} />
        </div>
    );
}
