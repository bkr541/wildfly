import { AdminSectionLabel } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { formatScheduledAt } from "./messagingHelpers";

interface Props {
  scheduledAt: string;
  onChange: (iso: string) => void;
  onClear: () => void;
}

export function MessageScheduleControls({ scheduledAt, onChange, onClear }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value ? new Date(e.target.value).toISOString() : "");
  }

  const localValue = scheduledAt
    ? new Date(scheduledAt).toISOString().slice(0, 16)
    : "";

  return (
    <div>
      <AdminSectionLabel>Schedule</AdminSectionLabel>
      <p className="text-xs text-[#9CA3AF] mb-3">
        Leave blank to send immediately when queued.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="datetime-local"
          value={localValue}
          min={new Date().toISOString().slice(0, 16)}
          onChange={handleChange}
          className="border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/40"
        />
        {scheduledAt && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-[#9CA3AF] hover:text-red-500 transition-colors font-semibold"
          >
            Clear
          </button>
        )}
      </div>
      {scheduledAt && (
        <p className="text-xs text-[#6B7280] mt-1.5">
          Scheduled for {formatScheduledAt(scheduledAt)} (local time)
        </p>
      )}
    </div>
  );
}
