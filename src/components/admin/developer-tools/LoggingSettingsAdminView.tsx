import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, PlusSignIcon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { useDeveloperSettings } from "@/lib/logSettings";
import {
  DeveloperToolsAdminShell,
  AdminCard,
  AdminSectionLabel,
  AdminToggleRow,
  AdminSavingIndicator,
} from "./DeveloperToolsAdminShell";

// ── Constants ─────────────────────────────────────────────────────────────────

type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const LOG_LEVELS: { value: LogLevel; label: string }[] = [
  { value: "silent", label: "Silent — nothing logs" },
  { value: "error",  label: "Error — errors only" },
  { value: "warn",   label: "Warn — errors + warnings" },
  { value: "info",   label: "Info — errors + warnings + info" },
  { value: "debug",  label: "Debug — everything" },
];

const KNOWN_NAMESPACES = [
  "FlightsPage", "Cache", "EdgeFunctions", "SnapshotWriter",
  "Normalize", "FlightSearch", "FlightResults",
  "Auth", "ProfileSetup", "AccountHub", "Subscription", "Wallet",
];

// ── View ──────────────────────────────────────────────────────────────────────

export function LoggingSettingsAdminView() {
  const { settings, loading, updateSettings } = useDeveloperSettings();
  const [saving, setSaving] = useState(false);
  const [customNs, setCustomNs] = useState("");

  const loadError = !loading && !settings
    ? "Failed to load developer settings. Check your allowlist membership and try again."
    : null;

  const logComponents = settings?.enabled_component_logging ?? [];
  const suggestions = KNOWN_NAMESPACES.filter((ns) => !logComponents.includes(ns));

  const toggleLogging = async () => {
    if (!settings || saving) return;
    setSaving(true);
    const { error } = await updateSettings({ logging_enabled: !settings.logging_enabled });
    if (error) toast.error("Failed to save — change reverted");
    else toast.success("Setting updated");
    setSaving(false);
  };

  const setLogLevel = async (level: LogLevel) => {
    if (!settings || saving) return;
    setSaving(true);
    const { error } = await updateSettings({ log_level: level });
    if (error) toast.error("Failed to save — change reverted");
    else toast.success("Log level updated");
    setSaving(false);
  };

  const addNamespace = async (ns: string) => {
    const trimmed = ns.trim();
    if (!settings || saving || !trimmed) return;
    if (logComponents.includes(trimmed)) return;
    setSaving(true);
    const { error } = await updateSettings({
      enabled_component_logging: [...logComponents, trimmed],
    });
    if (error) toast.error("Failed to save — change reverted");
    else setCustomNs("");
    setSaving(false);
  };

  const removeNamespace = async (ns: string) => {
    if (!settings || saving) return;
    setSaving(true);
    const { error } = await updateSettings({
      enabled_component_logging: logComponents.filter((n) => n !== ns),
    });
    if (error) toast.error("Failed to save — change reverted");
    setSaving(false);
  };

  return (
    <DeveloperToolsAdminShell
      title="Logging Settings"
      description="Configure log output, verbosity level, and per-component namespace filters."
      loading={loading}
      error={loadError}
      actions={saving ? <AdminSavingIndicator /> : undefined}
    >
      {/* ── Section 1: Enable Logging ── */}
      <AdminCard>
        <AdminSectionLabel>Logging</AdminSectionLabel>
        <AdminToggleRow
          label="Enable Logging"
          description="Enable non-error log output. Errors always log regardless of this setting."
          checked={!!settings?.logging_enabled}
          disabled={saving}
          onChange={toggleLogging}
        />
      </AdminCard>

      {/* ── Section 2: Log Level ── */}
      <AdminCard>
        <AdminSectionLabel>Log Level</AdminSectionLabel>
        <div className="relative">
          <select
            value={settings?.log_level ?? "error"}
            onChange={(e) => setLogLevel(e.target.value as LogLevel)}
            disabled={saving || !settings}
            className="appearance-none w-full h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 pr-9 text-sm font-medium text-[#1A2E2E] focus:outline-none focus:ring-2 focus:ring-[#059669]/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {LOG_LEVELS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={2} />
          </span>
        </div>
      </AdminCard>

      {/* ── Section 3: Component Log Filter ── */}
      <AdminCard>
        <AdminSectionLabel>Component Log Filter</AdminSectionLabel>

        {logComponents.length === 0 ? (
          <p className="text-xs text-[#9CA3AF] mb-4">
            No component filter selected. Logs are allowed from all namespaces.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {logComponents.map((ns) => (
              <span
                key={ns}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
              >
                {ns}
                <button
                  type="button"
                  onClick={() => removeNamespace(ns)}
                  disabled={saving}
                  className="hover:opacity-70 disabled:opacity-40 flex-shrink-0"
                  aria-label={`Remove ${ns}`}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={10} color="currentColor" strokeWidth={2} />
                </button>
              </span>
            ))}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] mb-2">
              Suggested
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((ns) => (
                <button
                  key={ns}
                  type="button"
                  onClick={() => addNamespace(ns)}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#D1D5DB] px-3 py-1 text-xs font-medium text-[#6B7280] hover:border-[#059669] hover:text-[#059669] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <HugeiconsIcon icon={PlusSignIcon} size={9} color="currentColor" strokeWidth={2} />
                  {ns}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 items-center pt-1 border-t border-[#EEF0F0]">
          <input
            type="text"
            value={customNs}
            onChange={(e) => setCustomNs(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNamespace(customNs)}
            placeholder="Custom namespace…"
            disabled={saving}
            className="flex-1 h-9 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1A2E2E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#059669]/30 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => addNamespace(customNs)}
            disabled={saving || !customNs.trim()}
            className="h-9 px-4 rounded-xl bg-[#059669] text-white text-sm font-semibold hover:bg-[#047857] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            Add
          </button>
        </div>
      </AdminCard>
    </DeveloperToolsAdminShell>
  );
}
