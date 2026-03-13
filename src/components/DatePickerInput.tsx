"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";

/**
 * Reusable date picker that replaces the native <input type="date">.
 *
 * - `value`    — current date as a "YYYY-MM-DD" string (or empty/"undefined")
 * - `onChange` — called with a "YYYY-MM-DD" string when a day is picked
 * - `max`      — optional upper bound as "YYYY-MM-DD" (e.g. today)
 * - `min`      — optional lower bound as "YYYY-MM-DD"
 */
export default function DatePickerInput({
  value,
  onChange,
  max,
  min,
}: {
  value?: string;
  onChange: (iso: string) => void;
  max?: string;
  min?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Parse value into a Date for DayPicker
  const selected = value ? new Date(value + "T00:00:00") : undefined;

  // Build disabled matchers for dates outside min/max
  const disabledMatchers: ({ before: Date } | { after: Date })[] = [];
  if (max) disabledMatchers.push({ after: new Date(max + "T00:00:00") });
  if (min) disabledMatchers.push({ before: new Date(min + "T00:00:00") });

  // Format for display
  const displayText = selected
    ? selected.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Trigger button styled like the rest of our form inputs */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-[50px] w-full cursor-pointer items-center rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-left text-lg outline-none transition-shadow focus:ring-2 focus:ring-[#186346] ${
          displayText ? "text-black" : "text-[#a0a09b]"
        }`}
      >
        {displayText || "Select a date"}

        {/* Small calendar icon on the right */}
        <svg
          className="ml-auto h-5 w-5 shrink-0 text-[#a0a09b]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
          />
        </svg>
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute left-0 z-50 mt-2 rounded-2xl bg-white p-3 shadow-[0px_4px_12px_rgba(0,0,0,0.15)]">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(day) => {
              if (day) {
                const y = day.getFullYear();
                const m = String(day.getMonth() + 1).padStart(2, "0");
                const d = String(day.getDate()).padStart(2, "0");
                onChange(`${y}-${m}-${d}`);
              }
              setOpen(false);
            }}
            defaultMonth={selected}
            disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
            captionLayout="dropdown"
            startMonth={new Date(1920, 0)}
            endMonth={max ? new Date(max + "T00:00:00") : new Date()}
          />
        </div>
      )}
    </div>
  );
}
