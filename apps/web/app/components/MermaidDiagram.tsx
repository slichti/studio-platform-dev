
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Maximize2, Minimize2 } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface MermaidDiagramProps {
    chart: string;
    title?: string;
}

export function MermaidDiagram({ chart, title }: MermaidDiagramProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const { theme } = useTheme();

    useEffect(() => {
        // Map 'system' to actual preference if needed, or rely on base
        const mermaidTheme = theme === 'dark' ? 'dark' : 'neutral';

        mermaid.initialize({
            startOnLoad: false,
            // Use specific themes for better contrast
            theme: mermaidTheme,
            themeVariables: {
                fontFamily: "Inter, sans-serif",
                // Ensure good contrast for text in both modes
                primaryTextColor: theme === 'dark' ? '#f4f4f5' : '#18181b', // zinc-100 : zinc-900
                lineColor: theme === 'dark' ? '#a1a1aa' : '#52525b', // zinc-400 : zinc-600
                secondaryColor: theme === 'dark' ? '#27272a' : '#f4f4f5', // zinc-800 : zinc-100
                tertiaryColor: theme === 'dark' ? '#18181b' : '#ffffff', // zinc-900 : white
            },
            securityLevel: "loose",
        });
    }, [theme]);

    useEffect(() => {
        const renderChart = async () => {
            if (!ref.current) return;
            try {
                // Unique ID to prevent hydration clashes and caching issues
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                if (ref.current) ref.current.innerHTML = "";

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

    const Container = isExpanded
        ? ({ children }: { children: React.ReactNode }) => (
            <div className="fixed inset-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl p-8 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 text-zinc-900 dark:text-zinc-100">
                <div className="w-full max-w-7xl h-full overflow-auto flex items-center justify-center p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-2xl">
                    {children}
                </div>
            </div>
        )
        : ({ children }: { children: React.ReactNode }) => (
            <div className="w-full overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 transition-all shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700">
                {children}
            </div>
        );

    return (
        <Container>
            <div className="flex items-center justify-between mb-4 w-full">
                {title && <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-300">{title}</h3>}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
                    title={isExpanded ? "Collapse" : "Expand"}
                >
                    {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
            </div>

            {error ? (
                <div className="p-4 text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/50">
                    {error}
                </div>
            ) : (
                <div
                    ref={ref}
                    className="w-full flex justify-center text-zinc-900 dark:text-zinc-300 [&_svg]:max-w-full [&_svg]:h-auto"
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            )}
        </Container>
    );
}
