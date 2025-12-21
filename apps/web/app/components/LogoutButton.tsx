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
            title="Sign Out"
            className={`flex items-center justify-center p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 ${className}`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
    );
}
