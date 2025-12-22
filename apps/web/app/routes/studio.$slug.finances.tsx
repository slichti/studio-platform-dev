import { useNavigate } from "react-router";

export default function StudioFinances() {
    const navigate = useNavigate();

    return (
        <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Finances</h2>
            <p className="text-zinc-600 mb-6">Financial reporting and payout settings coming soon.</p>
            <button
                onClick={() => navigate("..")}
                className="text-blue-600 hover:text-blue-800 font-medium"
            >
                &larr; Back to Dashboard
            </button>
        </div>
    );
}
