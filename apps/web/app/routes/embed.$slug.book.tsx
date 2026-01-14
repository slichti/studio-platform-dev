import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { BookingWidget } from "../components/BookingWidget";

export async function loader({ params }: LoaderFunctionArgs) {
    const { slug } = params;
    if (!slug) throw new Response("Slug required", { status: 404 });
    return { slug };
}

export default function EmbedBookingPage() {
    const { slug } = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
            <BookingWidget tenantSlug={slug} />
        </div>
    );
}
