import { json, LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";

export const loader = async (args: LoaderFunctionArgs) => {
    console.log("DEBUG: test-auth starting");
    try {
        const { userId } = await getAuth(args);
        console.log("DEBUG: test-auth success", userId);
        return json({ message: "Auth Works", userId });
    } catch (e: any) {
        console.error("DEBUG: test-auth crash", e);
        return json({ error: e.message }, { status: 500 });
    }
};

export default function TestAuth() {
    return <h1>Test Auth Route</h1>;
}
