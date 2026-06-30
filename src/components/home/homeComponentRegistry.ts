import {
  Airplane01Icon,
  Alert01Icon,
  FlashIcon,
  Key01Icon,
  Location01Icon,
  Search01Icon,
  SunCloud01Icon,
} from "@hugeicons/core-free-icons";

export interface HomeComponentMeta {
  label: string;
  description: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  developerOnly?: boolean;
}

export const HOME_COMPONENT_META: Record<string, HomeComponentMeta> = {
  todays_gowild_flights: {
    label: "Today's GoWild",
    description: "Today's scheduled GoWild flights from your home airport",
    icon: SunCloud01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  upcoming_flights: {
    label: "Upcoming Flights",
    description: "Shows your next booked trip",
    icon: Airplane01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  watched_flights: {
    label: "Watched Flights",
    description: "Tracks price-drop alerts",
    icon: Alert01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  recent_searches: {
    label: "Recent Searches",
    description: "Displays your latest fare lookups",
    icon: Search01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  quick_searches: {
    label: "Quick Searches",
    description: "Fast access to frequent routes",
    icon: FlashIcon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  day_trips: {
    label: "Day Trips",
    description: "Quick getaways from your airport",
    icon: Location01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
  },
  token_expiration: {
    label: "Token Expiration",
    description: "Displays your GoWild token status",
    icon: Key01Icon,
    iconBg: "#E6F7F2",
    iconColor: "#059669",
    developerOnly: true,
  },
};

export const HOME_COMPONENT_OPTIONS = Object.entries(HOME_COMPONENT_META).map(
  ([value, meta]) => ({ value, label: meta.label, developerOnly: !!meta.developerOnly }),
);

export const DEFAULT_HOME_COMPONENTS = [
  "todays_gowild_flights",
  "upcoming_flights",
  "watched_flights",
  "quick_searches",
  "recent_searches",
] as const;
