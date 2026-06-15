import { cn } from "@/lib/utils";
import { messageStatusLabel, recipientStatusLabel } from "./messagingHelpers";
import { MESSAGE_STATUS_COLORS, RECIPIENT_STATUS_COLORS } from "./messagingConstants";
import type { MessageStatus, RecipientStatus } from "./messagingTypes";

export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
        MESSAGE_STATUS_COLORS[status] ?? "text-stone-400 bg-stone-400/10",
      )}
    >
      {messageStatusLabel(status)}
    </span>
  );
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
        RECIPIENT_STATUS_COLORS[status] ?? "text-stone-400 bg-stone-400/10",
      )}
    >
      {recipientStatusLabel(status)}
    </span>
  );
}
