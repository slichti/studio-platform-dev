import { useState, useEffect, useRef } from "react";
import { Search, User, Dumbbell, ShoppingCart, Loader2, X } from "lucide-react";
// @ts-ignore
import { useNavigate, useParams } from "react-router";
import { apiRequest } from "~/utils/api";

interface CommandBarProps {
    token: string;
}

export function CommandBar({ token }: CommandBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any>({ students: [], classes: [], orders: [] });
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const { slug } = useParams<any>();
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);

    const flatResults = [
        ...results.students.map((s: any) => ({ ...s, type: 'student' })),
        ...results.classes.map((c: any) => ({ ...c, type: 'class' })),
        ...results.orders.map((o: any) => ({ ...o, type: 'order' }))
    ];

    // Keyboard Shortcut Handling
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsOpen((open) => !open);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
            if (isOpen) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev + 1) % Math.max(1, flatResults.length));
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev - 1 + flatResults.length) % Math.max(1, flatResults.length));
                }
                if (e.key === "Enter" && flatResults[selectedIndex]) {
                    e.preventDefault();
                    handleSelect(flatResults[selectedIndex].type, flatResults[selectedIndex]);
                }
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [isOpen, flatResults, selectedIndex]);

    // External Open Event Listener
    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener("open-command-bar", handleOpen);
        return () => window.removeEventListener("open-command-bar", handleOpen);
    }, []);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 10);
            setQuery("");
            setResults({ students: [], classes: [], orders: [] });
        }
    }, [isOpen]);

    // Search Logic
    useEffect(() => {
        if (!query || query.length < 2) {
            setResults({ students: [], classes: [], orders: [] });
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res: any = await apiRequest(`/tenant/search?q=${query}`, token, {
                    headers: { 'X-Tenant-Slug': slug! }
                });
                setResults(res);
                setSelectedIndex(0);
            } catch (e) {
                console.error("Search failed", e);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, slug, token]);

    const handleSelect = (type: string, item: any) => {
        setIsOpen(false);
        if (type === 'student') navigate(`/studio/${slug}/students/${item.id}`);
        if (type === 'class') navigate(`/studio/${slug}/classes/${item.id}`); // Assuming a details page exists or we go to schedule
        if (type === 'order') navigate(`/studio/${slug}/pos`); // POS history filters coming soon
    };

    if (!isOpen) return null;

    const resultsToRender = [
        ...results.students.map((s: any) => ({ ...s, type: 'student' })),
        ...results.classes.map((c: any) => ({ ...c, type: 'class' })),
        ...results.orders.map((o: any) => ({ ...o, type: 'order' }))
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 backdrop-blur-sm bg-zinc-900/50 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[60vh] animate-in zoom-in-95 duration-200">
                <div className="flex items-center px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <Search className="h-5 w-5 text-zinc-400 mr-3" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search students, classes, or orders..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 text-base"
                    />
                    <div className="flex items-center gap-2">
                        {loading && <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />}
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                            <X className="h-4 w-4 text-zinc-400" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {query.length < 2 && (
                        <div className="p-8 text-center text-zinc-500">
                            <ActivityIcon />
                            <p className="text-sm mt-2">Type at least 2 characters to search...</p>
                        </div>
                    )}

                    {query.length >= 2 && resultsToRender.length === 0 && !loading && (
                        <div className="p-8 text-center text-zinc-500">
                            <p className="text-sm">No results found for "{query}"</p>
                        </div>
                    )}

                    <div className="space-y-1">
                        {resultsToRender.map((item: any, idx: number) => (
                            <button
                                key={item.id}
                                onClick={() => handleSelect(item.type, item)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all text-left ${selectedIndex === idx
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg ${selectedIndex === idx ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                                    {item.type === 'student' && <User size={18} />}
                                    {item.type === 'class' && <Dumbbell size={18} />}
                                    {item.type === 'order' && <ShoppingCart size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate">
                                        {item.type === 'student' ? `${item.name?.firstName || 'Student'} ${item.name?.lastName || ''}` : item.title || item.name}
                                        {item.type === 'order' && `Order #${item.id.substring(0, 8)}`}
                                    </div>
                                    <div className={`text-[10px] uppercase font-bold tracking-tight opacity-70`}>
                                        {item.type} • {item.email || item.category || `$${(item.totalAmount / 100).toFixed(2)}`}
                                    </div>
                                </div>
                                <div className="text-[10px] opacity-40 font-mono">
                                    {selectedIndex === idx ? 'Enter' : ''}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><Kbd>CMD</Kbd> + <Kbd>K</Kbd> Toggle</span>
                        <span className="flex items-center gap-1.5"><Kbd>↑↓</Kbd> Navigate</span>
                        <span className="flex items-center gap-1.5"><Kbd>Enter</Kbd> Select</span>
                    </div>
                    <span>Zenflow Search Engine</span>
                </div>
            </div>
        </div>
    );
}

function Kbd({ children }: { children: React.ReactNode }) {
    return <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[9px] font-sans antialiased text-zinc-500">{children}</kbd>;
}

function ActivityIcon() {
    return (
        <div className="relative w-10 h-10 mx-auto opacity-20">
            <Search className="absolute inset-0 w-full h-full text-zinc-400" />
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-400 animate-pulse" />
        </div>
    );
}
