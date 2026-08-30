/**
 * Convert airport-local hours/minutes on a given date to a UTC ISO string.
 * Uses the native Intl API — no extra dependencies.
 *
 * Strategy (sv-SE trick):
 *   1. Build a "naive UTC" Date at the desired local hours/minutes.
 *   2. Format that date in the target timezone to read back what local time it shows.
 *   3. The difference between #1 and #2 (parsed as UTC) is the timezone offset.
 *   4. Apply the offset to get the true UTC time.
 */
function localToUTC(dateStr: string, hours: number, minutes: number, timezone: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const naiveUTC = new Date(Date.UTC(y, mo - 1, d, hours, minutes, 0));

  // sv-SE locale produces "YYYY-MM-DD HH:MM:SS" — stable and parseable as ISO
  const displayed = naiveUTC.toLocaleString("sv-SE", { timeZone: timezone });
  const displayedAsUTC = new Date(displayed.replace(" ", "T") + "Z");

  const offsetMs = naiveUTC.getTime() - displayedAsUTC.getTime();
  return new Date(naiveUTC.getTime() + offsetMs).toISOString();
}

/**
 * Convert a flight time string to a UTC ISO string using the airport's IANA timezone.
 *
 * Handles three input formats:
 *   "3:08 PM"               — airport-local AM/PM (requires fallbackDate "YYYY-MM-DD")
 *   "2025-03-15T15:08:00"   — naive ISO (no zone) — interpreted in airport timezone
 *   "2025-03-15T15:08:00Z"  — already timezone-aware — normalized to UTC
 *
 * Falls back to treating the time as UTC if timezone is null/undefined or unknown.
 */
export function toAirportUTC(
  timeStr: string,
  fallbackDate: string | null,
  timezone: string | null | undefined,
): string {
  const tz = timezone ?? "UTC";

  // AM/PM format: "3:08 PM"
  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch && fallbackDate) {
    let h = parseInt(ampmMatch[1], 10);
    const min = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return localToUTC(fallbackDate, h, min, tz);
  }

  // ISO format: "YYYY-MM-DDTHH:MM..."
  const isoMatch = timeStr.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (isoMatch) {
    const hasZone = timeStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(timeStr);
    if (hasZone) {
      return new Date(timeStr).toISOString();
    }
    // Naive ISO — interpret as airport-local time
    return localToUTC(isoMatch[1], parseInt(isoMatch[2], 10), parseInt(isoMatch[3], 10), tz);
  }

  return timeStr; // Unknown format — pass through unchanged
}

/**
 * Format a stored UTC flight instant in an airport's local timezone.
 *
 * If timezone metadata is unavailable (or invalid), this intentionally falls
 * back to the runtime's local timezone so existing data still renders instead
 * of throwing a RangeError.
 */
export function formatAirportDateTime(
  dateStr: string,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";

    const withTimezone: Intl.DateTimeFormatOptions = timezone
      ? { ...options, timeZone: timezone }
      : options;

    try {
      return date.toLocaleString("en-US", withTimezone);
    } catch {
      // Bad/missing IANA metadata should not make the flight card disappear.
      return date.toLocaleString("en-US", options);
    }
  } catch {
    return "";
  }
}

export function formatAirportTime(
  dateStr: string,
  timezone: string | null | undefined,
): string {
  const formatted = formatAirportDateTime(dateStr, timezone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return formatted || dateStr;
}

export function formatAirportDate(
  dateStr: string,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  return formatAirportDateTime(dateStr, timezone, options);
}
