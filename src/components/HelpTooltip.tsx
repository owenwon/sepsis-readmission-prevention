"use client";

import { useState, useEffect, useRef } from "react";
import { useCaregiver } from "@/lib/CaregiverContext";

/**
 * HelpTooltip — green ⓘ icon that toggles a floating tooltip popup.
 *
 * Usage:
 *   <HelpTooltip helpText="Patient-facing help" caregiverHelpText="Caregiver-facing help" />
 *
 * Reads `isCaregiver` from CaregiverContext to choose which string to display.
 * Renders nothing when there is no applicable helpText.
 */
export default function HelpTooltip({
  helpText,
  caregiverHelpText,
}: {
  helpText?: string;
  caregiverHelpText?: string;
}) {
  const { isCaregiver } = useCaregiver();
  const text = isCaregiver ? (caregiverHelpText ?? helpText) : helpText;

  const [open, setOpen] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const iconRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  // Compute fixed position when tooltip opens
  useEffect(() => {
    if (!open || !iconRef.current) return;

    const rect = iconRef.current.getBoundingClientRect();
    const TOOLTIP_MAX_W = 260;
    const EDGE_MARGIN = 16;

    let left = rect.left;
    if (left + TOOLTIP_MAX_W > window.innerWidth - EDGE_MARGIN) {
      left = window.innerWidth - TOOLTIP_MAX_W - EDGE_MARGIN;
    }
    if (left < EDGE_MARGIN) {
      left = EDGE_MARGIN;
    }

    setTooltipPos({ top: rect.bottom + 6, left });
  }, [open]);

  // Close on outside click / touch
  useEffect(() => {
    if (!open) return;

    function handleOutside(e: MouseEvent | TouchEvent) {
      if (
        iconRef.current?.contains(e.target as Node) ||
        tooltipRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [open]);

  if (!text) return null;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}>
      {/* ⓘ icon button */}
      <button
        ref={iconRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="More info"
        className="ml-1.5 cursor-pointer"
        style={{ lineHeight: 0 }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7.5" stroke="#186346" strokeWidth="1.2" />
          <text
            x="8"
            y="12"
            textAnchor="middle"
            fontSize="10"
            fontFamily="inherit"
            fill="#186346"
            fontWeight="600"
          >
            i
          </text>
        </svg>
      </button>

      {/* Floating tooltip — position: fixed to escape overflow: hidden ancestors */}
      {open && (
        <span
          ref={tooltipRef}
          style={{
            position: "fixed",
            zIndex: 200,
            top: tooltipPos.top,
            left: tooltipPos.left,
            maxWidth: "min(260px, calc(100vw - 32px))",
            width: "max-content",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            padding: "10px 14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          }}
          className="text-sm leading-relaxed text-black/70"
        >
          {text}
        </span>
      )}
    </span>
  );
}
