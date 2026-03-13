"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardReminder } from "@/lib/dashboardReminders";

const MAX_SECTION_HEIGHT = 383;
const MAX_VIEWPORT_HEIGHT = 295;
const SCROLL_STEP = 104;

type ScrollState = {
  canScroll: boolean;
  isAtTop: boolean;
  isAtBottom: boolean;
  thumbHeight: number;
  thumbOffset: number;
};

const INITIAL_SCROLL_STATE: ScrollState = {
  canScroll: false,
  isAtTop: true,
  isAtBottom: true,
  thumbHeight: 0,
  thumbOffset: 0,
};

function sameScrollState(previous: ScrollState, next: ScrollState) {
  return (
    previous.canScroll === next.canScroll &&
    previous.isAtTop === next.isAtTop &&
    previous.isAtBottom === next.isAtBottom &&
    Math.abs(previous.thumbHeight - next.thumbHeight) < 0.5 &&
    Math.abs(previous.thumbOffset - next.thumbOffset) < 0.5
  );
}

function CloseIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
    >
      <path
        d="M6 6L18 18M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScrollArrow({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className={`size-[10px] ${direction === "up" ? "rotate-180" : ""}`}
      fill="none"
    >
      <path d="M5 7.75L1.25 2.75H8.75L5 7.75Z" fill="currentColor" />
    </svg>
  );
}
function ReminderCard({ reminder }: { reminder: DashboardReminder }) {
  return (
    <div className="flex min-h-[88px] items-center gap-4 rounded-[14px] bg-[#efefef] p-4">
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-semibold leading-[1.25] text-black">
            {reminder.title}
          </p>
          <p className="mt-1 text-sm leading-[1.35] text-black/70">{reminder.body}</p>
        </div>

        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-black"
        >
          <CloseIcon className="size-6" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardRemindersSection({
  reminders,
}: {
  reminders: DashboardReminder[];
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState(INITIAL_SCROLL_STATE);

  useEffect(() => {
    const updateScrollState = () => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const { clientHeight, scrollHeight, scrollTop } = viewport;
      const canScroll = scrollHeight > clientHeight + 1;

      if (!canScroll) {
        setScrollState((previous) =>
          sameScrollState(previous, INITIAL_SCROLL_STATE)
            ? previous
            : INITIAL_SCROLL_STATE,
        );
        return;
      }

      const maxScrollTop = Math.max(scrollHeight - clientHeight, 1);
      const trackHeight = Math.max(clientHeight - 28, 0);
      const thumbHeight = Math.max(72, (clientHeight / scrollHeight) * trackHeight);
      const thumbOffset =
        (scrollTop / maxScrollTop) * Math.max(trackHeight - thumbHeight, 0);

      const nextScrollState: ScrollState = {
        canScroll: true,
        isAtTop: scrollTop <= 1,
        isAtBottom: scrollTop >= maxScrollTop - 1,
        thumbHeight,
        thumbOffset,
      };

      setScrollState((previous) =>
        sameScrollState(previous, nextScrollState) ? previous : nextScrollState,
      );
    };

    const viewport = viewportRef.current;
    const content = contentRef.current;

    if (!viewport) {
      return;
    }

    updateScrollState();

    viewport.addEventListener("scroll", updateScrollState, { passive: true });

    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(viewport);

      if (content) {
        resizeObserver.observe(content);
      }
    }

    return () => {
      viewport.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, []);

  const scrollByStep = (direction: -1 | 1) => {
    viewportRef.current?.scrollBy({
      top: direction * SCROLL_STEP,
      behavior: "smooth",
    });
  };

  return (
    <>
      <section
        className="w-full overflow-hidden rounded-[14px] bg-white pb-4 pl-4 pr-2 pt-4 shadow-[0px_4px_12px_rgba(0,0,0,0.15)]"
        style={{ maxHeight: `${MAX_SECTION_HEIGHT}px` }}
      >
        <div className="mb-4 flex items-center justify-between pr-2">
          <h2 className="text-[26px] font-semibold leading-none text-black">
            Reminders
          </h2>

          <div
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-[#efefef] text-black"
          >
            <CloseIcon />
          </div>
        </div>

        <div className="flex items-start gap-1">
          <div
            ref={viewportRef}
            className="hide-scrollbar flex-1 overflow-y-auto pr-2"
            style={{
              maxHeight: `${MAX_VIEWPORT_HEIGHT}px`,
              scrollbarWidth: "none",
            }}
          >
            <div ref={contentRef} className="flex flex-col gap-4">
              {reminders.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              ))}
            </div>
          </div>

          {scrollState.canScroll ? (
            <div className="flex h-[295px] shrink-0 flex-col items-center justify-between py-[2px] pr-[2px] text-[#919191]">
              <button
                type="button"
                onClick={() => scrollByStep(-1)}
                aria-label="Scroll reminders up"
                disabled={scrollState.isAtTop}
                className="flex size-5 cursor-pointer items-center justify-center disabled:cursor-default disabled:opacity-40"
              >
                <ScrollArrow direction="up" />
              </button>

              <div className="relative my-1 flex-1 w-[10px]">
                <div
                  className="absolute left-0 top-0 w-full rounded-full bg-[#8b8b8b]"
                  style={{
                    height: `${scrollState.thumbHeight}px`,
                    transform: `translateY(${scrollState.thumbOffset}px)`,
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => scrollByStep(1)}
                aria-label="Scroll reminders down"
                disabled={scrollState.isAtBottom}
                className="flex size-5 cursor-pointer items-center justify-center disabled:cursor-default disabled:opacity-40"
              >
                <ScrollArrow direction="down" />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}