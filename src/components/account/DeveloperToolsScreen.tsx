import { useState, useEffect } from "react";
import { useDeveloperSettings } from "@/lib/logSettings";
import { HugeiconsIcon } from "@hugeicons/react";
import { AppInput } from "@/components/ui/app-input";
import { PlusSignIcon, Cancel01Icon, ArrowRight01Icon, ArrowDown01Icon, Bug01Icon, File01Icon, SqlIcon, Tick02Icon, CreditCardIcon, Megaphone02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { AnnouncementsScreen } from "@/components/account/AnnouncementsScreen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeveloperToolsScreenProps {
  onBack: () => void;
  onTitleChange?: (title: string | null) => void;
  onNavigate?: (page: string) => void;
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

const DeveloperToolsScreen = ({ onBack, onTitleChange, onNavigate }: DeveloperToolsScreenProps) => {
  const { settings, loading, updateSettings } = useDeveloperSettings();
  const [newNs, setNewNs] = useState("");
  const [newDebugNs, setNewDebugNs] = useState("");
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  
  const [sqlTriggersOpen, setSqlTriggersOpen] = useState(false);
  const [clearingFlights, setClearingFlights] = useState(false);
  const [clearCompleteOpen, setClearCompleteOpen] = useState(false);

  const clearFlightSearchAndCache = async () => {
    setClearingFlights(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not authenticated"); return; }

      const { error: searchErr } = await supabase
        .from("flight_searches")
        .delete()
        .eq("user_id", user.id);
      if (searchErr) throw searchErr;

      const { error: cacheErr } = await supabase.functions.invoke("clear-flight-cache");
      if (cacheErr) throw cacheErr;

      setClearCompleteOpen(true);
    } catch (err: any) {
      toast.error(`Clear failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setClearingFlights(false);
    }
  };

  useEffect(() => {
    onTitleChange?.("Developer Tools");
  }, []);

  if (showAnnouncements) {
    return (
      <AnnouncementsScreen
        onBack={() => { setShowAnnouncements(false); onTitleChange?.("Developer Tools"); }}
        onTitleChange={onTitleChange}
      />
    );
  }

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
        {/* Design System */}
        <button
          type="button"
          onClick={() => onNavigate?.("design-system")}
          className="flex items-center w-full bg-white rounded-2xl shadow-sm border border-[#E3E6E6] px-4 py-3 gap-3 hover:bg-[#F8F9F9] transition-colors text-left"
        >
          <span className="h-8 w-8 rounded-lg bg-[#D1FAE5] flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={CreditCardIcon} size={15} color="#059669" strokeWidth={1.5} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#2E4A4A]">Design System</p>
            <p className="text-xs text-[#6B7B7B]">View component library and design tokens</p>
          </div>
          <HugeiconsIcon icon={ArrowRight01Icon} size={13} color="#C4CACA" strokeWidth={1.5} />
        </button>
        {/* Announcements */}
        <button
          type="button"
          onClick={() => setShowAnnouncements(true)}
          className="flex items-center w-full bg-white rounded-2xl shadow-sm border border-[#E3E6E6] px-4 py-3 gap-3 hover:bg-[#F8F9F9] transition-colors text-left"
        >
          <span className="h-8 w-8 rounded-lg bg-[#D1FAE5] flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={Megaphone02Icon} size={15} color="#059669" strokeWidth={1.5} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#2E4A4A]">Announcements</p>
            <p className="text-xs text-[#6B7B7B]">Create and manage in-app announcements</p>
          </div>
          <HugeiconsIcon icon={ArrowRight01Icon} size={13} color="#C4CACA" strokeWidth={1.5} />
        </button>

        {/* Master toggles */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          <button
            type="button"
            onClick={() => toggle("debug_enabled")}
            className="flex items-center w-full px-4 py-3 text-left hover:bg-[#F2F3F3] transition-colors"
          >
            <span className="h-8 w-8 rounded-lg bg-[#D1FAE5] flex items-center justify-center shrink-0 mr-3">
              <HugeiconsIcon icon={Bug01Icon} size={15} color="#059669" strokeWidth={1.5} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#2E4A4A]">Debug Mode</p>
              <p className="text-xs text-[#6B7B7B]">Show extra debug information</p>
            </div>
            <div className={`h-6 w-11 rounded-full relative transition-colors ${settings.debug_enabled ? "bg-[#345C5A]" : "bg-[#D1D5D5]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.debug_enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </button>
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

              <div className="flex gap-2 items-end">
                <AppInput wrapperClassName="flex-1" value={newDebugNs} onChange={(e) => setNewDebugNs(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNamespace(newDebugNs, "enabled_debug_components")} placeholder="Custom namespace..." />
                <button type="button" onClick={() => addNamespace(newDebugNs, "enabled_debug_components")} disabled={!newDebugNs.trim()} className="px-4 py-2 rounded-xl bg-[#345C5A] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40">Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Triggers */}

        {/* SQL Triggers */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          <button
            type="button"
            onClick={() => setSqlTriggersOpen((o) => !o)}
            className="flex items-center w-full px-4 py-3 gap-3 hover:bg-[#F8F9F9] transition-colors text-left"
          >
            <span className="h-8 w-8 rounded-lg bg-[#D1FAE5] flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={SqlIcon} size={15} color="#059669" strokeWidth={1.5} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#2E4A4A]">SQL Triggers</p>
              <p className="text-xs text-[#6B7B7B]">Run SQL statements for manual updates</p>
            </div>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={13}
              color="#C4CACA"
              strokeWidth={1.5}
              className={`transition-transform duration-200 ${sqlTriggersOpen ? "rotate-180" : ""}`}
            />
          </button>
          {sqlTriggersOpen && (
            <div className="border-t border-[#F0F1F1] px-4 py-3 animate-fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#2E4A4A]">Clear Flight Search & Cache</p>
                  <p className="text-xs text-[#6B7B7B]">Delete all rows in flight_searches and flight_search_cache</p>
                </div>
                <button
                  type="button"
                  onClick={clearFlightSearchAndCache}
                  disabled={clearingFlights}
                  className="shrink-0 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 min-w-[80px]"
                >
                  {clearingFlights ? (
                    <span className="flex items-center gap-1.5 justify-center">
                      <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Running
                    </span>
                  ) : "Clear"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logging master toggle */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E3E6E6] overflow-hidden">
          <button
            type="button"
            onClick={() => toggle("logging_enabled")}
            className="flex items-center w-full px-4 py-3 text-left hover:bg-[#F2F3F3] transition-colors"
          >
            <span className="h-8 w-8 rounded-lg bg-[#F2F3F3] flex items-center justify-center shrink-0 mr-3">
              <HugeiconsIcon icon={File01Icon} size={15} color="#345C5A" strokeWidth={1.5} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#2E4A4A]">Enable Logging</p>
              <p className="text-xs text-[#6B7B7B]">Master switch for all app logging</p>
            </div>
            <div className={`h-6 w-11 rounded-full relative transition-colors ${settings.logging_enabled ? "bg-[#345C5A]" : "bg-[#D1D5D5]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.logging_enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </button>
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

              <div className="flex gap-2 items-end">
                <AppInput wrapperClassName="flex-1" value={newNs} onChange={(e) => setNewNs(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNamespace(newNs, "enabled_component_logging")} placeholder="Custom namespace..." />
                <button type="button" onClick={() => addNamespace(newNs, "enabled_component_logging")} disabled={!newNs.trim()} className="px-4 py-2 rounded-xl bg-[#345C5A] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40">Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Complete Dialog */}
        <AlertDialog open={clearCompleteOpen} onOpenChange={setClearCompleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mx-auto h-12 w-12 rounded-full bg-[#345C5A]/10 flex items-center justify-center mb-2">
                <HugeiconsIcon icon={Tick02Icon} size={24} color="#345C5A" strokeWidth={1.5} />
              </div>
              <AlertDialogTitle className="text-center">Clear Complete</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Your flight search history and cache have been successfully cleared.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogAction onClick={() => setClearCompleteOpen(false)} className="bg-[#345C5A] hover:opacity-90">
                Done
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default DeveloperToolsScreen;
