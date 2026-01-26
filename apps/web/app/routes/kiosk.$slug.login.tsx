
import { useState } from "react";
import { useOutletContext, useNavigate, useParams } from "react-router";
import { Lock, ArrowRight, Delete } from "lucide-react";
import { toast } from "sonner";

export default function KioskLogin() {
    const { tenant, brandColor } = useOutletContext<any>();
    const navigate = useNavigate();
    const params = useParams();
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);

    const handleNum = (num: number) => {
        if (pin.length < 6) setPin(prev => prev + num);
    };

    const handleDel = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleSubmit = async () => {
        if (pin.length < 4) return;
        setLoading(true);

        try {
            const API_URL = (window as any).ENV.API_URL;
            const res = await fetch(`${API_URL}/kiosk/auth`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantSlug: params.slug, pin })
            });
            const data = await res.json() as { error?: string, token?: string };

            if (data.error) throw new Error(data.error);

            // Store Token
            if (data.token) {
                localStorage.setItem(`kiosk_token_${params.slug}`, data.token);
            }
            toast.success("Kiosk Unlocked");
            navigate(`/kiosk/${params.slug}/mode`);
        } catch (e: any) {
            toast.error(e.message || "Invalid PIN");
            setPin(""); // Reset on failure
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Unlock Kiosk</h1>
                    <p className="text-zinc-500">Enter the 4-6 digit Kiosk PIN</p>
                </div>

                {/* PIN Display */}
                <div className="flex justify-center gap-4 mb-8">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full transition-all ${i < pin.length
                                ? `bg-purple-600 scale-110`
                                : 'bg-zinc-200 dark:bg-zinc-800'
                                }`}
                        />
                    ))}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-4 max-w-64 mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                            key={num}
                            onClick={() => handleNum(num)}
                            className="bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 hover:border-purple-500/50 hover:bg-purple-50 dark:hover:bg-purple-900/10 active:scale-95 transition-all w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold font-mono"
                        >
                            {num}
                        </button>
                    ))}
                    <div /> {/* Spacer */}
                    <button
                        onClick={() => handleNum(0)}
                        className="bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 hover:border-purple-500/50 hover:bg-purple-50 active:scale-95 transition-all w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold font-mono"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDel}
                        className="text-zinc-400 hover:text-red-500 active:scale-95 transition-all w-16 h-16 flex items-center justify-center"
                    >
                        <Delete className="h-6 w-6" />
                    </button>
                </div>

                <div className="mt-8">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || pin.length < 4}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold h-12 rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                        {loading ? 'Unlocking...' : (
                            <>
                                Unlock <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
