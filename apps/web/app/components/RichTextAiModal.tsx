import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "~/components/Modal";

interface RichTextAiModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (prompt: string) => void;
}

export function RichTextAiModal({ isOpen, onClose, onGenerate }: RichTextAiModalProps) {
    const [prompt, setPrompt] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim()) {
            await onGenerate(prompt.trim());
            setPrompt(''); // Reset for next time
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="✨ AI Email Writer">
            <div className="flex flex-col gap-4 py-2">
                <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                        What should this email be about?
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g. A warm welcome email for new beginners..."
                        className="w-full p-3 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none min-h-[100px]"
                        autoFocus
                    />
                    <p className="mt-2 text-xs text-zinc-500">
                        The AI will generate beautifully formatted HTML right into your editor. It will automatically detect context like your studio name.
                    </p>
                </div>

                <div className="flex justify-end gap-3 mt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!prompt.trim()}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Sparkles className="w-4 h-4" />
                        Generate
                    </button>
                </div>
            </div>
        </Modal>
    );
}
