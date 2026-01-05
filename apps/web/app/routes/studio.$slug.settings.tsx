import { Outlet, useOutletContext } from "react-router";

export default function SettingsLayout() {
    const context = useOutletContext();
    return <Outlet context={context} />;
}
