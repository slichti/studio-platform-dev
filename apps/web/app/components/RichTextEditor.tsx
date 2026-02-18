
import { lazy, Suspense } from 'react';

const RichTextEditorInternal = lazy(() => import('./RichTextEditorInternal'));

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
}

export function RichTextEditor(props: RichTextEditorProps) {
    return (
        <Suspense fallback={
            <div className={`border border-zinc-200 rounded-lg bg-zinc-50/50 min-h-[200px] flex items-center justify-center animate-pulse ${props.className}`}>
                <div className="text-zinc-400 text-sm">Loading editor...</div>
            </div>
        }>
            <RichTextEditorInternal {...props} />
        </Suspense>
    );
}
