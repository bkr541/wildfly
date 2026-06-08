import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
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

const KNOWN_NAMESPACES = [
  "FlightSearch", "FlightResults", "FlightsPage", "Normalize", "Normalizer",
  "Cache", "EdgeFunctions", "SnapshotWriter", "Auth", "ProfileSetup",
  "AccountHub", "Subscription", "Wallet",
];

// ── View ──────────────────────────────────────────────────────────────────────

export function DebugSettingsAdminView() {
  const { settings, loading, updateSettings } = useDeveloperSettings();
  const [saving, setSaving] = useState(false);
  const [customNs, setCustomNs] = useState("");

  const loadError = !loading && !settings
    ? "Failed to load developer settings. Check your allowlist membership and try again."
    : null;

  const debugComponents = settings?.enabled_debug_components ?? [];
  const suggestions = KNOWN_NAMESPACES.filter((ns) => !debugComponents.includes(ns));

  const toggle = async (key: "debug_enabled" | "show_raw_payload") => {
    if (!settings || saving) return;
    setSaving(true);
    const { error } = await updateSettings({ [key]: !settings[key] });
    if (error) toast.error("Failed to save — change reverted");
    else toast.success("Setting updated");
    setSaving(false);
  };

  const addNamespace = async (ns: string) => {
    const trimmed = ns.trim();
    if (!settings || saving || !trimmed) return;
    if (debugComponents.includes(trimmed)) return;
    setSaving(true);
    const { error } = await updateSettings({
      enabled_debug_components: [...debugComponents, trimmed],
    });
    if (error) toast.error("Failed to save — change reverted");
    else setCustomNs("");
    setSaving(false);
  };

  const removeNamespace = async (ns: string) => {
    if (!settings || saving) return;
    setSaving(true);
    const { error } = await updateSettings({
      enabled_debug_components: debugComponents.filter((n) => n !== ns),
    });
    if (error) toast.error("Failed to save — change reverted");
    setSaving(false);
  };

  return (
    <DeveloperToolsAdminShell
      title="Debug Settings"
      description="Control developer debug mode, raw payload visibility, and per-component debug filters."
      loading={loading}
      error={loadError}
      actions={saving ? <AdminSavingIndicator /> : undefined}
    >
      {/* ── Section 1: Debug Mode ── */}
      <AdminCard>
        <AdminSectionLabel>Debug Mode</AdminSectionLabel>

        <AdminToggleRow
          label="Enable Debug Mode"
          description="Show additional debug information throughout the app."
          checked={!!settings?.debug_enabled}
          disabled={saving}
          onChange={() => toggle("debug_enabled")}
        />

        {settings?.debug_enabled && (
          <div className="mt-4 pt-4 border-t border-[#EEF0F0]">
            <AdminSectionLabel>Raw Payloads</AdminSectionLabel>
            <AdminToggleRow
              label="Show Raw Payloads"
              description="Display full API and debug objects instead of summarized versions."
              checked={!!settings?.show_raw_payload}
              disabled={saving}
              onChange={() => toggle("show_raw_payload")}
            />
          </div>
        )}
      </AdminCard>

      {/* ── Section 2: Debug Component Filter ── */}
      <AdminCard>
        <AdminSectionLabel>Debug Component Filter</AdminSectionLabel>

        {debugComponents.length === 0 ? (
          <p className="text-xs text-[#9CA3AF] mb-4">
            No filter selected. Debug information is allowed for all components.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {debugComponents.map((ns) => (
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
