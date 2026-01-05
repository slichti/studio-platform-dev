import { Outlet, useOutletContext } from "react-router";

export default function DashboardClassesLayout() {
    const context = useOutletContext();
    return <Outlet context={context} />;
}
