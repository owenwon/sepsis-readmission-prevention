"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Chevron icon for FAQ accordion
function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// FAQ data
const faqs = [
  {
    question: "Is there a free trial available?",
    answer:
      "Yes, Tillage is completely free to use. Our mission is to support sepsis survivors in their recovery journey.",
  },
  {
    question: "How does the daily check-in work?",
    answer:
      "Each day, you'll answer a short set of questions about your symptoms and vitals. Our algorithm then calculates your risk level and alerts you if anything needs attention.",
  },
  {
    question: "Is my health data secure?",
    answer:
      "Absolutely. All your data is encrypted and stored securely. We comply with HIPAA regulations and never share your personal health information.",
  },
  {
    question: "Can a caregiver use this app?",
    answer:
      "Yes! During onboarding you can choose whether you are a patient or a caregiver. The app will adjust its language and features accordingly.",
  },
  {
    question: "What should I do if I get a red alert?",
    answer:
      "If you receive a red (emergency) alert, call 911 immediately. The alert means your symptoms indicate a potentially life-threatening situation that requires emergency medical attention.",
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#fdfbf5] font-[family-name:var(--font-poppins)]">
      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden bg-[#104832] px-4 pb-0 pt-6">
        {/* Decorative leaves — positioned absolutely */}
        <div className="pointer-events-none absolute -left-8 -top-6 w-[120px] rotate-[118deg] opacity-40">
          <Image src="/images/leaf.png" alt="" width={90} height={90} />
        </div>
        <div className="pointer-events-none absolute right-4 top-[140px] w-[100px] rotate-[171deg] opacity-30">
          <Image src="/images/leaf.png" alt="" width={90} height={90} />
        </div>
        <div className="pointer-events-none absolute -left-16 top-[240px] w-[110px] rotate-[61deg] opacity-30">
          <Image src="/images/natural-food.png" alt="" width={90} height={90} />
        </div>
        <div className="pointer-events-none absolute left-[100px] -top-16 w-[110px] rotate-[55deg] -scale-y-100 opacity-30">
          <Image src="/images/natural-food.png" alt="" width={90} height={90} />
        </div>
        <div className="pointer-events-none absolute right-4 -top-4 w-[100px] rotate-[-165deg] -scale-y-100 opacity-30">
          <Image src="/images/leaf2.png" alt="" width={90} height={90} />
        </div>
        <div className="pointer-events-none absolute left-[80px] top-[50px] w-[100px] rotate-[-165deg] -scale-y-100 opacity-30">
          <Image src="/images/leaf2.png" alt="" width={90} height={90} />
        </div>
        <div className="pointer-events-none absolute right-0 top-[360px] w-[100px] rotate-[-165deg] -scale-y-100 opacity-30">
          <Image src="/images/leaf2.png" alt="" width={90} height={90} />
        </div>
        <div className="pointer-events-none absolute left-[120px] top-[410px] w-[100px] rotate-[-63deg] opacity-30">
          <Image src="/images/leaf2.png" alt="" width={90} height={90} />
        </div>

        {/* Top nav bar */}
        <nav className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/images/tillage-logo.svg"
              alt="Tillage logo"
              width={36}
              height={36}
            />
            <span className="text-2xl font-black text-white">Tillage</span>
          </div>
          <Link
            href="/signup"
            className="rounded-[9px] bg-[#fdfbf5] px-3 py-[7px] text-xs font-semibold text-black"
          >
            Create Account
          </Link>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 mt-20 max-w-[358px]">
          <h1 className="text-4xl font-semibold leading-tight text-white">
            Sepsis Recovery Starts Here.{" "}
          </h1>
          <p className="mt-3 text-lg text-white/90">
            Learn about key warning signs and detect possible recurrences early.
            Get started and assess your risk level today.{" "}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/login"
              className="flex h-[50px] w-[209px] items-center justify-center rounded-[14px] border-2 border-[#fdfbf5] text-lg font-semibold text-[#fdfbf5]"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="flex h-[50px] w-[209px] items-center justify-center rounded-[14px] bg-[#fdfbf5] text-lg font-semibold text-black"
            >
              Create Account
            </Link>
          </div>
        </div>

      </section>

      <div className="bg-[#104832]">
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="block h-[80px] w-full md:h-[120px]"
        >
          <path
            d="M0,60 C320,110 560,120 720,90 C880,60 1120,10 1440,50 L1440,120 L0,120 Z"
            fill="#fdfbf5"
          />
        </svg>
      </div>

      {/* ===== FEATURES SECTION ===== */}
      <section className="px-4 py-16">
        <h2 className="mb-6 text-3xl font-semibold text-black">
          Track. Learn. Analyze.
        </h2>

        <div className="flex flex-col gap-6">
          {/* Feature Card 1 — Daily Check-in */}
          <div className="relative h-[358px] overflow-hidden rounded-[14px] bg-[#d3ffe6] p-4 shadow-[0px_2px_6px_rgba(0,0,0,0.15)]">
            {/* Diagonal white shape — 50/50 split */}
            <div className="pointer-events-none absolute inset-0 bg-white" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }} />
            <div className="relative z-10">
              <h3 className="text-[26px] font-semibold text-black">
                Daily Check-in
              </h3>
              <p className="w-[152px] text-base text-black">
                Get a daily risk level assessment by completing a check-in to
                monitor your symptoms
              </p>
            </div>
            {/* Phone mockup */}
            <div className="absolute right-4 top-[85px] z-10 w-[185px] shadow-[0px_1.8px_5.3px_rgba(0,0,0,0.15)]">
              <div className="relative">
                <Image
                  src="/images/phone-screen-checkin.png"
                  alt="Daily check-in screen"
                  width={390}
                  height={844}
                  className="rounded-[32px]"
                />
                <Image
                  src="/images/phone-frame.png"
                  alt=""
                  width={185}
                  height={378}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          </div>

          {/* Feature Card 2 — Educational Modules */}
          <div className="relative h-[358px] overflow-hidden rounded-[14px] bg-[#dcdcdc] shadow-[0px_2px_6px_rgba(0,0,0,0.15)]">
            {/* Diagonal white shape — 50/50 split */}
            <div className="pointer-events-none absolute inset-0 bg-white" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }} />
            <div className="relative z-10 p-4">
              <h3 className="text-[26px] font-semibold text-black">
                Educational Modules
              </h3>
              <p className="w-[153px] text-base text-black">
                Go through our modules to learn more about sepsis post-discharge
                care and how to ensure a successful recovery
              </p>
            </div>
            {/* Phone mockup */}
            <div className="absolute left-[175px] top-[72px] z-10 w-[185px] shadow-[0px_1.8px_5.3px_rgba(0,0,0,0.15)]">
              <div className="relative">
                <Image
                  src="/images/phone-screen-modules.png"
                  alt="Educational modules screen"
                  width={390}
                  height={844}
                  className="rounded-[32px]"
                />
                <Image
                  src="/images/phone-frame.png"
                  alt=""
                  width={185}
                  height={378}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          </div>

          {/* Feature Card 3 — View History */}
          <div className="relative h-[358px] overflow-hidden rounded-[14px] bg-[#1d5133] shadow-[0px_2px_6px_rgba(0,0,0,0.15)]">
            {/* Diagonal white shape — 50/50 split */}
            <div className="pointer-events-none absolute inset-0 bg-white" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }} />
            <div className="relative z-10 p-4">
              <h3 className="text-[26px] font-semibold text-white">
                View History
              </h3>
              <p className="w-[138px] text-base text-white">
                View your past check-in results to analyze key trends in your
                vitals and detect possible sepsis recurrences
              </p>
            </div>
            {/* Stacked card mockups */}
            <div className="absolute right-4 top-[78px] z-10">
              <div className="relative">
                <div className="h-[207px] w-[264px] rotate-[8deg] rounded-[14px] bg-black shadow-[0px_4px_12px_rgba(0,0,0,0.15)]" />
                <div className="absolute left-0 top-4 h-[207px] w-[264px] rounded-[14px] bg-[#9b9595] shadow-[0px_4px_12px_rgba(0,0,0,0.15)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS SECTION ===== */}
      <section className="px-4 py-16">
        <h2 className="mb-6 text-3xl font-semibold text-black">
          Hear From Others
        </h2>

        <div className="flex flex-col gap-16">
          {/* Testimonial 1 */}
          <div className="max-w-[358px]">
            <p className="text-lg font-medium text-black">
              &ldquo;Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              Pellentesque scelerisque nibh libero, a posuere mi finibus
              quis.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Image
                src="/images/testimonial1.png"
                alt="Jane Doe"
                width={56}
                height={56}
                className="rounded-full"
              />
              <div>
                <p className="text-lg font-semibold text-black">Jane Doe</p>
                <p className="text-lg text-black">PeaceHealth CEO</p>
              </div>
            </div>
          </div>

          {/* Testimonial 2 */}
          <div className="max-w-[358px]">
            <p className="text-lg font-medium text-black">
              &ldquo;adipiscing elit. Pellentesque scelerisque nibh libero, a
              posuere mi finibus quis.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Image
                src="/images/testimonial2.png"
                alt="John Doe"
                width={56}
                height={56}
                className="rounded-full"
              />
              <div>
                <p className="text-lg font-semibold text-black">John Doe</p>
                <p className="text-lg text-black">PeaceHealth Doctor</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="px-4 py-16">
        <h2 className="mb-6 text-3xl font-semibold text-black">
          Frequently Asked Questions
        </h2>

        <div className="flex flex-col gap-4">
          {faqs.map((faq, i) => (
            <button
              key={i}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full cursor-pointer overflow-hidden rounded-[14px] bg-white p-4 text-left shadow-[0px_2px_6px_rgba(0,0,0,0.15)] transition-all"
            >
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-black pr-2">
                  {faq.question}
                </p>
                <ChevronDown open={openFaq === i} />
              </div>
              {openFaq === i && (
                <p className="mt-3 text-base text-gray-700">{faq.answer}</p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="px-4 py-16">
        <h2 className="text-3xl font-semibold text-black">
          Start Tracking Today
        </h2>
        <p className="mt-2 text-base text-black">
          Ready to begin your recovery journey?
        </p>
        <Link
          href="/signup"
          className="mt-2 flex h-[50px] w-full items-center justify-center rounded-[14px] bg-[#186346] text-lg font-semibold text-white"
        >
          Get Started
        </Link>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="px-4 pb-8">
        <div className="flex gap-4">
          {/* Legal column */}
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-lg font-semibold text-black">Legal</p>
            <div className="flex flex-col gap-2 text-lg text-black">
              <p>Privacy Policy</p>
              <p>Consumer Data Privacy Policy</p>
              <p>Terms &amp; Conditions</p>
              <p>Consent Settings</p>
            </div>
          </div>
          {/* Contact column */}
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-lg font-semibold text-black">Contact Us</p>
            <p className="text-lg text-black">Contact Us</p>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 flex items-center gap-1">
          <span className="text-xs text-black">&copy;</span>
          <p className="text-xs text-black">Tillage 2026</p>
        </div>
      </footer>
    </div>
  );
}
