import { redirect } from "react-router";

export const loader = ({ request }: any) => {
    return redirect(request.url.replace(/\/analytics\/?$/, "/analytics/financials"));
};

export default function AnalyticsIndex() {
    return null;
}
