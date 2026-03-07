"use client";

import Image from "next/image";

export type GaugeLevel = "GREEN" | "YELLOW" | "RED";

const levelConfig: Record<
  GaugeLevel,
  {
    label: string;
    gaugeImage: string;
    accentColor: string;
    cardTitle: string;
    cardBody: string;
  }
> = {
  GREEN: {
    label: "No Signs\nof Infection",
    gaugeImage: "/images/gauge-green.svg",
    accentColor: "#4cc070",
    cardTitle: "Continue home monitoring",
    cardBody: "Your symptoms look stable. Keep up with your daily check-ins and reach out if anything changes.",
  },
  YELLOW: {
    label: "Concerning",
    gaugeImage: "/images/gauge-yellow.svg",
    accentColor: "#ffc800",
    cardTitle: "Contact your provider today",
    cardBody: "Some of your symptoms need attention. Call your doctor or nurse today to discuss what you're experiencing.",
  },
  RED: {
    label: "Urgent",
    gaugeImage: "/images/gauge-red.svg",
    accentColor: "#df0d3d",
    cardTitle: "Seek immediate medical attention",
    cardBody: "Your symptoms indicate a serious concern. Call your doctor or visit urgent care now.",
  },
};

export default function RiskGauge({
  level,
  onDashboard,
}: {
  level: GaugeLevel;
  onDashboard?: () => void;
}) {
  const config = levelConfig[level];

  return (
    <div className="flex w-full max-w-[430px] flex-col items-center gap-6">
      {/* ---- Gauge graphic from Figma ---- */}
      <div className="relative w-full max-w-[358px]">
        <Image
          src={config.gaugeImage}
          alt={`Risk gauge showing ${config.label}`}
          width={358}
          height={179}
          className="w-full"
          priority
        />

        {/* Risk label centred over the gauge */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-22">
          <p className="whitespace-pre-line text-center text-[26px] font-semibold leading-tight text-black">
            {config.label}
          </p>
        </div>
      </div>

      {/* ---- Recommendation ---- */}
      <div className="flex w-full flex-col gap-4 text-center">
        <p className="text-lg text-black">This is what we recommend</p>

        <div
          className="flex w-full flex-col gap-2 rounded-[14px] bg-white p-4 text-center shadow-[0px_4px_12px_rgba(0,0,0,0.15)]"
          style={{ borderLeft: `10px solid ${config.accentColor}` }}
        >
          <p className="text-xl font-semibold text-black">
            {config.cardTitle}
          </p>
          <p className="text-lg text-black">{config.cardBody}</p>
        </div>
      </div>

      {/* ---- Go to Dashboard ---- */}
      {onDashboard && (
        <button
          onClick={onDashboard}
          className="flex h-[50px] w-full cursor-pointer items-center justify-center rounded-[14px] bg-[#186346] px-6 py-[5px] text-lg font-semibold text-white"
        >
          Go to Dashboard
        </button>
      )}

      {/* ---- Disclaimer ---- */}
      <p className="text-center text-xs text-black">
        <span className="font-bold">Disclaimer</span>
        <span>
          : The information provided in this tool is for educational purposes
          only and does not substitute for professional medical advice,
          diagnoses, or treatments. We are not liable for any risks or issues
          associated with using the information in our tool.
        </span>
      </p>
    </div>
  );
}
