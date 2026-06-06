import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  UserIcon,
  Mail01Icon,
  AirportIcon,
  Cancel01Icon,
  Rocket01Icon,
  AirplaneTakeOff01Icon,
  AirplaneSeatIcon,
  SearchingIcon,
  Location01Icon,
  Location04Icon,
  AddCircleIcon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { AppInput } from "@/components/ui/app-input";
import { AirportSearchSheet, type Airport } from "@/components/AirportSearchSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  GOWILD_STATUS_OPTIONS,
  GOWILD_PASS_DURATION_OPTIONS,
  GOWILD_SEARCH_FREQUENCY_OPTIONS,
  FRONTIER_FLIGHT_FREQUENCY_OPTIONS,
  USES_GOWILD_SEARCH_TOOL_OPTIONS,
  BETA_TESTING_EXPERIENCE_OPTIONS,
  PRIMARY_DEVICE_OPTIONS,
  PREFERRED_FEEDBACK_METHOD_OPTIONS,
  type BetaSignupOption,
} from "@/constants/betaSignup";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<
  | "fullName" | "email" | "homeAirport"
  | "gowildStatus" | "gowildPassDuration"
  | "gowildSearchFrequency" | "frontierFlightFrequency"
  | "usesGowildSearchTool"
  | "betaTestingExperience" | "betaTestingDetails"
  | "feedbackCommitment" | "primaryDevice",
  string
>>;

type StepStatus = "pending" | "complete" | "error";
type Phase = "landing" | "form" | "success";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOTAL_STEPS = 7;

const STEP_META: { label: string; short: string; icon: IconSvgElement; desc: string }[] = [
  { label: "About You",              short: "You",      icon: UserIcon,             desc: "Basic info so we know who you are." },
  { label: "GoWild Pass",            short: "GoWild",   icon: AirplaneTakeOff01Icon, desc: "Tell us about your GoWild Pass status." },
  { label: "Travel Behavior",        short: "Travel",   icon: SearchingIcon,        desc: "How often you search and book flights." },
  { label: "Current Tools",          short: "Tools",    icon: AirportIcon,          desc: "What you use today to find GoWild deals." },
  { label: "Beta Testing",           short: "Beta",     icon: UserAdd01Icon,        desc: "Your experience testing apps or products." },
  { label: "Availability & Device",  short: "Device",   icon: AirplaneSeatIcon,     desc: "How you'll access Wildfly and give feedback." },
  { label: "Optional",               short: "Optional", icon: Location01Icon,       desc: "Extra context to help us understand your needs." },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function OptionPills({
  options, value, onChange, allowDeselect = false,
}: {
  options: BetaSignupOption[];
  value: string;
  onChange: (v: string) => void;
  allowDeselect?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup">
      {options.map((opt) => {
        const sel = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => (allowDeselect && sel ? onChange("") : onChange(opt.value))}
            className={[
              "w-full text-center px-3 py-3.5 min-h-[48px] rounded-xl text-sm border transition-all leading-snug flex items-center justify-center",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-1",
              sel
                ? "bg-[#F0FDF4] border-[#059669] text-[#059669] font-semibold"
                : "bg-white border-[#E5E7EB] text-[#374151] font-medium hover:border-[#6EE7B7] hover:bg-[#FAFAFA]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}


function FormQuestion({
  label, htmlFor, required, error, fieldId, children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  fieldId?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={fieldId} role={htmlFor ? undefined : "group"} aria-label={htmlFor ? undefined : label}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-[#2E4A4A] block mb-2.5 leading-snug">
        {label}
        {required && <span className="text-red-400 ml-0.5" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-red-400 text-xs mt-2 font-semibold flex items-center gap-1">
          <svg aria-hidden="true" className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

function textareaCls(error?: string): string {
  return [
    "w-full px-4 py-3 rounded-xl border bg-white text-base text-[#374151]",
    "placeholder-[#9CA3AF] focus:outline-none resize-none transition-all focus:ring-2",
    error
      ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
      : "border-[#E5E7EB] focus:border-[#059669] focus:ring-[#059669]/10",
  ].join(" ");
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <p role="alert" className="text-red-400 text-xs mt-2 font-semibold flex items-center gap-1">
      <svg aria-hidden="true" className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
      {msg}
    </p>
  );
}


// ── Airport popup (modal variant for BetaSignup) ──────────────────────────────

function AirportPopup({ open, onClose, airports, onSelect }: {
  open: boolean;
  onClose: () => void;
  airports: Airport[];
  onSelect: (airport: Airport) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => { setTimeout(() => inputRef.current?.focus(), 50); });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const shouldShow = query.trim().length >= 2;

  const groupedAirports = useMemo(() => {
    if (!shouldShow) return {} as Record<string, Airport[]>;
    const q = query.toLowerCase();
    const filtered = airports.filter(
      (a) => a.name.toLowerCase().includes(q) ||
        a.iata_code.toLowerCase().includes(q) ||
        (a.locations?.city && a.locations.city.toLowerCase().includes(q))
    ).slice(0, 40);
    const grouped = filtered.reduce((acc, airport) => {
      const city = airport.locations?.city;
      const state = airport.locations?.state_code;
      const key = city && state ? `${city}, ${state}` : "Other Locations";
      if (!acc[key]) acc[key] = [];
      acc[key].push(airport);
      return acc;
    }, {} as Record<string, Airport[]>);
    return Object.fromEntries(
      Object.entries(grouped).map(([key, aps]) => [aps.length > 1 ? key : `__single__${key}`, aps])
    );
  }, [query, airports, shouldShow]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" style={{ height: "520px" }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F0F1F1]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
              <HugeiconsIcon icon={Location01Icon} size={15} color="white" strokeWidth={2} />
            </div>
            <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">Select Airport</h2>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors">
            <HugeiconsIcon icon={AddCircleIcon} size={18} color="currentColor" strokeWidth={2} className="rotate-45" />
          </button>
        </div>
        <div className="px-5 pb-4 pt-3">
          <div className="app-input-container">
            <button type="button" tabIndex={-1} className="app-input-icon-btn">
              <HugeiconsIcon icon={Location01Icon} size={20} color="currentColor" strokeWidth={2} />
            </button>
            <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search airport or city…" className="app-input"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
            {query.length > 0 && (
              <button type="button" onClick={() => setQuery("")} className="app-input-reset app-input-reset--visible">
                <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {!shouldShow ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-5">
              <div className="h-16 w-16 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-5">
                <HugeiconsIcon icon={AirportIcon} size={28} color="#059669" strokeWidth={2} />
              </div>
              <p className="text-[#2E4A4A] font-bold text-base mb-1">Search for an airport</p>
              <p className="text-[#9CA3AF] text-sm">Type 2 or more letters to see results</p>
            </div>
          ) : Object.keys(groupedAirports).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <p className="text-[#2E4A4A] font-bold text-base mb-1">No airports found</p>
              <p className="text-[#9CA3AF] text-sm">Try a different city or airport code</p>
            </div>
          ) : (
            <div className="py-3 px-4">
              {Object.entries(groupedAirports).map(([cityGroup, cityAirports]) => {
                const isSingle = cityGroup.startsWith("__single__");
                const displayGroup = isSingle ? cityGroup.replace("__single__", "") : cityGroup;
                return (
                  <div key={cityGroup} className="mb-2 last:mb-0">
                    {!isSingle && (
                      <div className="w-full px-5 py-3 text-sm font-bold text-[#6B7B7B] uppercase tracking-wider flex items-center gap-2">
                        <HugeiconsIcon icon={Location04Icon} size={20} color="currentColor" strokeWidth={2} className="opacity-60" />
                        {displayGroup !== "Other Locations" ? `${displayGroup} Area` : displayGroup}
                      </div>
                    )}
                    {cityAirports.map((a, idx) => (
                      <div key={a.id}>
                        {idx > 0 && <div className="border-t border-[#F0F1F1] mx-1" />}
                        <button type="button" onClick={() => { onSelect(a); onClose(); }}
                          className={cn("w-full text-left pr-4 py-1.5 text-base hover:bg-[#F2F3F3] active:bg-[#E8F5F0] transition-colors flex items-center gap-3 overflow-hidden", isSingle ? "pl-4" : "pl-14")}>
                          <HugeiconsIcon icon={AirportIcon} size={22} color="#6B7B7B" strokeWidth={2} className="shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#345C5A] text-sm shrink-0">{a.iata_code}</span>
                              <span className="text-[#9CA3AF] text-xs shrink-0">•</span>
                              <span className="text-[#2E4A4A] truncate text-sm font-medium">{a.name}</span>
                            </div>
                            {a.locations?.city && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F2F3F3] text-[#6B7B7B] text-xs font-medium mt-0.5">
                                <HugeiconsIcon icon={Location01Icon} size={10} color="currentColor" strokeWidth={2} />
                                <span className="truncate">{a.locations.city}{a.locations.state_code ? `, ${a.locations.state_code}` : ""}</span>
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          <div className="h-10" />
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Multi-select airport popup ────────────────────────────────────────────────

function MultiAirportPopup({ open, onClose, airports, selected, onToggle }: {
  open: boolean;
  onClose: () => void;
  airports: Airport[];
  selected: Airport[];
  onToggle: (airport: Airport) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => { setTimeout(() => inputRef.current?.focus(), 50); });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const shouldShow = query.trim().length >= 2;

  const groupedAirports = useMemo(() => {
    if (!shouldShow) return {} as Record<string, Airport[]>;
    const q = query.toLowerCase();
    const filtered = airports.filter(
      (a) => a.name.toLowerCase().includes(q) ||
        a.iata_code.toLowerCase().includes(q) ||
        (a.locations?.city && a.locations.city.toLowerCase().includes(q))
    ).slice(0, 40);
    const grouped = filtered.reduce((acc, airport) => {
      const city = airport.locations?.city;
      const state = airport.locations?.state_code;
      const key = city && state ? `${city}, ${state}` : "Other Locations";
      if (!acc[key]) acc[key] = [];
      acc[key].push(airport);
      return acc;
    }, {} as Record<string, Airport[]>);
    return Object.fromEntries(
      Object.entries(grouped).map(([key, aps]) => [aps.length > 1 ? key : `__single__${key}`, aps])
    );
  }, [query, airports, shouldShow]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" style={{ height: "520px" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F0F1F1]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
              <HugeiconsIcon icon={Location01Icon} size={15} color="white" strokeWidth={2} />
            </div>
            <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">Select Destinations</h2>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors">
            <HugeiconsIcon icon={AddCircleIcon} size={18} color="currentColor" strokeWidth={2} className="rotate-45" />
          </button>
        </div>
        {/* Search input */}
        <div className="px-5 pt-3 pb-2">
          <div className="app-input-container">
            <button type="button" tabIndex={-1} className="app-input-icon-btn">
              <HugeiconsIcon icon={Location01Icon} size={20} color="currentColor" strokeWidth={2} />
            </button>
            <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search airport or city…" className="app-input"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
            {query.length > 0 && (
              <button type="button" onClick={() => setQuery("")} className="app-input-reset app-input-reset--visible">
                <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
        {/* Selected chips — below search input */}
        {selected.length > 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-1.5">
            {selected.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0FDF4] border border-[#059669]/30 text-xs font-semibold text-[#059669]">
                {a.iata_code}
                <button type="button" onClick={() => onToggle(a)} className="opacity-70 hover:opacity-100">
                  <HugeiconsIcon icon={AddCircleIcon} size={12} color="currentColor" strokeWidth={2} className="rotate-45" />
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Results */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {!shouldShow ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-5">
              <div className="h-16 w-16 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-4">
                <HugeiconsIcon icon={AirportIcon} size={28} color="#059669" strokeWidth={2} />
              </div>
              <p className="text-[#2E4A4A] font-bold text-base mb-1">Search for airports</p>
              <p className="text-[#9CA3AF] text-sm">Type 2 or more letters to see results</p>
            </div>
          ) : Object.keys(groupedAirports).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <p className="text-[#2E4A4A] font-bold text-base mb-1">No airports found</p>
              <p className="text-[#9CA3AF] text-sm">Try a different city or airport code</p>
            </div>
          ) : (
            <div className="py-3 px-4">
              {Object.entries(groupedAirports).map(([cityGroup, cityAirports]) => {
                const isSingle = cityGroup.startsWith("__single__");
                const displayGroup = isSingle ? cityGroup.replace("__single__", "") : cityGroup;
                return (
                  <div key={cityGroup} className="mb-2 last:mb-0">
                    {!isSingle && (
                      <div className="w-full px-5 py-3 text-sm font-bold text-[#6B7B7B] uppercase tracking-wider flex items-center gap-2">
                        <HugeiconsIcon icon={Location04Icon} size={20} color="currentColor" strokeWidth={2} className="opacity-60" />
                        {displayGroup !== "Other Locations" ? `${displayGroup} Area` : displayGroup}
                      </div>
                    )}
                    {cityAirports.map((a, idx) => {
                      const isSel = selected.some((s) => s.id === a.id);
                      return (
                        <div key={a.id}>
                          {idx > 0 && <div className="border-t border-[#F0F1F1] mx-1" />}
                          <button type="button" onClick={() => { onToggle(a); setQuery(""); }}
                            className={cn(
                              "w-full text-left pr-4 py-1.5 text-base transition-colors flex items-center gap-3 overflow-hidden",
                              isSingle ? "pl-4" : "pl-14",
                              isSel ? "bg-[#F0FDF4]" : "hover:bg-[#F2F3F3] active:bg-[#E8F5F0]"
                            )}>
                            <HugeiconsIcon icon={AirportIcon} size={22} color={isSel ? "#059669" : "#6B7B7B"} strokeWidth={2} className="shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("font-bold text-sm shrink-0", isSel ? "text-[#059669]" : "text-[#345C5A]")}>{a.iata_code}</span>
                                <span className="text-[#9CA3AF] text-xs shrink-0">•</span>
                                <span className="text-[#2E4A4A] truncate text-sm font-medium">{a.name}</span>
                              </div>
                              {a.locations?.city && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F2F3F3] text-[#6B7B7B] text-xs font-medium mt-0.5">
                                  <HugeiconsIcon icon={Location01Icon} size={10} color="currentColor" strokeWidth={2} />
                                  <span className="truncate">{a.locations.city}{a.locations.state_code ? `, ${a.locations.state_code}` : ""}</span>
                                </span>
                              )}
                            </div>
                            {isSel && (
                              <div className="h-5 w-5 rounded-full bg-[#059669] flex items-center justify-center shrink-0">
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* Footer — Done button */}
        <div className="px-4 py-3 border-t border-[#F0F1F1] flex justify-end">
          <button type="button" onClick={onClose}
            className="px-5 py-1.5 rounded-full bg-[#059669] text-white text-xs font-bold hover:bg-[#047857] transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── BetaSignup ────────────────────────────────────────────────────────────────

export default function BetaSignup() {
  const isMobile = useIsMobile();
  const [phase, setPhase] = useState<Phase>("landing");
  const [heroExiting, setHeroExiting] = useState(false);
  const [step, setStep] = useState(1);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(Array(TOTAL_STEPS).fill("pending") as StepStatus[]);
  const [stepVisible, setStepVisible] = useState(true);
  const [isDuplicate, setIsDuplicate] = useState(false);

  // Form fields — required
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [homeAirport, setHomeAirport] = useState("");
  const [gowildStatus, setGowildStatus] = useState("");
  const [gowildPassDuration, setGowildPassDuration] = useState("");
  const [gowildSearchFrequency, setGowildSearchFrequency] = useState("");
  const [frontierFlightFrequency, setFrontierFlightFrequency] = useState("");
  const [usesGowildSearchTool, setUsesGowildSearchTool] = useState("");
  const [betaTestingExperience, setBetaTestingExperience] = useState("");
  const [betaTestingDetails, setBetaTestingDetails] = useState("");
  const [feedbackCommitment, setFeedbackCommitment] = useState(false);
  const [primaryDevice, setPrimaryDevice] = useState("");

  // Form fields — optional
  const [frequentDestinations, setFrequentDestinations] = useState<Airport[]>([]);
  const [freqDestOpen, setFreqDestOpen] = useState(false);
  const [valueExpectation, setValueExpectation] = useState("");
  const [preferredFeedbackMethod, setPreferredFeedbackMethod] = useState("");

  // Honeypot
  const [website, setWebsite] = useState("");

  // Airport
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [airportSheetOpen, setAirportSheetOpen] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const showPassDuration = gowildStatus === "current_pass_holder" || gowildStatus === "former_pass_holder";
  const showBetaDetails = betaTestingExperience === "yes_professional" || betaTestingExperience === "informal";

  const [subStep, setSubStep] = useState(0);
  const [subStepVisible, setSubStepVisible] = useState(true);


  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("airports")
        .select("id, name, iata_code, location_id, locations(city, state_code, region)")
        .eq("is_active", true)
        .order("name");
      if (data) setAirports(data as unknown as Airport[]);
    })();
  }, []);

  function clearError(...keys: (keyof FormErrors)[]) {
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  }

  function validateStep(s: number): FormErrors {
    const e: FormErrors = {};
    if (s === 1) {
      if (!fullName.trim()) e.fullName = "Full name is required.";
      const et = email.trim();
      if (!et) e.email = "Email address is required.";
      else if (!EMAIL_RE.test(et)) e.email = "Please enter a valid email address.";
      if (!homeAirport.trim()) e.homeAirport = "Home airport is required.";
    } else if (s === 2) {
      if (!gowildStatus) e.gowildStatus = "Please select an option.";
      if (showPassDuration && !gowildPassDuration) e.gowildPassDuration = "Please select how long you've had the GoWild Pass.";
    } else if (s === 3) {
      if (!gowildSearchFrequency) e.gowildSearchFrequency = "Please select an option.";
      if (!frontierFlightFrequency) e.frontierFlightFrequency = "Please select an option.";
    } else if (s === 4) {
      if (!usesGowildSearchTool) e.usesGowildSearchTool = "Please select an option.";
    } else if (s === 5) {
      if (!betaTestingExperience) e.betaTestingExperience = "Please select an option.";
      if (showBetaDetails && !betaTestingDetails.trim()) e.betaTestingDetails = "Please describe your beta testing experience.";
    } else if (s === 6) {
      if (!feedbackCommitment) e.feedbackCommitment = "You must agree to provide feedback to apply.";
      if (!primaryDevice) e.primaryDevice = "Please select your primary device.";
    }
    return e;
  }

  function advanceSubStep() {
    setSubStepVisible(false);
    setTimeout(() => { setSubStep((s) => s + 1); setSubStepVisible(true); }, 180);
  }

  function handleNext() {
    // Step 6 sub-step 0: validate checkbox before advancing to device question
    if (step === 6 && subStep === 0) {
      if (!feedbackCommitment) { setErrors({ feedbackCommitment: "You must agree to provide feedback to apply." }); return; }
      setErrors({});
      setSubStepVisible(false);
      setTimeout(() => { setSubStep(1); setSubStepVisible(true); }, 180);
      return;
    }
    // Step 7 sub-steps 0–3: advance through optional fields (no validation needed)
    if (step === TOTAL_STEPS && subStep < 2) {
      setSubStepVisible(false);
      setTimeout(() => { setSubStep((s) => s + 1); setSubStepVisible(true); }, 180);
      return;
    }
    // Normal main-step advance
    const errs = validateStep(step);
    const hasErrors = Object.keys(errs).length > 0;
    const next = [...stepStatuses] as StepStatus[];
    next[step - 1] = hasErrors ? "error" : "complete";
    setStepStatuses(next);
    if (hasErrors) { setErrors(errs); return; }
    setErrors({});
    setStepVisible(false);
    setSubStepVisible(false);
    setTimeout(() => { setStep((s) => s + 1); setSubStep(0); setStepVisible(true); setSubStepVisible(true); }, 180);
  }

  function handleBack() {
    setErrors({});
    if (subStep > 0) {
      setSubStepVisible(false);
      setTimeout(() => { setSubStep((s) => s - 1); setSubStepVisible(true); }, 180);
    } else {
      setStepVisible(false);
      setSubStepVisible(false);
      setTimeout(() => { setStep((s) => s - 1); setSubStep(0); setStepVisible(true); setSubStepVisible(true); }, 180);
    }
  }

  function openForm() {
    setHeroExiting(true);
    setTimeout(() => {
      setHeroExiting(false);
      setSubStep(0);
      setPhase("form");
    }, 280);
  }

  function resetAll() {
    setFullName(""); setEmail(""); setHomeAirport(""); setSelectedAirport(null);
    setGowildStatus(""); setGowildPassDuration("");
    setGowildSearchFrequency(""); setFrontierFlightFrequency("");
    setUsesGowildSearchTool("");
    setBetaTestingExperience(""); setBetaTestingDetails("");
    setFeedbackCommitment(false); setPrimaryDevice("");
    setFrequentDestinations([]);
    setValueExpectation(""); setPreferredFeedbackMethod("");
    setWebsite(""); setErrors({});
    setStepStatuses(Array(TOTAL_STEPS).fill("pending") as StepStatus[]);
    setStep(1); setSubStep(0); setIsDuplicate(false);
    setPhase("landing");
  }

  async function handleSubmit() {
    if (website.trim() !== "") { setPhase("success"); return; }
    setSubmitting(true);
    const params = new URLSearchParams(window.location.search);
    // TODO: Remove cast after running `supabase gen types typescript` to include beta_applications.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("beta_applications") as any).insert({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      home_airport: homeAirport.trim(),
      gowild_status: gowildStatus,
      gowild_pass_duration: showPassDuration ? gowildPassDuration || null : null,
      gowild_search_frequency: gowildSearchFrequency,
      frontier_flight_frequency: frontierFlightFrequency,
      uses_gowild_search_tool: usesGowildSearchTool,
      beta_testing_experience: betaTestingExperience,
      beta_testing_details: showBetaDetails ? betaTestingDetails.trim() || null : null,
      feedback_commitment: feedbackCommitment,
      primary_device: primaryDevice,
      preferred_feedback_method: preferredFeedbackMethod || null,
      frequent_destinations: frequentDestinations.length > 0 ? frequentDestinations.map((a) => a.iata_code).join(", ") : null,
      value_expectation: valueExpectation.trim() || null,
      source: params.get("source") || "public_beta_page",
      utm_source: params.get("utm_source") || null,
      utm_medium: params.get("utm_medium") || null,
      utm_campaign: params.get("utm_campaign") || null,
      referrer: document.referrer || null,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") { setIsDuplicate(true); setPhase("success"); return; }
      toast.error("Something went wrong submitting your application. Please try again.");
      return;
    }
    setPhase("success");
  }

  // ── Step content ──────────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 1: return (
        <div className="flex flex-col gap-5">
          <div id="field-fullName">
            <AppInput icon={UserIcon} label="Full Name *" placeholder="Your full name"
              value={fullName} onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
              autoComplete="name" maxLength={120} error={errors.fullName} />
          </div>
          <div id="field-email">
            <AppInput icon={Mail01Icon} label="Email Address *" placeholder="your@email.com" type="email"
              value={email} onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
              autoComplete="email" maxLength={254} error={errors.email} />
          </div>
          <div id="field-homeAirport">
            {isMobile
              ? <AirportSearchSheet open={airportSheetOpen} onClose={() => setAirportSheetOpen(false)}
                  airports={airports}
                  onSelect={(a) => { setSelectedAirport(a); setHomeAirport(a.iata_code); clearError("homeAirport"); }} />
              : <AirportPopup open={airportSheetOpen} onClose={() => setAirportSheetOpen(false)}
                  airports={airports}
                  onSelect={(a) => { setSelectedAirport(a); setHomeAirport(a.iata_code); clearError("homeAirport"); }} />
            }
            <label className="text-sm font-semibold text-[#6B7B7B] ml-1 block">
              Home Airport <span className="text-red-400" aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </label>
            <div
              className={["app-input-container cursor-pointer", errors.homeAirport ? "app-input-error" : ""].join(" ")}
              onClick={() => setAirportSheetOpen(true)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAirportSheetOpen(true); }}
              aria-label="Select home airport" aria-invalid={errors.homeAirport ? "true" : undefined}>
              <button type="button" tabIndex={-1} className="app-input-icon-btn">
                <HugeiconsIcon icon={AirportIcon} size={20} color="currentColor" strokeWidth={2} />
              </button>
              <span className="app-input truncate flex-1 flex items-center" style={{ color: selectedAirport ? "#1F2937" : "#9CA3AF" }}>
                {selectedAirport ? `${selectedAirport.iata_code} – ${selectedAirport.name}` : "Search airport or city…"}
              </span>
              {selectedAirport && (
                <button type="button" className="app-input-reset app-input-reset--visible"
                  onClick={(e) => { e.stopPropagation(); setSelectedAirport(null); setHomeAirport(""); }}>
                  <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
                </button>
              )}
            </div>
            {errors.homeAirport && (
              <p role="alert" className="text-red-400 text-xs mt-2 ml-1 font-semibold flex items-center gap-1">
                <svg aria-hidden="true" className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                {errors.homeAirport}
              </p>
            )}
          </div>
        </div>
      );

      case 2:
        if (subStep === 0) return (
          <FormQuestion label="Are you currently a Frontier GoWild Pass holder?" required error={errors.gowildStatus} fieldId="field-gowildStatus">
            <OptionPills options={GOWILD_STATUS_OPTIONS} value={gowildStatus}
              onChange={(v) => {
                setGowildStatus(v); setGowildPassDuration(""); clearError("gowildStatus", "gowildPassDuration");
                if (v === "current_pass_holder" || v === "former_pass_holder") advanceSubStep();
              }} />
          </FormQuestion>
        );
        return (
          <FormQuestion label="How long have you had or did you have the GoWild Pass?" required error={errors.gowildPassDuration} fieldId="field-gowildPassDuration">
            <OptionPills options={GOWILD_PASS_DURATION_OPTIONS} value={gowildPassDuration}
              onChange={(v) => { setGowildPassDuration(v); clearError("gowildPassDuration"); }} />
          </FormQuestion>
        );

      case 3:
        if (subStep === 0) return (
          <FormQuestion label="How often do you search for GoWild flights?" required error={errors.gowildSearchFrequency} fieldId="field-gowildSearchFrequency">
            <OptionPills options={GOWILD_SEARCH_FREQUENCY_OPTIONS} value={gowildSearchFrequency}
              onChange={(v) => { setGowildSearchFrequency(v); clearError("gowildSearchFrequency"); advanceSubStep(); }} />
          </FormQuestion>
        );
        return (
          <FormQuestion label="How often do you fly Frontier?" required error={errors.frontierFlightFrequency} fieldId="field-frontierFlightFrequency">
            <OptionPills options={FRONTIER_FLIGHT_FREQUENCY_OPTIONS} value={frontierFlightFrequency}
              onChange={(v) => { setFrontierFlightFrequency(v); clearError("frontierFlightFrequency"); }} />
          </FormQuestion>
        );

      case 4: return (
          <FormQuestion label="Do you currently use any Frontier GoWild search app, tool, spreadsheet, alert system, or website?" required error={errors.usesGowildSearchTool} fieldId="field-usesGowildSearchTool">
            <OptionPills options={USES_GOWILD_SEARCH_TOOL_OPTIONS} value={usesGowildSearchTool}
              onChange={(v) => {
                setUsesGowildSearchTool(v); clearError("usesGowildSearchTool");
              }} />
          </FormQuestion>
        );

      case 5:
        if (subStep === 0) return (
          <FormQuestion label="Have you ever professionally contributed to a beta testing program?" required error={errors.betaTestingExperience} fieldId="field-betaTestingExperience">
            <OptionPills options={BETA_TESTING_EXPERIENCE_OPTIONS} value={betaTestingExperience}
              onChange={(v) => {
                setBetaTestingExperience(v); setBetaTestingDetails(""); clearError("betaTestingExperience", "betaTestingDetails");
                if (v === "yes_professional" || v === "informal") advanceSubStep();
              }} />
          </FormQuestion>
        );
        return (
          <div id="field-betaTestingDetails">
            <label htmlFor="betaTestingDetails" className="text-sm font-semibold text-[#2E4A4A] block mb-2 leading-snug">
              What company, product, app, or business sector did you beta test for?
              <span className="text-red-400 ml-0.5">*</span>
            </label>
            <textarea id="betaTestingDetails" value={betaTestingDetails} rows={3} maxLength={500}
              onChange={(e) => { setBetaTestingDetails(e.target.value); clearError("betaTestingDetails"); }}
              placeholder="Tell us about your experience…" className={textareaCls(errors.betaTestingDetails)} />
            {errors.betaTestingDetails && <ErrorLine msg={errors.betaTestingDetails} />}
          </div>
        );

      case 6:
        if (subStep === 0) return (
          <div id="field-feedbackCommitment">
            <p className="text-sm font-semibold text-[#2E4A4A] mb-3 leading-snug">
              Are you willing to provide honest feedback, report bugs, and answer occasional follow-up questions?
              <span className="text-red-400 ml-0.5">*</span>
            </p>
            <button type="button"
              onClick={() => {
                const next = !feedbackCommitment;
                setFeedbackCommitment(next);
                clearError("feedbackCommitment");
                if (next) advanceSubStep();
              }}
              role="checkbox" aria-checked={feedbackCommitment}
              className="flex items-start gap-3 text-left w-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2 rounded-lg">
              <div className={["mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
                feedbackCommitment ? "bg-[#059669] border-[#059669]"
                : errors.feedbackCommitment ? "bg-white border-red-400"
                : "bg-white border-[#D1D5DB] group-hover:border-[#6EE7B7]"].join(" ")}>
                {feedbackCommitment && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-[#374151] leading-snug pt-0.5">
                I'm willing to provide honest feedback, report bugs, and answer occasional follow-up questions.
              </span>
            </button>
            {errors.feedbackCommitment && (
              <p role="alert" className="text-red-400 text-xs mt-2 ml-8 font-semibold flex items-center gap-1">
                <svg aria-hidden="true" className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                {errors.feedbackCommitment}
              </p>
            )}
          </div>
        );
        return (
          <FormQuestion label="What device would you primarily use Wildfly on?" required error={errors.primaryDevice} fieldId="field-primaryDevice">
            <OptionPills options={PRIMARY_DEVICE_OPTIONS} value={primaryDevice}
              onChange={(v) => { setPrimaryDevice(v); clearError("primaryDevice"); }} />
          </FormQuestion>
        );

      case 7:
        if (subStep === 0) return (
          <div>
            <MultiAirportPopup
              open={freqDestOpen}
              onClose={() => setFreqDestOpen(false)}
              airports={airports}
              selected={frequentDestinations}
              onToggle={(a) => setFrequentDestinations((prev) =>
                prev.some((x) => x.id === a.id) ? prev.filter((x) => x.id !== a.id) : [...prev, a]
              )}
            />
            <label className="text-sm font-semibold text-[#6B7B7B] ml-1 block mb-1">
              Which destinations do you search most often?
            </label>
            <div
              className="app-input-container cursor-pointer min-h-[46px] h-auto flex-wrap py-2"
              onClick={() => setFreqDestOpen(true)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFreqDestOpen(true); }}
              aria-label="Select frequent destinations"
            >
              <button type="button" tabIndex={-1} className="app-input-icon-btn self-start mt-0.5">
                <HugeiconsIcon icon={AirportIcon} size={20} color="currentColor" strokeWidth={2} />
              </button>
              {frequentDestinations.length === 0 ? (
                <span className="app-input flex-1 flex items-center" style={{ color: "#9CA3AF" }}>
                  Search airports or cities…
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5 flex-1 py-0.5 pl-1.5">
                  {frequentDestinations.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0FDF4] border border-[#059669]/30 text-xs font-semibold text-[#059669]">
                      {a.iata_code}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFrequentDestinations((prev) => prev.filter((x) => x.id !== a.id)); }}
                        className="opacity-70 hover:opacity-100"
                      >
                        <HugeiconsIcon icon={AddCircleIcon} size={12} color="currentColor" strokeWidth={2} className="rotate-45" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
        if (subStep === 1) return (
          <div>
            <label htmlFor="valueExpectation" className="text-sm font-semibold text-[#2E4A4A] block mb-2 leading-snug">
              What would make Wildfly valuable enough for you to keep using?
            </label>
            <textarea id="valueExpectation" value={valueExpectation} rows={4} maxLength={1000}
              onChange={(e) => setValueExpectation(e.target.value)}
              placeholder="What problem would Wildfly need to solve for you?" className={textareaCls()} />
          </div>
        );
        if (subStep === 2) return (
          <FormQuestion label="How would you prefer to give feedback?" htmlFor="preferredFeedbackMethod">
            <OptionPills options={PREFERRED_FEEDBACK_METHOD_OPTIONS} value={preferredFeedbackMethod}
              onChange={setPreferredFeedbackMethod} allowDeselect />
          </FormQuestion>
        );

      default: return null;
    }
  }

  // ── Progress bar ──────────────────────────────────────────────────────────────

  function renderProgress() {
    return (
      <div className="flex justify-center pb-4">
        <div
          className="flex gap-1.5 rounded-full px-3 py-2"
          style={{
            background: "rgba(243,244,246,1.0)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {STEP_META.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                i < step
                  ? "bg-[#10B981]"
                  : stepStatuses[i] === "error"
                  ? "bg-red-400"
                  : "bg-[#DDE0E0]"
              }`}
              style={{ minWidth: "20px" }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const BENEFIT_CARDS: { icon: IconSvgElement; title: string; desc: string }[] = [
    { icon: Rocket01Icon, title: "Early Access", desc: "Try new features before public release." },
    { icon: AirplaneSeatIcon, title: "Direct Feedback", desc: "Help identify bugs and missing features." },
    { icon: AirportIcon, title: "Better GoWild Tools", desc: "Shape tools built for GoWild travelers." },
  ];

  return (
    <div className="min-h-screen pb-20 overflow-x-hidden" style={{ backgroundImage: "url('/assets/backgrounds/betasignupbkg.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      <div className="max-w-2xl mx-auto px-5 pt-8 sm:pt-12">

        {/* ── Landing ─────────────────────────────────────────────────────── */}
        {phase === "landing" && (
          <div className={`transition-all duration-280 ease-in ${heroExiting ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0 animate-in fade-in slide-in-from-bottom-2 duration-500"}`}>
            <div className="flex flex-col items-center text-center mb-5">
              <img src="/assets/logo/logo_horizontal.png" alt="Wildfly" className="w-auto object-contain mb-1" style={{ height: "clamp(72px, 18vw, 110px)" }} />
              <img src="/assets/logo/tag_noshadow.png" alt="Wildfly tagline" className="w-auto object-contain mb-4" style={{ height: "clamp(22px, 5.5vw, 40px)" }} />
              <h1 className="text-2xl sm:text-3xl font-black text-[#1A2E2E] mb-2 leading-tight">
                Help Shape the Future of Wildfly
              </h1>
              <p className="text-sm text-[#6B7B7B] max-w-lg leading-relaxed">
                Apply to become a Wildfly beta tester and help improve the way GoWild travelers
                find availability, track flights, and discover better travel opportunities.
              </p>
            </div>

            <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3 mb-5">
              {BENEFIT_CARDS.map(({ icon, title, desc }) => (
                <div key={title} className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-[#F0F1F1]">
                  <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center">
                    <HugeiconsIcon icon={icon} size={20} color="#059669" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#2E4A4A] mb-0.5">{title}</h3>
                    <p className="text-xs text-[#6B7B7B] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center mb-10 mt-3">
              <button
                type="button"
                onClick={openForm}
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm tracking-wide shadow-lg hover:shadow-xl active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
              >
                <HugeiconsIcon icon={UserAdd01Icon} size={18} color="white" strokeWidth={2} />
                Start Application
              </button>
            </div>
          </div>
        )}

        {/* ── Form ────────────────────────────────────────────────────────── */}
        {phase === "form" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Logo above the form card */}
            <div className="flex justify-center mb-4">
              <img src="/assets/logo/logo_horizontal.png" alt="Wildfly" className="w-auto object-contain" style={{ height: "clamp(48px, 12vw, 70px)" }} />
            </div>

            {/* Honeypot */}
            <div aria-hidden="true" style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, width: 0, overflow: "hidden" }}>
              <label htmlFor="hp-website">Website</label>
              <input id="hp-website" name="website" type="text" value={website}
                onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>

            {/* Parent form card */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#F0F1F1] overflow-hidden mb-10">

              {/* Consistent header */}
              <div className="px-5 pt-5 pb-4">
                <h2 className="text-xl font-black text-[#1A2E2E]">Beta Tester Application</h2>
              </div>

              {/* Progress bar */}
              {renderProgress()}

              {/* Section name — animates with each step */}
              <div className={`flex flex-col items-center gap-1 px-5 pb-5 transition-all duration-180 ${stepVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-0.5 rounded-full bg-[#059669]" />
                  <p className="text-xl font-bold text-[#1A2E2E]">{STEP_META[step - 1].label}</p>
                  <div className="w-3 h-0.5 rounded-full bg-[#059669]" />
                </div>
                <p className="text-xs text-[#9CA3AF] font-medium">{STEP_META[step - 1].desc}</p>
              </div>

              {/* Step content — animates on both step and sub-step transitions */}
              <div className={`px-5 pb-6 sm:px-6 sm:pb-7 transition-all duration-180 ${subStepVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
                {renderStep()}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-3 px-5 pb-5">
                {(step > 1 || subStep > 0) && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 py-3.5 rounded-full border-2 border-[#E5E7EB] text-[#6B7280] font-bold text-sm hover:border-[#059669] hover:text-[#059669] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
                  >
                    ← Back
                  </button>
                )}
                {step < TOTAL_STEPS || (step === TOTAL_STEPS && subStep < 2) ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-[2] py-3.5 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm tracking-wide shadow hover:shadow-md active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-[2] py-3.5 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-sm tracking-wide shadow hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg aria-hidden="true" className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Submitting…
                      </span>
                    ) : "Submit Application"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Success modal ────────────────────────────────────────────────── */}
        {phase === "success" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
              <div className="px-6 py-10 flex flex-col items-center text-center">
                <div className="mb-7">
                  <img src="/assets/backgrounds/BetaSignupSuccess.png" alt="" className="h-24 w-auto object-contain" />
                </div>

                <h2 className="text-2xl font-black text-[#1A2E2E] mb-2 leading-tight">
                  {isDuplicate ? "Already Applied!" : "Thanks for applying!"}
                </h2>

                {isDuplicate ? (
                  <p className="text-sm text-[#6B7B7B] leading-relaxed mb-8">
                    Looks like you already applied. You're on the list.
                  </p>
                ) : (
                  <>
                    {email && (
                      <p className="text-sm text-[#6B7B7B] leading-relaxed mb-8">
                        If selected, we will reach out to{" "}
                        <span className="font-semibold text-[#2E4A4A]">{email.trim()}</span>.
                      </p>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={resetAll}
                  className="w-full py-3.5 rounded-full border-2 border-[#E5E7EB] text-[#6B7280] font-bold text-sm hover:border-[#059669] hover:text-[#059669] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
