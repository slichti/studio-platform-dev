import { Outlet, useOutletContext } from "react-router";

export default function StudioStudentsLayout() {
    const context = useOutletContext();
    return <Outlet context={context} />;
}
