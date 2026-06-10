import {
  Notification01Icon,
  Notification02Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserGroupIcon,
  Route01Icon,
  Airplane01Icon,
  Calendar01Icon,
  Clock01Icon,
  Alert01Icon,
  Alert02Icon,
  AlertCircleIcon,
  InformationCircleIcon,
  CheckmarkCircle01Icon,
  CancelCircleIcon,
  Settings01Icon,
  DashboardSquare01Icon,
  Mail01Icon,
  Megaphone01Icon,
  ShieldKeyIcon,
} from "@hugeicons/core-free-icons";

export interface NotificationIconEntry {
  name: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number; color?: string; strokeWidth?: number }>;
}

export const NOTIFICATION_ICON_REGISTRY: NotificationIconEntry[] = [
  { name: "Notification01Icon",    label: "Bell",              Icon: Notification01Icon },
  { name: "Notification02Icon",    label: "Bell Alt",          Icon: Notification02Icon },
  { name: "UserAdd01Icon",         label: "Add User",          Icon: UserAdd01Icon },
  { name: "UserCheck01Icon",       label: "User Check",        Icon: UserCheck01Icon },
  { name: "UserGroupIcon",         label: "Group",             Icon: UserGroupIcon },
  { name: "Route01Icon",           label: "Route",             Icon: Route01Icon },
  { name: "Airplane01Icon",        label: "Airplane",          Icon: Airplane01Icon },
  { name: "Calendar01Icon",        label: "Calendar",          Icon: Calendar01Icon },
  { name: "Clock01Icon",           label: "Clock",             Icon: Clock01Icon },
  { name: "Alert01Icon",           label: "Alert",             Icon: Alert01Icon },
  { name: "Alert02Icon",           label: "Alert Alt",         Icon: Alert02Icon },
  { name: "AlertCircleIcon",       label: "Alert Circle",      Icon: AlertCircleIcon },
  { name: "InformationCircleIcon", label: "Info Circle",       Icon: InformationCircleIcon },
  { name: "CheckmarkCircle01Icon", label: "Checkmark Circle",  Icon: CheckmarkCircle01Icon },
  { name: "CancelCircleIcon",      label: "Cancel Circle",     Icon: CancelCircleIcon },
  { name: "Settings01Icon",        label: "Settings",          Icon: Settings01Icon },
  { name: "DashboardSquare01Icon", label: "Dashboard",         Icon: DashboardSquare01Icon },
  { name: "Mail01Icon",            label: "Mail",              Icon: Mail01Icon },
  { name: "Megaphone01Icon",       label: "Megaphone",         Icon: Megaphone01Icon },
  { name: "ShieldKeyIcon",         label: "Shield Key",        Icon: ShieldKeyIcon },
];

const REGISTRY_MAP = new Map(
  NOTIFICATION_ICON_REGISTRY.map((e) => [e.name, e.Icon]),
);

/** Returns the icon component for an icon_name string, falling back to Notification01Icon. */
export function getNotificationIcon(iconName?: string | null): NotificationIconEntry["Icon"] {
  if (!iconName) return Notification01Icon;
  return REGISTRY_MAP.get(iconName) ?? Notification01Icon;
}
