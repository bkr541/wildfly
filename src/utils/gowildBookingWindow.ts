import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { isBlackoutDate } from "@/utils/blackoutDates";
import type { BookingWindowResult, TravelType } from "@/types/gowildGuide";

/**
 * Subtract calendar days from a YYYY-MM-DD string, returning YYYY-MM-DD.
 * Works in UTC to avoid local-timezone drift.
 */
export function subtractCalendarDays(dateYmd: string, days: number): string {
  const [y, m, d] = dateYmd.split("-").map((n) => parseInt(n, 10));
  const utc = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  const next = new Date(utc - days * 24 * 60 * 60 * 1000);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Calculate when the GoWild booking window opens for a given departure.
 *
 * Domestic:       midnight (origin-local) on the calendar day BEFORE departure.
 * International:  midnight (origin-local) 10 calendar days BEFORE departure.
 *
 * When `originTimezone` is null/empty, we still return the calendar date but
 * mark `exactTimezone: false` and leave `opensAtIso` null so the caller can
 * disable countdowns.
 */
export function calculateBookingWindowOpen(params: {
  departureDate: string; // YYYY-MM-DD (origin-local calendar date)
  travelType: TravelType;
  originTimezone?: string | null;
}): BookingWindowResult {
  const { departureDate, travelType } = params;
  const tz = (params.originTimezone ?? "").trim() || null;

  const offset = travelType === "international" ? 10 : 1;
  const opensOnDate = subtractCalendarDays(departureDate, offset);
  const isBlackoutDeparture = isBlackoutDate(departureDate);

  if (!tz) {
    return {
      travelType,
      originTimezone: null,
      opensAtIso: null,
      opensOnDate,
      exactTimezone: false,
      isBlackoutDeparture,
    };
  }

  try {
    // Midnight in the origin timezone -> UTC instant.
    const opensAt = fromZonedTime(`${opensOnDate}T00:00:00`, tz);
    return {
      travelType,
      originTimezone: tz,
      opensAtIso: opensAt.toISOString(),
      opensOnDate,
      exactTimezone: true,
      isBlackoutDeparture,
    };
  } catch {
    return {
      travelType,
      originTimezone: tz,
      opensAtIso: null,
      opensOnDate,
      exactTimezone: false,
      isBlackoutDeparture,
    };
  }
}

/** Format an ISO instant in a given timezone. Returns "" on failure. */
export function formatInZone(
  iso: string | null,
  tz: string | null,
  fmt: string,
): string {
  if (!iso || !tz) return "";
  try {
    return formatInTimeZone(new Date(iso), tz, fmt);
  } catch {
    return "";
  }
}

/** Compute a human-readable countdown between now and `targetIso`. */
export function formatCountdown(targetIso: string | null, nowMs: number): {
  isOpen: boolean;
  label: string;
} {
  if (!targetIso) return { isOpen: false, label: "" };
  const diff = new Date(targetIso).getTime() - nowMs;
  if (diff <= 0) return { isOpen: true, label: "Booking window should be open" };
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  if (!days) parts.push(`${seconds}s`);
  return { isOpen: false, label: parts.join(" ") };
}
