import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    if (!url.pathname.endsWith('/export')) {
        return redirect(`${url.pathname}/export`);
    }
    return null;
};

export default function DataIndex() {
    return null;
}
