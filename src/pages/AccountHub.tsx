import { useState } from "react";
import { useDeveloperSettings } from "@/lib/logSettings";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faPlus } from "@fortawesome/free-solid-svg-icons";

const SUGGESTED_NAMESPACES = ["FlightsPage", "EdgeFunctions", "Normalize", "Cache", "Supabase"];

const AccountHub = () => {
  const { settings, loading, updateSettings } = useDeveloperSettings();
  const [newNamespace, setNewNamespace] = useState("");

  const addNamespace = (ns: string) => {
    if (!settings || !ns.trim()) return;
    const trimmed = ns.trim();
    if (settings.enabled_component_logging.includes(trimmed)) return;
    updateSettings({ enabled_component_logging: [...settings.enabled_component_logging, trimmed] });
    setNewNamespace("");
  };

  const removeNamespace = (ns: string) => {
    if (!settings) return;
    updateSettings({ enabled_component_logging: settings.enabled_component_logging.filter((n) => n !== ns) });
  };

  return (
    <>
      <div className="px-6 pt-0 pb-3 relative z-10 animate-fade-in">
        <h1 className="text-3xl font-bold text-[#2E4A4A] mb-0 tracking-tight">Account Hub</h1>
        <p className="text-[#6B7B7B] leading-relaxed text-base">Manage your account and settings.</p>
      </div>

      <div className="flex-1 flex flex-col px-6 pb-8 gap-5 relative z-10 animate-fade-in">
        {/* Developer Settings Section */}
        {!loading && settings && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] p-5 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-[#2E4A4A]">Developer Settings</h2>

            {/* Debug Enabled */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-[#2E4A4A]">Debug Mode</span>
                <p className="text-xs text-[#6B7B7B]">Enable debug features in the app</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.debug_enabled}
                onClick={() => updateSettings({ debug_enabled: !settings.debug_enabled })}
                className={cn(
                  "relative inline-flex items-center h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                  settings.debug_enabled ? "bg-[#345C5A]" : "bg-[#E3E6E6]",
                )}
              >
                <span className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                  settings.debug_enabled ? "translate-x-4" : "translate-x-0",
                )} />
              </button>
            </div>

            {/* Logging Enabled */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-[#2E4A4A]">Console Logging</span>
                <p className="text-xs text-[#6B7B7B]">Master on/off for printing logs to console</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.logging_enabled}
                onClick={() => updateSettings({ logging_enabled: !settings.logging_enabled })}
                className={cn(
                  "relative inline-flex items-center h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                  settings.logging_enabled ? "bg-[#345C5A]" : "bg-[#E3E6E6]",
                )}
              >
                <span className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                  settings.logging_enabled ? "translate-x-4" : "translate-x-0",
                )} />
              </button>
            </div>

            {/* Show Raw Payload */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-[#2E4A4A]">Show Raw Payloads</span>
                <p className="text-xs text-[#6B7B7B]">Log full objects instead of summaries</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.show_raw_payload}
                onClick={() => updateSettings({ show_raw_payload: !settings.show_raw_payload })}
                className={cn(
                  "relative inline-flex items-center h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                  settings.show_raw_payload ? "bg-[#345C5A]" : "bg-[#E3E6E6]",
                )}
              >
                <span className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                  settings.show_raw_payload ? "translate-x-4" : "translate-x-0",
                )} />
              </button>
            </div>

            {/* Log Level */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-[#2E4A4A]">Log Level</span>
                <p className="text-xs text-[#6B7B7B]">Minimum level to print</p>
              </div>
              <select
                value={settings.log_level}
                onChange={(e) => updateSettings({ log_level: e.target.value })}
                className="text-sm border border-[#E3E6E6] rounded-lg px-3 py-1.5 bg-white text-[#2E4A4A] outline-none"
              >
                <option value="silent">Silent</option>
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>

            {/* Enabled Component Logging (namespaces) */}
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-sm font-semibold text-[#2E4A4A]">Enabled Namespaces</span>
                <p className="text-xs text-[#6B7B7B]">Only these namespaces will log (empty = all)</p>
              </div>

              {/* Current tags */}
              <div className="flex flex-wrap gap-1.5">
                {settings.enabled_component_logging.map((ns) => (
                  <span key={ns} className="inline-flex items-center gap-1 bg-[#E8F1F1] border border-[#D6DEDF] text-[#2E4A4A] text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full">
                    {ns}
                    <button type="button" onClick={() => removeNamespace(ns)} className="text-[#9CA3AF] hover:text-[#2E4A4A] transition-colors ml-0.5">
                      <FontAwesomeIcon icon={faXmark} className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add custom */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newNamespace}
                  onChange={(e) => setNewNamespace(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addNamespace(newNamespace); }}
                  placeholder="Add namespace..."
                  className="flex-1 text-sm border border-[#E3E6E6] rounded-lg px-3 py-1.5 bg-white text-[#2E4A4A] outline-none placeholder:text-[#9CA3AF]"
                />
                <button
                  type="button"
                  onClick={() => addNamespace(newNamespace)}
                  disabled={!newNamespace.trim()}
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#345C5A] text-white disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
                </button>
              </div>

              {/* Quick-add suggestions */}
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_NAMESPACES.filter((ns) => !settings.enabled_component_logging.includes(ns)).map((ns) => (
                  <button
                    key={ns}
                    type="button"
                    onClick={() => addNamespace(ns)}
                    className="text-[10px] font-medium text-[#6B7B7B] border border-dashed border-[#D6DEDF] rounded-full px-2 py-0.5 hover:bg-[#F2F3F3] transition-colors"
                  >
                    + {ns}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AccountHub;
