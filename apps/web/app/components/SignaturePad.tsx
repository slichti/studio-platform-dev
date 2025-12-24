import { useRef, useEffect, useState } from 'react';

interface SignaturePadProps {
    onChange: (dataUrl: string | null) => void;
    width?: number;
    height?: number;
}

export function SignaturePad({ onChange, width = 500, height = 200 }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';

        // Clear wrapper
        const clear = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasSignature(false);
            onChange(null);
        };

        // Expose clear handle? For now, we just rely on parent remounting or add a clear button inside.
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            // Rough check for empty canvas could go here, but relying on interaction is okay
            const data = canvas.toDataURL();
            onChange(data);
            setHasSignature(true);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate position
        const rect = canvas.getBoundingClientRect();
        let x, y;

        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = (e as React.MouseEvent).clientX - rect.left;
            y = (e as React.MouseEvent).clientY - rect.top;
        }

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    // Simple Clear function
    const clear = (e: React.MouseEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
        onChange(null);
    }

    return (
        <div className="border border-zinc-300 rounded-lg overflow-hidden bg-white inline-block">
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="touch-none cursor-crosshair bg-white"
                onMouseDown={handleMouseDown}
                onMouseMove={(e) => {
                    if (!isDrawing) return;
                    draw(e);
                }}
                onMouseUp={() => {
                    setIsDrawing(false);
                    const canvas = canvasRef.current;
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        ctx?.beginPath(); // reset path
                        onChange(canvas.toDataURL());
                        setHasSignature(true);
                    }
                }}
                onMouseLeave={() => {
                    setIsDrawing(false);
                    const canvas = canvasRef.current;
                    if (canvas && isDrawing) { // Only save if we were drawing
                        const ctx = canvas.getContext('2d');
                        ctx?.beginPath();
                        onChange(canvas.toDataURL());
                        setHasSignature(true);
                    }
                }}
                onTouchStart={(e) => {
                    // Prevent scrolling
                    // e.preventDefault(); // Might block scrolling page? usually touch-action: none css handles it
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;

                    const rect = canvas.getBoundingClientRect();
                    const x = e.touches[0].clientX - rect.left;
                    const y = e.touches[0].clientY - rect.top;

                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    setIsDrawing(true);
                }}
                onTouchMove={(e) => {
                    // e.preventDefault(); 
                    if (!isDrawing) return;
                    draw(e);
                }}
                onTouchEnd={() => {
                    setIsDrawing(false);
                    const canvas = canvasRef.current;
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        ctx?.beginPath();
                        onChange(canvas.toDataURL());
                        setHasSignature(true);
                    }
                }}
            />
            <div className="bg-zinc-50 border-t border-zinc-200 p-2 flex justify-between items-center px-4">
                <span className="text-xs text-zinc-500">Sign above</span>
                <button
                    type="button"
                    onClick={clear}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                    Clear Signature
                </button>
            </div>
        </div>
    );
}
