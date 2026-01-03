
import { type LoaderFunctionArgs, redirect } from "react-router";

// Redirect /studio/:slug/dashboard -> /studio/:slug
export const loader = async ({ params }: LoaderFunctionArgs) => {
    return redirect(`/studio/${params.slug}`);
};

export default function RedirectToStudioDashboard() {
    return null;
}
