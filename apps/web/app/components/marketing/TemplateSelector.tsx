
import { Check } from "lucide-react";

interface TemplateSelectorProps {
    selectedId: string;
    onSelect: (id: string) => void;
}

const TEMPLATES = [
    {
        id: 'welcome_classic',
        name: 'Classic Welcome',
        description: 'A warm welcome email for new members.',
        previewColor: 'bg-blue-500',
    },
    {
        id: 'class_reminder',
        name: 'Class Reminder',
        description: 'Friendly nudge before class starts.',
        previewColor: 'bg-emerald-500',
    },
    {
        id: 'broadcast_standard',
        name: 'Standard Broadcast',
        description: 'Clean layout for announcements.',
        previewColor: 'bg-zinc-800',
    },
    {
        id: 'receipt_simple',
        name: 'Simple Receipt',
        description: 'Minimalist transaction receipt.',
        previewColor: 'bg-zinc-200',
    },
];

export function TemplateSelector({ selectedId, onSelect }: TemplateSelectorProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map((template) => {
                const isSelected = selectedId === template.id;
                return (
                    <div
                        key={template.id}
                        onClick={() => onSelect(template.id)}
                        className={`cursor-pointer rounded-xl border-2 transition-all p-4 flex items-start gap-4 hover:border-violet-500 ${isSelected ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/20' : 'border-transparent bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    >
                        <div className={`w-12 h-12 rounded-lg shrink-0 ${template.previewColor} opacity-80`} />
                        <div className="flex-1">
                            <h4 className={`font-bold text-sm ${isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                {template.name}
                            </h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                                {template.description}
                            </p>
                        </div>
                        {isSelected && (
                            <div className="bg-violet-600 text-white p-1 rounded-full">
                                <Check size={12} strokeWidth={3} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
