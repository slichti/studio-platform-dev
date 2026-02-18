import { Outlet, useOutletContext } from "react-router";
import type { ActionFunction } from "react-router";

export const action: ActionFunction = async () => {
    return null;
};

export default function SettingsLayout() {
    const context = useOutletContext();
    return <Outlet context={context} />;
}
