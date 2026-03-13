import type { RiskLevel } from "@/types/database";

export type PreCheckinNotificationId =
  | "P1"
  | "P2"
  | "P3"
  | "P4"
  | "P5"
  | "P6"
  | "P7"
  | "P8"
  | "P9"
  | "P10";

export interface PreCheckinNotification {
  id: PreCheckinNotificationId;
  title: string;
  body: string;
  blocksCheckin: boolean;
}

type Checkin = { risk_level: RiskLevel; checkin_date: string };

function getYesterday(today: string): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function daysBetween(dateA: string, dateB: string): number {
  return Math.round(
    (new Date(`${dateA}T12:00:00`).getTime() -
      new Date(`${dateB}T12:00:00`).getTime()) /
      86_400_000,
  );
}

function countConsecutive(
  checkins: { risk_level: RiskLevel }[],
  level: RiskLevel,
): number {
  let count = 0;
  for (const c of checkins) {
    if (c.risk_level === level) count++;
    else break;
  }
  return count;
}

export function getPreCheckinNotification(input: {
  isCaregiver: boolean;
  currentlyHospitalized: boolean;
  lastCheckin: Checkin | null;
  recentCheckins: Checkin[];
  today: string;
}): PreCheckinNotification {
  const { isCaregiver, currentlyHospitalized, lastCheckin, recentCheckins, today } =
    input;

  const yesterday = getYesterday(today);
  const daysSinceLastCheckin = lastCheckin
    ? daysBetween(today, lastCheckin.checkin_date)
    : null;
  const consecutiveYellow = countConsecutive(recentCheckins, "YELLOW");
  const consecutiveGreen = countConsecutive(recentCheckins, "GREEN");

  // P1
  if (currentlyHospitalized) {
    return {
      id: "P1",
      title: "Check-ins are paused",
      body: isCaregiver
        ? "Daily check-ins are turned off right now. When the patient has been discharged, you can update their status in Settings to resume."
        : "Daily check-ins are turned off right now. When you have been discharged, you can update your status in Settings to resume.",
      blocksCheckin: true,
    };
  }

  // P2
  if (lastCheckin?.risk_level === "RED_EMERGENCY" && lastCheckin.checkin_date === yesterday) {
    return {
      id: "P2",
      title: "We hope you received care",
      body: isCaregiver
        ? "Yesterday's check-in flagged an emergency. Today's check-in will help us understand how the patient is doing now. Answer as honestly as you can."
        : "Yesterday's check-in flagged an emergency. Today's check-in will help us understand how you are doing now. Answer as honestly as you can.",
      blocksCheckin: false,
    };
  }

  // P3
  if (lastCheckin !== null && daysSinceLastCheckin !== null && daysSinceLastCheckin >= 7) {
    return {
      id: "P3",
      title: "Welcome back",
      body: isCaregiver
        ? lastCheckin
          ? `It has been ${daysSinceLastCheckin} days since the patient's last check-in. Let us start with today's check-in, and if anything has changed since then, like a new hospital stay, you can update their discharge date in Settings afterward.`
          : "It has been a while since the patient's last check-in. Let us start with today's check-in, and if anything has changed since then, like a new hospital stay, you can update their discharge date in Settings afterward."
        : lastCheckin
          ? `It has been ${daysSinceLastCheckin} days since your last check-in. Let us start with today's check-in, and if anything has changed since then, like a new hospital stay, you can update your discharge date in Settings afterward.`
          : "It has been a while since your last check-in. Let us start with today's check-in, and if anything has changed since then, like a new hospital stay, you can update your discharge date in Settings afterward.",
      blocksCheckin: false,
    };
  }

  // P4
  if (
    daysSinceLastCheckin !== null &&
    daysSinceLastCheckin >= 3 &&
    daysSinceLastCheckin <= 6
  ) {
    return {
      id: "P4",
      title: "Good to see you again",
      body: isCaregiver
        ? "It has been a few days since the patient's last check-in. Let us see how they are doing today."
        : "It has been a few days since your last check-in. Let us see how you are doing today.",
      blocksCheckin: false,
    };
  }

  // P5
  if (consecutiveYellow >= 5) {
    return {
      id: "P5",
      title: "You have had several yellow days",
      body: isCaregiver
        ? `The patient has been in the yellow zone for ${consecutiveYellow} days in a row. This can be a sign their body is working hard to recover. If you have not already reached out to their care provider, today is a good day to do so.`
        : `You have been in the yellow zone for ${consecutiveYellow} days in a row. This can be a sign your body is working hard to recover. If you have not already reached out to your care provider, today is a good day to do so.`,
      blocksCheckin: false,
    };
  }

  // P6
  if (consecutiveYellow >= 3 && consecutiveYellow <= 4) {
    return {
      id: "P6",
      title: "A few yellow days in a row",
      body: isCaregiver
        ? `The patient has been in the yellow zone for ${consecutiveYellow} days. It is worth keeping an eye on how they feel. If things do not improve, reaching out to their provider is a good next step.`
        : `You have been in the yellow zone for ${consecutiveYellow} days. It is worth keeping an eye on how you feel. If things do not improve, reaching out to your provider is a good next step.`,
      blocksCheckin: false,
    };
  }

  // P7
  if (lastCheckin?.risk_level === "RED" && lastCheckin.checkin_date === yesterday) {
    return {
      id: "P7",
      title: "Yesterday flagged some concerns",
      body: isCaregiver
        ? "Yesterday's check-in flagged some symptoms worth watching. Today's check-in will show us whether things have improved. If you have not already spoken with the patient's care provider, it may be worth doing so."
        : "Yesterday's check-in flagged some symptoms worth watching. Today's check-in will show us whether things have improved. If you have not already spoken with your care provider, it may be worth doing so.",
      blocksCheckin: false,
    };
  }

  // P8
  if (consecutiveGreen === 90) {
    return {
      id: "P8",
      title: "90 days of green",
      body: isCaregiver
        ? "90 days in a row without a concerning check-in for the patient. Their recovery is going well. Let us keep it going."
        : "90 days in a row without a concerning check-in. Your recovery is going well. Let us keep it going.",
      blocksCheckin: false,
    };
  }

  // P9
  if (consecutiveGreen === 60) {
    return {
      id: "P9",
      title: "60 days of green",
      body: isCaregiver
        ? "60 consecutive green days for the patient. That is a real milestone in their recovery. Keep it up."
        : "60 consecutive green days. That is a real milestone in your recovery. Keep it up.",
      blocksCheckin: false,
    };
  }

  // P10
  return {
    id: "P10",
    title: "Time for your check-in",
    body: isCaregiver
      ? "Welcome back. Let us see how the patient is feeling today."
      : "Welcome back. Let us see how you are feeling today.",
    blocksCheckin: false,
  };
}