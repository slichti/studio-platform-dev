import React, { useState } from 'react';
import {
    Mail,
    Clock,
    Filter,
    Tag,
    CheckSquare,
    AlertCircle,
    Plus,
    X,
    ChevronRight,
    ChevronDown,
    Trash2,
    Copy,
    Zap
} from 'lucide-react';
import { Button } from '../ui/Button'; // Assuming existing button component
import { cn } from '~/utils/cn'; // Assuming usual cn utility

export type StepType = 'email' | 'delay' | 'condition' | 'tag_member' | 'create_task' | 'internal_alert';

export interface AutomationStep {
    type: StepType;
    id?: string;
    name?: string;
    // Step specific content
    subject?: string;
    content?: string;
    delayHours?: number;
    tagName?: string;
    action?: 'add' | 'remove';
    priority?: 'low' | 'medium' | 'high';
    // Branching logic
    condition?: any;
    trueIndex?: number;
    falseIndex?: number;
    [key: string]: any;
}

interface AutomationCanvasProps {
    steps: AutomationStep[];
    onChange: (steps: AutomationStep[]) => void;
    triggerEvent: string;
}

export const AutomationCanvas: React.FC<AutomationCanvasProps> = ({ steps, onChange, triggerEvent }) => {
    const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);

    const addStep = (index: number) => {
        const newStep: AutomationStep = { type: 'email', subject: 'New Email', content: '' };
        const newSteps = [...steps];
        newSteps.splice(index, 0, newStep);
        onChange(newSteps);
        setSelectedStepIndex(index);
    };

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);
        onChange(newSteps);
        if (selectedStepIndex === index) setSelectedStepIndex(null);
    };

    const updateStep = (index: number, updates: Partial<AutomationStep>) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], ...updates };
        onChange(newSteps);
    };

    const renderNode = (step: AutomationStep, index: number) => {
        const Icon = {
            email: Mail,
            delay: Clock,
            condition: Filter,
            tag_member: Tag,
            create_task: CheckSquare,
            internal_alert: AlertCircle
        }[step.type] || Zap;

        const isSelected = selectedStepIndex === index;

        return (
            <div key={index} className="flex flex-col items-center">
                {/* Connector Line */}
                {index > 0 && <div className="h-8 w-px bg-slate-300 dark:bg-slate-700" />}

                {/* Node */}
                <div
                    onClick={() => setSelectedStepIndex(index)}
                    className={cn(
                        "group relative flex items-center gap-4 w-72 p-4 rounded-xl border transition-all cursor-pointer",
                        isSelected
                            ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-500"
                            : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm dark:bg-slate-900 dark:border-slate-800"
                    )}
                >
                    <div className={cn(
                        "flex items-center justify-center h-10 w-10 rounded-lg",
                        isSelected ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                        <Icon size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {step.name || step.type.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {step.type === 'email' ? step.subject : (step.type === 'delay' ? `${step.delayHours}h delay` : 'Configuring...')}
                        </p>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removeStep(index);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 transition-opacity"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                {/* Add Step Button */}
                <div className="relative group/add h-8 w-full flex justify-center items-center">
                    <button
                        onClick={() => addStep(index + 1)}
                        className="opacity-0 group-hover/add:opacity-100 absolute z-10 flex items-center justify-center h-6 w-6 rounded-full bg-indigo-500 text-white shadow-lg transform hover:scale-110 transition-all"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Main Canvas Area */}
            <div className="flex-1 overflow-auto p-12 flex flex-col items-center">
                {/* Trigger Section */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex flex-col items-center gap-2 p-6 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 w-80">
                        <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                            <Zap size={24} fill="currentColor" />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">Trigger</h3>
                        <p className="text-sm text-center text-slate-500 uppercase tracking-wider font-semibold">
                            {triggerEvent.replace('_', ' ')}
                        </p>
                    </div>
                    <div className="h-8 w-px bg-slate-300 dark:bg-slate-700" />
                    <button
                        onClick={() => addStep(0)}
                        className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-500 text-white shadow-lg hover:scale-110 transition-transform"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {/* Steps List */}
                <div className="flex flex-col items-center">
                    {steps.map((step, idx) => renderNode(step, idx))}

                    {/* End Point */}
                    {steps.length > 0 && (
                        <div className="flex flex-col items-center">
                            <div className="h-8 w-px bg-slate-300 dark:bg-slate-700" />
                            <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-700" />
                            <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">End</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Property Editor Sidebar */}
            <div className="w-96 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 overflow-auto">
                {selectedStepIndex !== null ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">Edit Step</h2>
                            <button
                                onClick={() => setSelectedStepIndex(null)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Action Type</label>
                                <select
                                    value={steps[selectedStepIndex].type}
                                    onChange={(e) => updateStep(selectedStepIndex, { type: e.target.value as StepType })}
                                    className="w-full rounded-lg border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-2"
                                >
                                    <option value="email">Email Student</option>
                                    <option value="delay">Wait / Delay</option>
                                    <option value="tag_member">Tag Member</option>
                                    <option value="create_task">Create Staff Task</option>
                                    <option value="internal_alert">Internal Alert (Owner)</option>
                                    <option value="condition">Logical Branch (If/Else)</option>
                                </select>
                            </div>

                            {steps[selectedStepIndex].type === 'email' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">Subject</label>
                                        <input
                                            type="text"
                                            value={steps[selectedStepIndex].subject || ''}
                                            onChange={(e) => updateStep(selectedStepIndex, { subject: e.target.value })}
                                            className="w-full rounded-lg border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-2"
                                            placeholder="Email subject..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">Body Content</label>
                                        <textarea
                                            value={steps[selectedStepIndex].content || ''}
                                            onChange={(e) => updateStep(selectedStepIndex, { content: e.target.value })}
                                            rows={8}
                                            className="w-full rounded-lg border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-2 text-sm"
                                            placeholder="Hi {{first_name}}, ..."
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">Variables: {"{{first_name}}"}{", "}{"{{email}}"}{", "}{"{{studioName}}"}</p>
                                    </div>
                                </div>
                            )}

                            {steps[selectedStepIndex].type === 'delay' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1.5">Wait Duration (Hours)</label>
                                    <input
                                        type="number"
                                        value={steps[selectedStepIndex].delayHours || 24}
                                        onChange={(e) => updateStep(selectedStepIndex, { delayHours: parseInt(e.target.value) })}
                                        className="w-full rounded-lg border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-2"
                                    />
                                </div>
                            )}

                            {steps[selectedStepIndex].type === 'tag_member' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">Action</label>
                                        <select
                                            value={steps[selectedStepIndex].action || 'add'}
                                            onChange={(e) => updateStep(selectedStepIndex, { action: e.target.value as any })}
                                            className="w-full rounded-lg border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-2"
                                        >
                                            <option value="add">Add Tag</option>
                                            <option value="remove">Remove Tag</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">Tag Name</label>
                                        <input
                                            type="text"
                                            value={steps[selectedStepIndex].tagName || ''}
                                            onChange={(e) => updateStep(selectedStepIndex, { tagName: e.target.value })}
                                            className="w-full rounded-lg border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-2"
                                            placeholder="e.g. vip, churn-risk"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                        <div className="h-16 w-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700">
                            <ChevronRight size={24} />
                        </div>
                        <p className="font-medium">Select a node to edit its properties</p>
                        <p className="text-xs mt-2 px-6">Build your automation by adding and configuring steps on the main canvas.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
