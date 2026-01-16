import QRCode from "react-qr-code";
import { Download } from "lucide-react";
import { useRef } from "react";

interface QRCodeDisplayProps {
    value: string;
    title?: string;
    description?: string;
    size?: number;
    color?: string;
    bgColor?: string;
}

export function QRCodeDisplay({
    value,
    title,
    description,
    size = 200,
    color = "#000000",
    bgColor = "#FFFFFF"
}: QRCodeDisplayProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);

    const downloadQRCode = () => {
        if (!wrapperRef.current) return;

        const svg = wrapperRef.current.querySelector("svg");
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        // Add some padding
        const padding = 40;
        canvas.width = size + (padding * 2);
        canvas.height = size + (padding * 2);

        img.onload = () => {
            if (!ctx) return;
            // Draw white background
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw QR Code
            ctx.drawImage(img, padding, padding);

            // Trigger Download
            const pngFile = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.download = `${title || 'qrcode'}.png`;
            downloadLink.href = pngFile;
            downloadLink.click();
        };

        img.src = "data:image/svg+xml;base64," + btoa(svgData);
    };

    return (
        <div className="flex flex-col items-center p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm hover:shadow-md transition-all">
            {title && <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>}
            {description && <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6 max-w-[250px]">{description}</p>}

            <div ref={wrapperRef} className="p-4 bg-white rounded-lg border border-zinc-100 dark:border-zinc-800 mb-6">
                <QRCode
                    size={size}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    value={value}
                    viewBox={`0 0 256 256`}
                    fgColor={color}
                    bgColor={bgColor}
                />
            </div>

            <button
                onClick={downloadQRCode}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm font-medium rounded-lg transition-colors"
            >
                <Download size={16} />
                Download PNG
            </button>
        </div>
    );
}
