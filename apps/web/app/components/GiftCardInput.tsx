import { useState } from "react";
import { Ticket, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { apiRequest } from "~/utils/api";

interface GiftCardInputProps {
    token: string;
    slug: string;
    onApply: (card: { code: string; balance: number }) => void;
    onRemove: () => void;
}

export function GiftCardInput({ token, slug, onApply, onRemove }: GiftCardInputProps) {
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [appliedCard, setAppliedCard] = useState<any>(null);

    const handleValidate = async () => {
        if (!code) return;
        setLoading(true);
        setError(null);
        try {
            const res: any = await apiRequest(`/gift-cards/validate/${code}`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
            if (res.error) {
                setError(res.error);
            } else {
                setAppliedCard(res);
                onApply(res);
            }
        } catch (e: any) {
            setError("Invalid or expired gift card code.");
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = () => {
        setAppliedCard(null);
        setCode("");
        onRemove();
    };

    if (appliedCard) {
        return (
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl animate-in zoom-in-95">
                <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={18} />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold">{appliedCard.code}</span>
                        <span className="text-[10px] uppercase font-bold tracking-tighter opacity-70">
                            Applied: ${(appliedCard.balance / 100).toFixed(2)} Credit
                        </span>
                    </div>
                </div>
                <button onClick={handleRemove} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded text-emerald-600">
                    <XCircle size={18} />
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="relative">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                    type="text"
                    placeholder="Wanna use a Gift Card?"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full pl-10 pr-24 py-3 bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono tracking-wider"
                />
                <button
                    onClick={handleValidate}
                    disabled={loading || !code}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : "APPLY"}
                </button>
            </div>
            {error && (
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight ml-4 flex items-center gap-1">
                    <XCircle size={10} /> {error}
                </p>
            )}
        </div>
    );
}
