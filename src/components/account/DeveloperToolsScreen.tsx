import { useState, useEffect } from "react";
import { useDeveloperSettings } from "@/lib/logSettings";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

interface DeveloperToolsScreenProps {
  onBack: () => void;
}

const LOG_LEVELS = ["silent", "error", "warn", "info", "debug"] as const;

const KNOWN_NAMESPACES = [
  "FlightSearch",
  "FlightResults",
  "Normalizer",
  "Auth",
  "ProfileSetup",
  "AccountHub",
  "Subscription",
  "Wallet",
];

const DeveloperToolsScreen = ({ onBack }: DeveloperToolsScreenProps) => {
  const { settings, loading, updateSettings } = useDeveloperSettings();
  const [newNs, setNewNs] = useState("");
  const [newDebugNs, setNewDebugNs] = useState("");

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[#6B7B7B]">Loading...</p>
      </div>
    );
  }

  const toggle = async (key: "logging_enabled" | "debug_enabled" | "show_raw_payload") => {
    await updateSettings({ [key]: !settings[key] });
    toast.success("Setting updated");
  };

  const setLogLevel = async (level: string) => {
    await updateSettings({ log_level: level });
    toast.success(`Log level set to ${level}`);
  };

  const addNamespace = async (ns: string, field: "enabled_component_logging" | "enabled_debug_components") => {
    if (!ns.trim()) return;
    const list = [...(settings[field] || [])];
    if (list.includes(ns.trim())) return;
    list.push(ns.trim());
    await updateSettings({ [field]: list });
    if (field === "enabled_component_logging") setNewNs("");
    else setNewDebugNs("");
    toast.success(`Added ${ns.trim()}`);
  };

  const removeNamespace = async (ns: string, field: "enabled_component_logging" | "enabled_debug_components") => {
    const list = (settings[field] || []).filter((n) => n !== ns);
    await updateSettings({ [field]: list });
    toast.success(`Removed ${ns}`);
  };

  const availableSuggestions = KNOWN_NAMESPACES.filter(
    (ns) => !settings.enabled_component_logging.includes(ns)
  );

  const availableDebugSuggestions = KNOWN_NAMESPACES.filter(
    (ns) => !(settings.enabled_debug_components || []).includes(ns)
  );

  const ToggleRow = ({ label, desc, value, onToggle, border = true }: { label: string; desc: string; value: boolean; onToggle: () => void; border?: boolean }) => (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center w-full px-4 py-3 text-left hover:bg-[#F2F3F3] transition-colors ${border ? "border-b border-[#F0F1F1]" : ""}`}
    >
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#2E4A4A]">{label}</p>
        <p className="text-xs text-[#6B7B7B]">{desc}</p>
      </div>
      <div className={`h-6 w-11 rounded-full relative transition-colors ${value ? "bg-[#345C5A]" : "bg-[#D1D5D5]"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
    </button>
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">
        {/* Master toggles */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          <ToggleRow
            label="Debug Mode"
            desc="Show extra debug information"
            value={settings.debug_enabled}
            onToggle={() => toggle("debug_enabled")}
            border={false}
          />
        </div>

        {/* Debug sub-options — indented */}
        {settings.debug_enabled && (
          <div className="ml-4 space-y-3 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
              <ToggleRow
                label="Show Raw Payloads"
                desc="Display full objects instead of summaries"
                value={settings.show_raw_payload}
                onToggle={() => toggle("show_raw_payload")}
                border={false}
              />
            </div>

            {/* Debug Component Filter */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4">
              <h3 className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wider mb-2">
                Debug Component Filter
              </h3>
              <p className="text-xs text-[#6B7B7B] mb-2">
                {(settings.enabled_debug_components || []).length === 0
                  ? "No filter — debug info shown for all components."
                  : "Debug info only shown for these components."}
              </p>

              {(settings.enabled_debug_components || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {(settings.enabled_debug_components || []).map((ns) => (
                    <span key={ns} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#345C5A] text-white text-xs font-semibold">
                      {ns}
                      <button type="button" onClick={() => removeNamespace(ns, "enabled_debug_components")} className="hover:opacity-70">
                        <HugeiconsIcon icon={Cancel01Icon} size={10} color="currentColor" strokeWidth={1.5} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {availableDebugSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {availableDebugSuggestions.map((ns) => (
                    <button key={ns} type="button" onClick={() => addNamespace(ns, "enabled_debug_components")} className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-[#C4CACA] text-[#6B7B7B] text-xs font-medium hover:border-[#345C5A] hover:text-[#345C5A] transition-colors">
                      <HugeiconsIcon icon={PlusSignIcon} size={8} color="currentColor" strokeWidth={1.5} />
                      {ns}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input type="text" value={newDebugNs} onChange={(e) => setNewDebugNs(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNamespace(newDebugNs, "enabled_debug_components")} placeholder="Custom namespace..." className="flex-1 px-3 py-2 rounded-xl border border-[#E3E6E6] text-sm text-[#2E4A4A] placeholder:text-[#C4CACA] focus:outline-none focus:border-[#345C5A] transition-colors" />
                <button type="button" onClick={() => addNamespace(newDebugNs, "enabled_debug_components")} disabled={!newDebugNs.trim()} className="px-4 py-2 rounded-xl bg-[#345C5A] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40">Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Logging master toggle */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          <ToggleRow
            label="Enable Logging"
            desc="Master switch for all app logging"
            value={settings.logging_enabled}
            onToggle={() => toggle("logging_enabled")}
            border={false}
          />
        </div>

        {/* Logging sub-options — indented */}
        {settings.logging_enabled && (
          <div className="ml-4 space-y-3 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4">
              <h3 className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wider mb-2">Log Level</h3>
              <div className="rounded-xl border border-[#E3E6E6] overflow-hidden">
                {LOG_LEVELS.map((level, idx) => (
                  <button key={level} type="button" onClick={() => setLogLevel(level)} className={`flex items-center w-full px-4 py-2.5 text-left hover:bg-[#F2F3F3] transition-colors ${idx < LOG_LEVELS.length - 1 ? "border-b border-[#F0F1F1]" : ""}`}>
                    <span className="flex-1 text-sm font-semibold text-[#2E4A4A] capitalize">{level}</span>
                    <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${settings.log_level === level ? "border-[#345C5A]" : "border-[#D1D5D5]"}`}>
                      {settings.log_level === level && <span className="h-2.5 w-2.5 rounded-full bg-[#345C5A]" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-4">
              <h3 className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wider mb-2">Component Log Filter</h3>
              <p className="text-xs text-[#6B7B7B] mb-2">
                {settings.enabled_component_logging.length === 0
                  ? "No filter — all namespaces are logged."
                  : "Only these namespaces will be logged (errors always pass through)."}
              </p>

              {settings.enabled_component_logging.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {settings.enabled_component_logging.map((ns) => (
                    <span key={ns} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#345C5A] text-white text-xs font-semibold">
                      {ns}
                      <button type="button" onClick={() => removeNamespace(ns, "enabled_component_logging")} className="hover:opacity-70">
                        <HugeiconsIcon icon={Cancel01Icon} size={10} color="currentColor" strokeWidth={1.5} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {availableSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {availableSuggestions.map((ns) => (
                    <button key={ns} type="button" onClick={() => addNamespace(ns, "enabled_component_logging")} className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-[#C4CACA] text-[#6B7B7B] text-xs font-medium hover:border-[#345C5A] hover:text-[#345C5A] transition-colors">
                      <HugeiconsIcon icon={PlusSignIcon} size={8} color="currentColor" strokeWidth={1.5} />
                      {ns}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input type="text" value={newNs} onChange={(e) => setNewNs(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNamespace(newNs, "enabled_component_logging")} placeholder="Custom namespace..." className="flex-1 px-3 py-2 rounded-xl border border-[#E3E6E6] text-sm text-[#2E4A4A] placeholder:text-[#C4CACA] focus:outline-none focus:border-[#345C5A] transition-colors" />
                <button type="button" onClick={() => addNamespace(newNs, "enabled_component_logging")} disabled={!newNs.trim()} className="px-4 py-2 rounded-xl bg-[#345C5A] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40">Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeveloperToolsScreen;
