/** Shared types for the GoWild Guide feature. */

export type TravelType = "domestic" | "international";

export interface EarlyBookingPromotion {
  title: string;
  /** Last day a customer may purchase using this promotion (YYYY-MM-DD). */
  purchaseThrough: string;
  /** Last eligible travel date covered by the promotion (YYYY-MM-DD). */
  travelThrough: string;
  message: string;
  active: boolean;
}

export interface PassTravelPeriod {
  name: string;
  travelStart: string;
  travelEnd: string;
}

export interface GuideFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface GuideResourceLink {
  label: string;
  url: string;
  description?: string;
}

export interface TroubleshooterQuestion {
  id: string;
  prompt: string;
  /** Which answer represents the "potential cause" / "likely problem" case. */
  positiveIsIssue: boolean;
  /** Plain-language guidance shown when the answer matches the issue case. */
  issueExplanation: string;
}

export interface BookingWindowResult {
  travelType: TravelType;
  /** Origin airport IANA timezone, when known. */
  originTimezone: string | null;
  /** ISO instant representing when the window opens (UTC), or null when unknown. */
  opensAtIso: string | null;
  /** Origin-local YYYY-MM-DD calendar date of the window opening. */
  opensOnDate: string | null;
  /** Whether the result was computed using an exact origin-local timezone. */
  exactTimezone: boolean;
  /** Whether the departure date falls on a known blackout date. */
  isBlackoutDeparture: boolean;
}
