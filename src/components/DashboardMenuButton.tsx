"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

// ============================================================================
// Slide-in drawer menu — rendered via React portal on document.body
// so it escapes all parent stacking contexts.
// ============================================================================

function MenuDrawer({
  open,
  onClose,
  patientName,
}: {
  open: boolean;
  onClose: () => void;
  patientName?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Don't render anything server-side (portal needs document.body)
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop — full-screen fixed overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "rgba(0,0,0,0.4)",
          }}
        />
      )}

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100%",
          width: "280px",
          zIndex: 9999,
          background: "#fdfbf5",
          boxShadow: open ? "-4px 0 12px rgba(0,0,0,0.15)" : "none",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease-in-out",
          fontFamily: "var(--font-poppins)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header: title + close button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 20px 8px",
          }}
        >
          <span style={{ fontSize: "18px", fontWeight: 600, color: "#000" }}>
            Menu
          </span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              cursor: "pointer",
              background: "none",
              border: "none",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="#186346"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Greeting */}
        {patientName && (
          <div style={{ padding: "8px 20px 16px" }}>
            <p
              style={{
                fontSize: "14px",
                color: "rgba(0,0,0,0.5)",
                margin: 0,
              }}
            >
              Hi, {patientName}
            </p>
          </div>
        )}

        {/* Menu items */}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "0 12px",
            flex: 1,
          }}
        >
          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center gap-3 rounded-[10px] px-4 py-3 text-base font-medium text-black transition-colors hover:bg-[#dcf5f0]"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                stroke="#186346"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16.167 12.5a1.375 1.375 0 0 0 .275 1.517l.05.05a1.667 1.667 0 1 1-2.359 2.358l-.05-.05a1.375 1.375 0 0 0-1.516-.275 1.375 1.375 0 0 0-.834 1.258v.142a1.667 1.667 0 1 1-3.333 0v-.075a1.375 1.375 0 0 0-.9-1.258 1.375 1.375 0 0 0-1.517.275l-.05.05a1.667 1.667 0 1 1-2.358-2.359l.05-.05A1.375 1.375 0 0 0 3.9 12.567a1.375 1.375 0 0 0-1.258-.834h-.142a1.667 1.667 0 0 1 0-3.333h.075a1.375 1.375 0 0 0 1.258-.9 1.375 1.375 0 0 0-.275-1.517l-.05-.05A1.667 1.667 0 1 1 5.867 3.575l.05.05a1.375 1.375 0 0 0 1.516.275h.067a1.375 1.375 0 0 0 .833-1.258v-.142a1.667 1.667 0 0 1 3.334 0v.075a1.375 1.375 0 0 0 .833 1.258 1.375 1.375 0 0 0 1.517-.275l.05-.05a1.667 1.667 0 1 1 2.358 2.359l-.05.05a1.375 1.375 0 0 0-.275 1.516v.067a1.375 1.375 0 0 0 1.258.833h.142a1.667 1.667 0 0 1 0 3.334h-.075a1.375 1.375 0 0 0-1.258.833Z"
                stroke="#186346"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Settings
          </Link>

          {/* Divider */}
          <div
            style={{
              height: "1px",
              background: "rgba(0,0,0,0.1)",
              margin: "8px 16px",
            }}
          />

          <button
            onClick={handleSignOut}
            className="flex cursor-pointer items-center gap-3 rounded-[10px] px-4 py-3 text-base font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M7.5 17.5H4.167A1.667 1.667 0 0 1 2.5 15.833V4.167A1.667 1.667 0 0 1 4.167 2.5H7.5M13.333 14.167L17.5 10l-4.167-4.167M17.5 10H7.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Sign Out
          </button>
        </nav>
      </div>
    </>,
    document.body,
  );
}

// ============================================================================
// Dashboard Menu Button — client component wrapping the menu icon
// ============================================================================

export default function DashboardMenuButton({
  patientName,
}: {
  patientName?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setMenuOpen(true)}
        className="flex flex-col items-center justify-center cursor-pointer"
      >
        <Image
          src="/images/dashboard/menu-icon.svg"
          alt="Menu"
          width={24}
          height={24}
        />
        <span className="text-xs text-white">Menu</span>
      </button>

      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        patientName={patientName}
      />
    </>
  );
}
