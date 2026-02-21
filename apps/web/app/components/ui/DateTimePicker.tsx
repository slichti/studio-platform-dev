import * as React from "react";
import DatePicker from "react-datepicker";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "../../lib/utils";
import "react-datepicker/dist/react-datepicker.css";

// Fix for react-datepicker default styles in dark mode and general aesthetics
const datePickerStyles = `
  .react-datepicker-wrapper {
    width: 100%;
  }
  .react-datepicker {
    font-family: inherit;
    border-radius: 0.75rem;
    border: 1px solid #e4e4e7;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    background-color: white;
  }
  .dark .react-datepicker {
    background-color: #18181b;
    border-color: #27272a;
    color: #f4f4f5;
  }
  .react-datepicker__header {
    background-color: #f4f4f5;
    border-bottom: 1px solid #e4e4e7;
    border-top-left-radius: 0.75rem;
    border-top-right-radius: 0.75rem;
    padding-top: 0.75rem;
  }
  .dark .react-datepicker__header {
    background-color: #27272a;
    border-color: #3f3f46;
  }
  .react-datepicker__current-month,
  .react-datepicker-time__header,
  .react-datepicker__day-name {
    color: #27272a;
  }
  .dark .react-datepicker__current-month,
  .dark .react-datepicker-time__header,
  .dark .react-datepicker__day-name {
    color: #e4e4e7;
  }
  .react-datepicker__day--selected,
  .react-datepicker__day--keyboard-selected,
  .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item--selected {
    background-color: #2563eb !important;
    color: white !important;
  }
  .react-datepicker__day:hover,
  .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item:hover {
    background-color: #f1f5f9 !important;
  }
  .dark .react-datepicker__day:hover,
  .dark .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item:hover {
    background-color: #27272a !important;
  }
  .react-datepicker__time-container {
    border-left: 1px solid #e4e4e7;
  }
  .dark .react-datepicker__time-container {
    border-color: #27272a;
  }
  .react-datepicker__navigation--next--with-time:not(.react-datepicker__navigation--next--with-today-button) {
    right: 95px;
  }
`;

export interface DateTimePickerProps {
    value: string; // ISO string or empty
    onChange: (date: string) => void;
    className?: string;
    placeholder?: string;
    name?: string;
}

export function DateTimePicker({ value, onChange, className, placeholder, name }: DateTimePickerProps) {
    const dateValue = value ? new Date(value) : null;

    return (
        <div className={cn("relative w-full", className)}>
            <style dangerouslySetInnerHTML={{ __html: datePickerStyles }} />
            <DatePicker
                selected={dateValue}
                onChange={(date: Date | null) => {
                    if (date) {
                        onChange(date.toISOString());
                    } else {
                        onChange("");
                    }
                }}
                showTimeSelect
                timeIntervals={5}
                timeCaption="Time"
                dateFormat="MMMM d, yyyy h:mm aa"
                placeholderText={placeholder || "Select date and time"}
                className={cn(
                    "flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 pl-10 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300",
                    className
                )}
                autoComplete="off"
            />
            {name && <input type="hidden" name={name} value={value} />}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                <CalendarIcon size={16} />
            </div>
        </div>
    );
}
