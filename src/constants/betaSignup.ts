export type BetaSignupOption = {
  value: string;
  label: string;
};

// "Are you currently a Frontier GoWild Pass holder?"
export const GOWILD_STATUS_OPTIONS: BetaSignupOption[] = [
  { value: "current_pass_holder",    label: "Yes, I currently have a GoWild Pass" },
  { value: "former_pass_holder",     label: "I had one previously, but not currently" },
  { value: "considering",            label: "No, but I'm considering getting one" },
  { value: "no_frontier_flyer",      label: "No, but I fly Frontier" },
  { value: "no_not_frontier_flyer",  label: "No, and I do not currently fly Frontier" },
];

// "How long have you had or did you have the GoWild Pass?"
export const GOWILD_PASS_DURATION_OPTIONS: BetaSignupOption[] = [
  { value: "less_than_3_months",    label: "Less than 3 months" },
  { value: "three_to_six_months",   label: "3–6 months" },
  { value: "six_to_twelve_months",  label: "6–12 months" },
  { value: "one_to_two_years",      label: "1–2 years" },
  { value: "two_plus_years",        label: "2+ years" },
];

// "How often do you search for GoWild flights?"
export const GOWILD_SEARCH_FREQUENCY_OPTIONS: BetaSignupOption[] = [
  { value: "daily",            label: "Daily" },
  { value: "few_times_week",   label: "A few times per week" },
  { value: "weekly",           label: "Weekly" },
  { value: "few_times_month",  label: "A few times per month" },
  { value: "planning_only",    label: "Only when planning a trip" },
  { value: "rarely",           label: "Rarely" },
];

// "How often do you fly Frontier?"
export const FRONTIER_FLIGHT_FREQUENCY_OPTIONS: BetaSignupOption[] = [
  { value: "weekly",           label: "Weekly" },
  { value: "few_times_month",  label: "A few times per month" },
  { value: "monthly",          label: "Monthly" },
  { value: "few_times_year",   label: "A few times per year" },
  { value: "rarely",           label: "Rarely" },
  { value: "never",            label: "Never" },
];

// "Do you currently use any Frontier GoWild search app, tool, spreadsheet, alert system, or website?"
export const USES_GOWILD_SEARCH_TOOL_OPTIONS: BetaSignupOption[] = [
  { value: "yes",       label: "Yes" },
  { value: "no",        label: "No" },
  { value: "used_to",   label: "I used to" },
  { value: "not_sure",  label: "Not sure" },
];

// "Have you ever professionally contributed to a beta testing program?"
export const BETA_TESTING_EXPERIENCE_OPTIONS: BetaSignupOption[] = [
  { value: "yes_professional",  label: "Yes, professionally" },
  { value: "no",                label: "No" },
  { value: "informal",          label: "Not professionally, but I've tested early apps/products before" },
];

// "What device would you primarily use Wildfly on?"
export const PRIMARY_DEVICE_OPTIONS: BetaSignupOption[] = [
  { value: "iphone",           label: "iPhone" },
  { value: "android",          label: "Android" },
  { value: "desktop_laptop",   label: "Desktop/laptop" },
  { value: "tablet",           label: "Tablet" },
  { value: "multiple",         label: "Multiple devices" },
];

// "How would you prefer to give feedback?"
export const PREFERRED_FEEDBACK_METHOD_OPTIONS: BetaSignupOption[] = [
  { value: "email",             label: "Email" },
  { value: "in_app",            label: "In-app feedback form" },
  { value: "google_form",       label: "Google Form" },
  { value: "text_message",      label: "Text/message" },
];

// "Which Wildfly features are you most excited to test?"
export const INTERESTED_FEATURES_OPTIONS: BetaSignupOption[] = [
  { value: "gowild_availability_search",   label: "GoWild availability search" },
  { value: "watched_flights",              label: "Watched flights" },
  { value: "upcoming_flight_tracking",     label: "Upcoming flight tracking" },
  { value: "route_insights",               label: "Route insights" },
  { value: "airport_insights",             label: "Airport insights" },
  { value: "availability_trends",          label: "Availability trends" },
  { value: "seat_availability_snapshots",  label: "Seat availability snapshots" },
  { value: "flexible_date_discovery",      label: "Flexible date discovery" },
  { value: "price_availability_comparisons", label: "Price/availability comparisons" },
  { value: "alerts_notifications",         label: "Alerts or notifications" },
];
