// Utility/helper functions
// Examples: formatDate, calculateAge, determineZone, etc.

/**
 * Calculate age from birthday
 */
export function calculateAge(birthday: string): number {
  const today = new Date();
  const birthDate = new Date(birthday);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Determine temperature zone based on value
 */
export function getTemperatureZone(temp: number): "green" | "yellow" | "red" {
  if (temp < 96.8 || temp >= 101.5) return "red";
  if (temp >= 100.0 && temp < 101.5) return "yellow";
  return "green";
}

/**
 * Determine oxygen level zone based on SpO2 value
 */
export function getOxygenZone(spo2: number): "green" | "yellow" | "red" {
  if (spo2 < 92) return "red";
  if (spo2 >= 92 && spo2 < 95) return "yellow";
  return "green";
}

/**
 * Determine heart rate zone based on value
 */
export function getHeartRateZone(hr: number): "green" | "yellow" | "red" {
  if (hr > 120 || hr < 60) return "red";
  if (hr >= 101 && hr <= 120) return "yellow";
  return "green";
}

/**
 * Determine blood pressure zone based on current and baseline
 */
export function getBloodPressureZone(
  current: number,
  baseline: number
): "green" | "yellow" | "red" {
  // Check absolute thresholds
  if (current < 90 || current > 180) return "red";
  
  // Calculate difference from baseline
  const diff = baseline - current;
  
  if (diff >= 40) return "red";
  if (diff >= 20) return "yellow";
  return "green";
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Get zone color class for Tailwind
 */
export function getZoneColorClass(zone: "green" | "yellow" | "red"): string {
  const colors = {
    green: "bg-green-100 text-green-800 border-green-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    red: "bg-red-100 text-red-800 border-red-200",
  };
  return colors[zone];
}
