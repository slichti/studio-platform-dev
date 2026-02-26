import { useEffect, useRef, useState } from "react";
// Removed top-level mermaid import to reduce server bundle size
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useTheme } from "./ThemeProvider";

const ZOOM_LEVELS = [100, 125, 150, 175, 200, 250, 300];
const DEFAULT_EXPANDED_ZOOM = 150;

interface MermaidDiagramProps {
    chart: string;
    title?: string;
}

export function MermaidDiagram({ chart, title }: MermaidDiagramProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [zoom, setZoom] = useState(DEFAULT_EXPANDED_ZOOM);
    const { theme } = useTheme();

    useEffect(() => {
        const initMermaid = async () => {
            const { default: mermaid } = await import("mermaid");
            // Map 'system' to actual preference if needed, or rely on base
            const mermaidTheme = theme === 'dark' ? 'dark' : 'neutral';

            mermaid.initialize({
                startOnLoad: false,
                // Use specific themes for better contrast
                theme: mermaidTheme,
                themeVariables: {
                    fontFamily: "Inter, sans-serif",
                    // Ensure good contrast for text in both modes
                    primaryTextColor: theme === 'dark' ? '#f4f4f5' : '#18181b',
                    lineColor: theme === 'dark' ? '#a1a1aa' : '#52525b',
                    secondaryColor: theme === 'dark' ? '#27272a' : '#f4f4f5',
                    tertiaryColor: theme === 'dark' ? '#18181b' : '#ffffff',
                    // Sequence Diagram Specifics
                    actorBkg: theme === 'dark' ? '#27272a' : '#ffffff', // Dark boxes in dark mode
                    actorBorder: theme === 'dark' ? '#52525b' : '#000000',
                    actorTextColor: theme === 'dark' ? '#f4f4f5' : '#000000',
                    signalColor: theme === 'dark' ? '#f4f4f5' : '#18181b',
                    signalTextColor: theme === 'dark' ? '#f4f4f5' : '#18181b',
                    labelBoxBkgColor: theme === 'dark' ? '#27272a' : '#f4f4f5',
                    labelBoxBorderColor: theme === 'dark' ? '#52525b' : '#000000',
                    labelTextColor: theme === 'dark' ? '#f4f4f5' : '#000000',
                    loopTextColor: theme === 'dark' ? '#f4f4f5' : '#000000',
                    noteBkgColor: theme === 'dark' ? '#fef08a' : '#fff9c4', // Keep yellow-ish but adjusted
                    noteTextColor: '#000000', // Notes usually black text
                },
                securityLevel: "loose",
            });
        };
        initMermaid();
    }, [theme]);

    useEffect(() => {
        const renderChart = async () => {
            if (!ref.current) return;
            try {
                // Unique ID to prevent hydration clashes and caching issues
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                if (ref.current) ref.current.innerHTML = "";

                const { default: mermaid } = await import("mermaid");
                const { svg } = await mermaid.render(id, chart);
                setSvg(svg);
                setError(null);
            } catch (e: any) {
                console.error("Mermaid Render Error:", e);
                // Don't show error to user immediately, try fallback or just log
                setError("Failed to render diagram");
            }
        };

        // Rerender when chart content or theme changes
        renderChart();
    }, [chart, theme]);

    const zoomIn = () => setZoom((z) => Math.min(300, (ZOOM_LEVELS.find((l) => l > z) ?? z + 25) || z + 25));
    const zoomOut = () => setZoom((z) => Math.max(50, (ZOOM_LEVELS.slice().reverse().find((l) => l < z) ?? z - 25) || z - 25));
    const resetZoom = () => setZoom(DEFAULT_EXPANDED_ZOOM);

    const Container = isExpanded
        ? ({ children }: { children: React.ReactNode }) => (
            <div
                className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200 text-zinc-900 dark:text-zinc-100"
                onClick={(e) => e.target === e.currentTarget && setIsExpanded(false)}
            >
                <div className="flex flex-col w-full max-w-6xl h-full max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                        {title && <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 tabular-nums">{zoom}%</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-40"
                                title="Zoom out"
                            >
                                <ZoomOut size={18} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); resetZoom(); }}
                                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium"
                                title="Reset zoom"
                            >
                                <RotateCcw size={18} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-40"
                                title="Zoom in"
                            >
                                <ZoomIn size={18} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 ml-2"
                                title="Close"
                            >
                                <Minimize2 size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto min-h-0 p-6 flex items-start justify-center">
                        {children}
                    </div>
                </div>
            </div>
        )
        : ({ children }: { children: React.ReactNode }) => (
            <div className="w-full overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 transition-all shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700">
                {children}
            </div>
        );

    const diagramContent = error ? (
        <div className="p-4 text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/50">
            {error}
        </div>
    ) : (
        <div
            ref={ref}
            className="w-full flex justify-center text-zinc-900 dark:text-zinc-300 [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:min-w-0"
            style={isExpanded ? { zoom: zoom / 100, display: "inline-block" } : undefined}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );

    return (
        <Container>
            <div className="flex items-center justify-between mb-4 w-full">
                {title && <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-300">{title}</h3>}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors text-xs font-medium flex items-center gap-1.5"
                    title={isExpanded ? "Close" : "Expand & zoom"}
                >
                    {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    {!isExpanded && <span>Expand</span>}
                </button>
            </div>
            {diagramContent}
        </Container>
    );
}
