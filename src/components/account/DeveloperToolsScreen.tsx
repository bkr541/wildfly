import { useState, useEffect } from "react";
import { useDeveloperSettings } from "@/lib/logSettings";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
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

  const addNamespace = async (ns: string) => {
    if (!ns.trim()) return;
    const list = [...settings.enabled_component_logging];
    if (list.includes(ns.trim())) return;
    list.push(ns.trim());
    await updateSettings({ enabled_component_logging: list });
    setNewNs("");
    toast.success(`Added ${ns.trim()}`);
  };

  const removeNamespace = async (ns: string) => {
    const list = settings.enabled_component_logging.filter((n) => n !== ns);
    await updateSettings({ enabled_component_logging: list });
    toast.success(`Removed ${ns}`);
  };

  const availableSuggestions = KNOWN_NAMESPACES.filter(
    (ns) => !settings.enabled_component_logging.includes(ns)
  );

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 px-5 pb-4 space-y-4 overflow-y-auto">
        {/* Toggles */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          {([
            { key: "logging_enabled" as const, label: "Enable Logging", desc: "Master switch for all app logging" },
            { key: "debug_enabled" as const, label: "Debug Mode", desc: "Show extra debug information" },
            { key: "show_raw_payload" as const, label: "Show Raw Payloads", desc: "Display full objects instead of summaries" },
          ]).map((item, idx) => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggle(item.key)}
              className={`flex items-center w-full px-4 py-3 text-left hover:bg-[#F2F3F3] transition-colors ${idx < 2 ? "border-b border-[#F0F1F1]" : ""}`}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#2E4A4A]">{item.label}</p>
                <p className="text-xs text-[#6B7B7B]">{item.desc}</p>
              </div>
              <div className={`h-6 w-11 rounded-full relative transition-colors ${settings[item.key] ? "bg-[#345C5A]" : "bg-[#D1D5D5]"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings[item.key] ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </button>
          ))}
        </div>

        {/* Log Level */}
        <div>
          <h3 className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wider px-1 mb-2">Log Level</h3>
          <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
            {LOG_LEVELS.map((level, idx) => (
              <button
                key={level}
                type="button"
                onClick={() => setLogLevel(level)}
                className={`flex items-center w-full px-4 py-2.5 text-left hover:bg-[#F2F3F3] transition-colors ${idx < LOG_LEVELS.length - 1 ? "border-b border-[#F0F1F1]" : ""}`}
              >
                <span className="flex-1 text-sm font-semibold text-[#2E4A4A] capitalize">{level}</span>
                <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${settings.log_level === level ? "border-[#345C5A]" : "border-[#D1D5D5]"}`}>
                  {settings.log_level === level && <span className="h-2.5 w-2.5 rounded-full bg-[#345C5A]" />}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Component Logging Filter */}
        <div>
          <h3 className="text-xs font-bold text-[#6B7B7B] uppercase tracking-wider px-1 mb-2">
            Component Log Filter
          </h3>
          <p className="text-xs text-[#6B7B7B] px-1 mb-2">
            {settings.enabled_component_logging.length === 0
              ? "No filter — all namespaces are logged."
              : "Only these namespaces will be logged (errors always pass through)."}
          </p>

          {/* Active namespaces */}
          {settings.enabled_component_logging.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 px-1">
              {settings.enabled_component_logging.map((ns) => (
                <span
                  key={ns}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#345C5A] text-white text-xs font-semibold"
                >
                  {ns}
                  <button type="button" onClick={() => removeNamespace(ns)} className="hover:opacity-70">
                    <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Quick-add suggestions */}
          {availableSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 px-1">
              {availableSuggestions.map((ns) => (
                <button
                  key={ns}
                  type="button"
                  onClick={() => addNamespace(ns)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-[#C4CACA] text-[#6B7B7B] text-xs font-medium hover:border-[#345C5A] hover:text-[#345C5A] transition-colors"
                >
                  <FontAwesomeIcon icon={faPlus} className="w-2 h-2" />
                  {ns}
                </button>
              ))}
            </div>
          )}

          {/* Custom namespace input */}
          <div className="flex gap-2 px-1">
            <input
              type="text"
              value={newNs}
              onChange={(e) => setNewNs(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNamespace(newNs)}
              placeholder="Custom namespace..."
              className="flex-1 px-3 py-2 rounded-xl border border-[#E3E6E6] text-sm text-[#2E4A4A] placeholder:text-[#C4CACA] focus:outline-none focus:border-[#345C5A] transition-colors"
            />
            <button
              type="button"
              onClick={() => addNamespace(newNs)}
              disabled={!newNs.trim()}
              className="px-4 py-2 rounded-xl bg-[#345C5A] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeveloperToolsScreen;
