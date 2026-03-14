import type { RiskLevel } from "@/types/database";

export type ReminderId =
  | "D1"
  | "D2"
  | "D3"
  | "D4"
  | "D5"
  | "W1"
  | "W2"
  | "W3"
  | "W4"
  | "W5"
  | "W6"
  | "W7"
  | "W8"
  | "W9";

export interface DashboardReminder {
  id: ReminderId;
  title: string;
  body: string;
}

export function getDashboardReminders(input: {
  isCaregiver: boolean;
  isPatient: boolean;
  currentlyHospitalized: boolean;
  onImmunossuppressants: boolean;
  hasOtherMedications: boolean;
  hasSocialSupport: boolean;
  hasCaregiver: boolean;
  physicalAbilityLevel: string | null;
  hasWeakenedImmune: boolean;
  profileLastUpdated: string | null;
  recentCheckins: { risk_level: RiskLevel; checkin_date: string }[];
  today: string;
  todayCheckinComplete: boolean;
  yesterdayReminderIds: ReminderId[];
  daysSinceDischarge: number | null;
}): DashboardReminder[] {
  const slots: DashboardReminder[] = [];
  const yesterday = getYesterday(input.today);
  const useCaregiverCopy = input.isCaregiver && !input.isPatient;

  const createReminder = (
    id: ReminderId,
    title: string,
    patientBody: string,
    caregiverBody?: string,
  ): DashboardReminder => ({
    id,
    title,
    body: useCaregiverCopy && caregiverBody ? caregiverBody : patientBody,
  });

  if (input.currentlyHospitalized && slots.length < 3) {
    slots.push(
      createReminder(
        "D1",
        "Check-ins are paused",
        "Daily check-ins are off right now. When you have been discharged, update your status in Settings to resume monitoring.",
        "Daily check-ins are off right now. When the patient has been discharged, update their status in Settings to resume monitoring.",
      ),
    );
  } else {
    if (
      slots.length < 3 &&
      input.recentCheckins[1]?.risk_level === "RED_EMERGENCY" &&
      input.recentCheckins[1]?.checkin_date === yesterday
    ) {
      slots.push(
        createReminder(
          "D2",
          "Emergency check-in recently",
          "You had an emergency-level check-in recently. If you have not spoken with your care team since, please do so today.",
          "The patient had an emergency-level check-in recently. If you have not spoken with their care team since, please do so today.",
        ),
      );
    }

    if (
      slots.length < 3 &&
      !slots.some((reminder) => reminder.id === "D2") &&
      countConsecutive(input.recentCheckins.slice(1), "YELLOW") >= 3
    ) {
      slots.push(
        createReminder(
          "D3",
          "Several yellow days recently",
          "You have had a few yellow check-ins recently. If you have not yet reached out to your provider, today is a good time.",
          "The patient has had a few yellow check-ins recently. If you have not yet reached out to their provider, today is a good time.",
        ),
      );
    }

    if (
      slots.length < 3 &&
      (input.profileLastUpdated === null ||
        daysBetween(input.today, input.profileLastUpdated) >= 90)
    ) {
      slots.push(
        createReminder(
          "D4",
          "Your profile may be out of date",
          "It has been a while since you last reviewed your health profile. Things like medications and conditions can change over time. You can make updates in Settings.",
          "It has been a while since the patient's health profile was last reviewed. Things like medications and conditions can change over time. You can make updates in Settings.",
        ),
      );
    }

    if (
      slots.length < 3 &&
      input.todayCheckinComplete === true &&
      input.recentCheckins[1] &&
      daysBetween(input.today, input.recentCheckins[1].checkin_date) >= 7
    ) {
      slots.push(
        createReminder(
          "D5",
          "Double-check your profile",
          "You have been away for a bit. If anything has changed, like a new hospital stay or new medications, you can update your profile in Settings.",
          "The patient has been away for a bit. If anything has changed, like a new hospital stay or new medications, you can update their profile in Settings.",
        ),
      );
    }
  }

  const personalizedWellness: DashboardReminder[] = [];

  if (input.onImmunossuppressants === true || input.hasOtherMedications === true) {
    personalizedWellness.push(
      createReminder(
        "W1",
        "Take your medications",
        "Staying on schedule with your medications is an important part of recovery.",
        "Staying on schedule with the patient's medications is an important part of their recovery.",
      ),
    );
  }

  if (
    input.hasSocialSupport === false &&
    input.hasCaregiver === false &&
    input.isCaregiver === false &&
    !input.yesterdayReminderIds.includes("W2")
  ) {
    personalizedWellness.push({
      id: "W2",
      title: "Reach out to someone today",
      body: "Recovery can be hard to go through alone. Even a short call or message with someone you trust can make a difference.",
    });
  }

  if (
    input.physicalAbilityLevel === "normal" ||
    input.physicalAbilityLevel === "tires_easily"
  ) {
    personalizedWellness.push(
      createReminder(
        "W3",
        "Try some gentle movement",
        "If you are feeling up to it, even a short walk can support your recovery.",
        "If the patient is feeling up to it, even a short walk can support their recovery.",
      ),
    );
  } else if (
    input.physicalAbilityLevel === "needs_help" ||
    input.physicalAbilityLevel === "bed_or_wheelchair"
  ) {
    personalizedWellness.push(
      createReminder(
        "W4",
        "Rest when you need to",
        "Listening to your body and resting is an important part of healing. Do not push yourself too hard today.",
        "Listening to the patient's body and letting them rest is an important part of healing. Do not push them too hard today.",
      ),
    );
  }

  if (
    input.hasWeakenedImmune === true ||
    input.onImmunossuppressants === true
  ) {
    personalizedWellness.push(
      createReminder(
        "W5",
        "Protect yourself from infection",
        "Small precautions make a real difference. Regular handwashing and avoiding crowded places when possible can help keep you safe.",
        "Small precautions make a real difference for the patient. Regular handwashing and avoiding crowded places when possible can help keep them safe.",
      ),
    );
  }

  if (
    input.isCaregiver === true &&
    input.isPatient === false &&
    !input.yesterdayReminderIds.includes("W6")
  ) {
    personalizedWellness.push({
      id: "W6",
      title: "You are doing caregiving work too",
      body: "Taking care of someone else is demanding. Make sure you are taking care of yourself as well.",
    });
  }

  const hasYellowOrRedInLastSevenDays = input.recentCheckins.some((checkin) => {
    const daysAgo = daysBetween(input.today, checkin.checkin_date);

    return (
      daysAgo >= 0 &&
      daysAgo <= 7 &&
      (checkin.risk_level === "YELLOW" || checkin.risk_level === "RED")
    );
  });

  if (
    (hasYellowOrRedInLastSevenDays ||
      (input.daysSinceDischarge !== null && input.daysSinceDischarge <= 90)) &&
    !input.yesterdayReminderIds.includes("W9")
  ) {
    personalizedWellness.push(
      createReminder(
        "W9",
        "Check in on your mood",
        "Sepsis recovery affects mental health too. It is completely normal to feel anxious, frustrated, or down. You do not have to push through it alone.",
        "Sepsis recovery affects mental health too. It is completely normal for the patient to feel anxious, frustrated, or down. Check in with them about how they are feeling emotionally.",
      ),
    );
  }

  const sortedPersonalized = [...personalizedWellness].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const rotatedPersonalized =
    sortedPersonalized.length === 0
      ? []
      : rotateBy(
          sortedPersonalized,
          new Date(`${input.today}T12:00:00`).getDate() %
            sortedPersonalized.length,
        );

  const combinedWellness = [
    ...rotatedPersonalized,
    createReminder(
      "W7",
      "Stay hydrated",
      "Drinking water throughout the day supports your kidneys and immune system, both of which are important during recovery.",
      "Encouraging the patient to drink water throughout the day supports their kidneys and immune system, both of which are important during recovery.",
    ),
    createReminder(
      "W8",
      "Nourish yourself today",
      "Eating or drinking something with nutrients today can support your healing, even if your appetite is low.",
      "Helping the patient eat or drink something with nutrients today can support their healing, even if their appetite is low.",
    ),
  ];

  for (const reminder of combinedWellness) {
    if (slots.length >= 5) {
      break;
    }

    slots.push(reminder);
  }

  return slots;
}

function getYesterday(today: string): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function daysBetween(dateA: string, dateB: string): number {
  return Math.round(
    (toNoonDate(dateA).getTime() - toNoonDate(dateB).getTime()) / 86_400_000,
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

function toNoonDate(value: string): Date {
  const normalized = value.includes("T") ? value.split("T")[0] : value;
  return new Date(`${normalized}T12:00:00`);
}

function rotateBy<T>(items: T[], amount: number): T[] {
  if (items.length === 0 || amount === 0) {
    return items;
  }

  return [...items.slice(amount), ...items.slice(0, amount)];
}