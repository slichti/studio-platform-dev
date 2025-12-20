import { useClerk } from "@clerk/react-router";
import { useNavigate } from "react-router";

export function LogoutButton({ className }: { className?: string }) {
    const { signOut } = useClerk();
    const navigate = useNavigate();

    const handleLogout = async () => {
        // Clear custom impersonation token
        if (typeof window !== "undefined") {
            localStorage.removeItem("impersonation_token");
        }

        // Sign out from Clerk
        await signOut();

        // Redirect to home
        navigate("/");
    };

    return (
        <button
            onClick={handleLogout}
            className={`px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors ${className}`}
        >
            Sign Out
        </button>
    );
}
