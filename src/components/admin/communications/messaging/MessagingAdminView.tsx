import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare02Icon,
  Mail01Icon,
  DocumentCodeIcon,
  SentIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { MessagingOverview } from "./MessagingOverview";
import { MessagesList } from "./MessagesList";
import { MessagingTemplatesView } from "./MessagingTemplatesView";
import { MessagingDeliveryView } from "./MessagingDeliveryView";
import { MessagingSettingsView } from "./MessagingSettingsView";

type Tab = "overview" | "messages" | "templates" | "delivery" | "settings";

const TABS: { id: Tab; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { id: "overview", label: "Overview", icon: DashboardSquare02Icon },
  { id: "messages", label: "Messages", icon: Mail01Icon },
  { id: "templates", label: "Templates", icon: DocumentCodeIcon },
  { id: "delivery", label: "Delivery", icon: SentIcon },
  { id: "settings", label: "Settings", icon: Settings01Icon },
];

export function MessagingAdminView() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-[#EEF0F0] pb-px overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap -mb-px ${
              tab === t.id
                ? "border-[#345C5A] text-[#345C5A]"
                : "border-transparent text-[#9CA3AF] hover:text-[#374151]"
            }`}
          >
            <HugeiconsIcon icon={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <MessagingOverview />}
      {tab === "messages" && <MessagesList />}
      {tab === "templates" && <MessagingTemplatesView />}
      {tab === "delivery" && <MessagingDeliveryView />}
      {tab === "settings" && <MessagingSettingsView />}
    </div>
  );
}
