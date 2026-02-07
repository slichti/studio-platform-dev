import { redirect } from "react-router";

export const loader = ({ request }: any) => {
    // Redirect old /reports to new /analytics/financials
    // Preserve sub-paths if possible?
    // /reports -> /analytics/financials
    // /reports/custom -> /analytics/custom
    const url = new URL(request.url);
    if (url.pathname.includes('/custom')) {
        return redirect(url.pathname.replace('/reports/custom', '/analytics/custom'));
    }
    return redirect(url.pathname.replace(/\/reports\/?$/, "/analytics/financials"));
};

export default function ReportsRedirect() {
    return null;
}
