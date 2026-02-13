import { useEffect, useState } from 'react';

interface ConfettiProps {
    trigger: boolean;
    onComplete?: () => void;
}

export function Confetti({ trigger, onComplete }: ConfettiProps) {
    const [pieces, setPieces] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

    useEffect(() => {
        if (!trigger) return;

        const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
        const newPieces = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 0.5,
            color: colors[Math.floor(Math.random() * colors.length)],
        }));

        setPieces(newPieces);

        const timer = setTimeout(() => {
            setPieces([]);
            onComplete?.();
        }, 3000);

        return () => clearTimeout(timer);
    }, [trigger, onComplete]);

    if (pieces.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {pieces.map((piece) => (
                <div
                    key={piece.id}
                    className="absolute w-2 h-2 animate-confetti"
                    style={{
                        left: `${piece.left}%`,
                        top: '-10px',
                        backgroundColor: piece.color,
                        animationDelay: `${piece.delay}s`,
                    }}
                />
            ))}
        </div>
    );
}
