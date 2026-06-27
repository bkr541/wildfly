import type {
  EarlyBookingPromotion,
  GuideFaqItem,
  GuideResourceLink,
  PassTravelPeriod,
  TroubleshooterQuestion,
} from "@/types/gowildGuide";

/** Date Wildfly last verified the content of this guide against Frontier's site. */
export const LAST_VERIFIED_DATE = "2026-06-26";

export const EARLY_BOOKING_PROMOTION: EarlyBookingPromotion = {
  title: "GoWild Early Booking Promotion",
  purchaseThrough: "2026-06-30",
  travelThrough: "2026-11-19",
  message:
    "Select flights may be available before the standard booking window. An additional early-booking charge and exclusions may apply.",
  active: true,
};

export const PASS_TRAVEL_PERIODS: PassTravelPeriod[] = [
  { name: "2026–2027 Annual Pass", travelStart: "2026-05-01", travelEnd: "2027-04-30" },
  { name: "2026 Summer Pass", travelStart: "2026-04-22", travelEnd: "2026-09-30" },
];

export const RESOURCE_LINKS: GuideResourceLink[] = [
  { label: "Frontier GoWild Pass", url: "https://www.flyfrontier.com/deals/gowild/" },
  { label: "Frontier GoWild FAQ", url: "https://www.flyfrontier.com/deals/gowild/faqs/" },
  {
    label: "Optional Services & Fees",
    url: "https://www.flyfrontier.com/travel/travel-info/optional-services/",
  },
  { label: "Frontier Customer Support", url: "https://www.flyfrontier.com/customer-support/" },
  {
    label: "Contract of Carriage",
    url: "https://www.flyfrontier.com/legal/contract-of-carriage/",
  },
];

export const QUICK_POINTS: string[] = [
  "GoWild airfare is generally $0.01 per flight segment, but taxes, airport charges, and other fees still apply.",
  "Domestic flights normally enter the standard booking window the calendar day before departure.",
  "International flights normally enter the standard booking window 10 days before departure.",
  "Select flights may become available earlier through an early-booking promotion or charge.",
  "GoWild seats are limited and are not guaranteed on every flight.",
  "Bags, seats, bundles, pets, and other extras may cost more.",
  "Standard or Discount Den fares can be available when GoWild is unavailable.",
  "Compare the complete GoWild, Standard, and Discount Den totals before purchasing.",
];

export const TROUBLESHOOTER_QUESTIONS: TroubleshooterQuestion[] = [
  {
    id: "account",
    prompt: "Are you signed in to the correct Frontier Miles account that holds the pass?",
    positiveIsIssue: false,
    issueExplanation:
      "GoWild fares only appear when signed in with the Frontier Miles account that holds an active pass.",
  },
  {
    id: "active",
    prompt: "Is the pass active for the travel date you are searching?",
    positiveIsIssue: false,
    issueExplanation: "If the pass has expired or has not yet started, GoWild fares will not appear.",
  },
  {
    id: "period",
    prompt: "Is the travel date inside the pass's eligible travel period?",
    positiveIsIssue: false,
    issueExplanation:
      "Each pass type has its own travel-period window. Travel outside that window is not eligible.",
  },
  {
    id: "window",
    prompt: "Is the flight inside the standard booking window (next day domestic, 10 days international)?",
    positiveIsIssue: false,
    issueExplanation:
      "If the flight is outside the standard window, GoWild may only appear through an early-booking promotion.",
  },
  {
    id: "blackout",
    prompt: "Does the departure date fall on a published blackout date?",
    positiveIsIssue: true,
    issueExplanation:
      "Standard GoWild redemption is normally restricted on blackout dates. Promotional fares may still appear at higher prices.",
  },
  {
    id: "frontier",
    prompt: "Is the entire itinerary operated by Frontier?",
    positiveIsIssue: false,
    issueExplanation: "GoWild fares apply only to Frontier-operated flights.",
  },
  {
    id: "inventory",
    prompt: "Is GoWild inventory likely available on this flight?",
    positiveIsIssue: false,
    issueExplanation:
      "GoWild seats are capacity-controlled. A Standard fare being purchasable does not require Frontier to release a GoWild seat.",
  },
  {
    id: "passenger-count",
    prompt: "Does the passenger count fit the GoWild seats Frontier is offering?",
    positiveIsIssue: false,
    issueExplanation:
      "Searches may fail when the requested passenger count exceeds the GoWild inventory on a flight.",
  },
  {
    id: "all-eligible",
    prompt: "Does every traveler in the booking hold their own eligible GoWild Pass?",
    positiveIsIssue: false,
    issueExplanation:
      "Every traveler in a GoWild booking generally needs their own pass and Frontier Miles account.",
  },
  {
    id: "return-window",
    prompt: "If a round trip, is the return inside its own booking window?",
    positiveIsIssue: false,
    issueExplanation:
      "Each direction has its own booking window. A return outside that window will not show GoWild yet.",
  },
  {
    id: "connection-inventory",
    prompt: "If a connecting itinerary, do all segments have GoWild inventory?",
    positiveIsIssue: false,
    issueExplanation:
      "An itinerary needs GoWild availability on every segment Frontier offers, not only the first.",
  },
  {
    id: "promo-scope",
    prompt: "Is this flight covered by the current promotion's eligible routes and dates?",
    positiveIsIssue: false,
    issueExplanation:
      "Promotional GoWild fares can be limited to specific routes, dates, or travel periods.",
  },
];

export const FAQ_ITEMS: GuideFaqItem[] = [
  {
    id: "standby",
    question: "Is GoWild standby travel?",
    answer:
      "No. GoWild is a confirmed reservation when inventory is available. Travelers are not flying standby; they are booking a confirmed seat through a separate fare product.",
  },
  {
    id: "every-flight",
    question: "Is every Frontier flight available through GoWild?",
    answer:
      "No. GoWild is capacity-controlled, so seats are released only on select flights and only when Frontier chooses to release them.",
  },
  {
    id: "regular-available",
    question: "Why is a regular fare available when GoWild is not?",
    answer:
      "Standard and Discount Den are separate fare products with their own inventory. Frontier is not required to release a GoWild seat just because a Standard seat exists.",
  },
  {
    id: "domestic-open",
    question: "When does domestic GoWild booking open?",
    answer:
      "The standard booking window normally opens at midnight in the origin airport's local timezone on the calendar day before departure.",
  },
  {
    id: "exactly-24",
    question: "Is the domestic booking window exactly 24 hours?",
    answer:
      "No. It is a calendar-day rule. A flight at 6:00 AM and another at 11:00 PM the next day both become eligible at midnight in the origin's timezone, even though their countdowns differ in hours.",
  },
  {
    id: "international-open",
    question: "When does international GoWild booking open?",
    answer:
      "The standard window normally opens at midnight in the origin airport's local timezone 10 calendar days before departure.",
  },
  {
    id: "round-trip",
    question: "Can I book round trip?",
    answer:
      "Yes when Frontier offers a round-trip itinerary on the same booking. Each direction follows its own booking window for GoWild availability.",
  },
  {
    id: "connections",
    question: "Can I book connecting flights?",
    answer:
      "Yes when Frontier sells the itinerary as a single booking. GoWild availability must exist on every segment.",
  },
  {
    id: "fare-15",
    question: "Why is my domestic fare around $15?",
    answer:
      "That is usually a domestic nonstop inside the standard window. The total typically reflects the $0.01 airfare plus required taxes and airport charges.",
  },
  {
    id: "fare-30",
    question: "Why is my fare around $30?",
    answer:
      "Common drivers include connecting flights with multiple segment taxes, territory routing, or other itinerary-specific charges.",
  },
  {
    id: "fare-high",
    question: "Why is my fare $59, $79, or $119?",
    answer:
      "These higher totals often indicate a GoWild Early Booking charge, peak-date promotion pricing, multiple segments, international taxes, or optional add-ons.",
  },
  {
    id: "early-booking-fee",
    question: "What is a GoWild Early Booking charge?",
    answer:
      "An optional, non-refundable charge Frontier may add to allow booking before the standard window opens. It is not a guaranteed blackout-date fee and may not apply to every flight.",
  },
  {
    id: "blackout-fee",
    question: "Is there a blackout-date fee?",
    answer:
      "There is no standard universal fee. Standard GoWild redemption is normally restricted, but Frontier sometimes runs separate promotions that offer travel on those dates at higher promotional prices.",
  },
  {
    id: "promo-blackout",
    question: "Can a promotion make a blackout date bookable?",
    answer:
      "Sometimes. Promotional or early-booking inventory may be offered on otherwise restricted dates at higher prices and with additional rules. Frontier's current terms control.",
  },
  {
    id: "empty-seat-map",
    question: "Does an empty seat map mean the flight is empty?",
    answer:
      "No. The seat map shows seat assignments, not unsold airline inventory. Confirmed passengers may not have selected seats yet.",
  },
  {
    id: "bags-seats",
    question: "Are bags and seats included?",
    answer:
      "Generally, only a personal item is included. Carry-ons, checked bags, advance seat selection, and bundles are usually extra.",
  },
  {
    id: "add-non-pass",
    question: "Can I add someone who does not have a pass?",
    answer:
      "Each traveler in a GoWild booking generally needs their own eligible pass. A traveler without a pass cannot use someone else's GoWild benefit on the same reservation.",
  },
  {
    id: "children",
    question: "Can children use GoWild?",
    answer:
      "Children may hold a pass subject to Frontier's current age and account rules. Younger children below the independent-travel age must travel with an eligible adult.",
  },
  {
    id: "miss-flight",
    question: "What happens if I miss my flight?",
    answer:
      "Cancel before departure when you cannot travel. Repeated no-shows can risk penalties or pass privileges. Frontier's current terms control.",
  },
  {
    id: "cancelled-flight",
    question: "What happens if Frontier cancels my flight?",
    answer:
      "Check directly with Frontier for rebooking or refund options. Replacement GoWild availability may not appear through a normal search.",
  },
  {
    id: "renew",
    question: "Does the pass renew automatically?",
    answer:
      "Frontier may renew passes automatically. Renewal can be managed inside the Frontier Miles account. Prices and renewal behavior are subject to change.",
  },
  {
    id: "rules-change",
    question: "Can Frontier change GoWild rules or prices?",
    answer:
      "Yes. Frontier may change pricing, rules, blackout dates, fees, and availability at any time. The current Frontier terms always control.",
  },
];
