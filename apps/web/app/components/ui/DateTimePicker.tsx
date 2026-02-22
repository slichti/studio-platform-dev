import * as React from "react";
import DatePicker from "react-datepicker";
import { Calendar as CalendarIcon, Clock, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import "react-datepicker/dist/react-datepicker.css";

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
    display: flex;
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
  .react-datepicker__day-name {
    color: #27272a;
  }
  .dark .react-datepicker__current-month,
  .dark .react-datepicker__day-name {
    color: #e4e4e7;
  }
  .react-datepicker__day--selected,
  .react-datepicker__day--keyboard-selected {
    background-color: #2563eb !important;
    color: white !important;
  }
  .react-datepicker__day:hover {
    background-color: #f1f5f9 !important;
  }
  .dark .react-datepicker__day:hover {
    background-color: #27272a !important;
  }
  /* Remove react-datepicker's fixed-width padding on the children slot */
  .react-datepicker__children-container {
    width: auto !important;
    padding: 0 !important;
  }
`;

export interface DateTimePickerProps {
  value: string; // ISO string or empty
  onChange: (date: string) => void;
  className?: string;
  placeholder?: string;
  name?: string;
}

const TimeColumn = ({
  label,
  value,
  options,
  onChange
}: {
  label: string,
  value: string | number,
  options: (string | number)[],
  onChange: (val: any) => void
}) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase font-bold text-zinc-400 mb-1">{label}</span>
      <div className="flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden h-[180px] w-10 overflow-y-auto scrollbar-none">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "py-1.5 text-xs transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800",
              value === opt ? "bg-blue-600 text-white hover:bg-blue-700" : "text-zinc-600 dark:text-zinc-400"
            )}
          >
            {typeof opt === 'number' ? String(opt).padStart(2, '0') : opt}
          </button>
        ))}
      </div>
    </div>
  );
};

export function DateTimePicker({ value, onChange, className, placeholder, name }: DateTimePickerProps) {
  const dateValue = value ? new Date(value) : new Date();

  const handleDateChange = (date: Date | null) => {
    if (!date) {
      onChange("");
      return;
    }
    // Preserve current time if date changes
    const current = value ? new Date(value) : new Date();
    date.setHours(current.getHours());
    date.setMinutes(current.getMinutes());
    date.setSeconds(0);
    date.setMilliseconds(0);
    onChange(date.toISOString());
  };

  const handleTimeChange = (type: 'hour' | 'minute' | 'ampm', val: any) => {
    const d = value ? new Date(value) : new Date();
    let hours = d.getHours();
    let minutes = d.getMinutes();

    if (type === 'hour') {
      const isPM = hours >= 12;
      hours = val === 12 ? (isPM ? 12 : 0) : (isPM ? val + 12 : val);
    } else if (type === 'minute') {
      minutes = val;
    } else if (type === 'ampm') {
      const currentHour12 = hours % 12 || 12;
      hours = val === 'PM' ? (currentHour12 === 12 ? 12 : currentHour12 + 12) : (currentHour12 === 12 ? 0 : currentHour12);
    }

    d.setHours(hours);
    d.setMinutes(minutes);
    d.setSeconds(0);
    d.setMilliseconds(0);
    onChange(d.toISOString());
  };

  const hour12 = dateValue.getHours() % 12 || 12;
  const minutes = Math.floor(dateValue.getMinutes() / 5) * 5;
  const ampm = dateValue.getHours() >= 12 ? 'PM' : 'AM';

  const hoursOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutesOptions = Array.from({ length: 12 }, (_, i) => i * 5);
  const ampmOptions = ['AM', 'PM'];

  return (
    <div className={cn("relative w-full", className)}>
      <style dangerouslySetInnerHTML={{ __html: datePickerStyles }} />
      <DatePicker
        selected={value ? dateValue : null}
        onChange={handleDateChange}
        dateFormat="MMMM d, yyyy h:mm aa"
        placeholderText={placeholder || "Select date and time"}
        className={cn(
          "flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 pl-10 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300",
          className
        )}
        autoComplete="off"
        popperProps={{ strategy: "fixed" }}
      >
        <div className="p-2 border-l border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex gap-1">
          <TimeColumn
            label="Hrs"
            value={hour12}
            options={hoursOptions}
            onChange={(v) => handleTimeChange('hour', v)}
          />
          <TimeColumn
            label="Min"
            value={minutes}
            options={minutesOptions}
            onChange={(v) => handleTimeChange('minute', v)}
          />
          <TimeColumn
            label="AM/PM"
            value={ampm}
            options={ampmOptions}
            onChange={(v) => handleTimeChange('ampm', v)}
          />
        </div>
      </DatePicker>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
        <CalendarIcon size={16} />
      </div>
    </div>
  );
}
