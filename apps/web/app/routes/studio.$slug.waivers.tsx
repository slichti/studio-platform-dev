import { Outlet, useOutletContext } from "react-router";

export default function StudioWaiversLayout() {
    const context = useOutletContext();
    return <Outlet context={context} />;
}
