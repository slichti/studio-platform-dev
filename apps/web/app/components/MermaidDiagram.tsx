
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Maximize2, Minimize2 } from "lucide-react";

mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    fontFamily: "Inter, sans-serif"
});

interface MermaidDiagramProps {
    chart: string;
    title?: string;
}

export function MermaidDiagram({ chart, title }: MermaidDiagramProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const renderChart = async () => {
            if (!ref.current) return;
            try {
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                const { svg } = await mermaid.render(id, chart);
                setSvg(svg);
                setError(null);
            } catch (e: any) {
                console.error("Mermaid Render Error:", e);
                setError("Failed to render diagram");
            }
        };

        renderChart();
    }, [chart]);

    const Container = isExpanded
        ? ({ children }: { children: React.ReactNode }) => (
            <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl p-8 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200">
                <div className="w-full max-w-7xl h-full overflow-auto flex items-center justify-center p-4 border border-zinc-800 rounded-xl bg-zinc-900/50">
                    {children}
                </div>
            </div>
        )
        : ({ children }: { children: React.ReactNode }) => (
            <div className="w-full overflow-hidden bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900">
                {children}
            </div>
        );

    return (
        <Container>
            <div className="flex items-center justify-between mb-4 w-full">
                {title && <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                    title={isExpanded ? "Collapse" : "Expand"}
                >
                    {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
            </div>

            {error ? (
                <div className="p-4 text-red-400 text-sm bg-red-950/20 rounded-lg border border-red-900/50">
                    {error}
                </div>
            ) : (
                <div
                    ref={ref}
                    className="w-full flex justify-center text-zinc-300 [&_svg]:max-w-full [&_svg]:h-auto"
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            )}
        </Container>
    );
}
