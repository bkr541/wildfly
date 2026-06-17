import { useState, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CancelCircleIcon, ArrowDown01Icon, AttachmentSquareIcon } from "@hugeicons/core-free-icons";
import { BottomSheet } from "@/components/BottomSheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Environment detection ──────────────────────────────────────────────────────

const APP_VERSION = "0.0.0";

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Mac OS X/i.test(ua) && navigator.maxTouchPoints === 0) return "Mac";
  if (/Android/i.test(ua)) return "Android Device";
  if (/Windows/i.test(ua)) return "Windows PC";
  return "Unknown Device";
}

function detectOS(): string {
  const ua = navigator.userAgent;
  const iOSMatch = ua.match(/iPhone OS ([\d_]+)/);
  if (iOSMatch) return `iOS ${iOSMatch[1].replace(/_/g, ".")}`;
  const iPadMatch = ua.match(/iPad.*OS ([\d_]+)/);
  if (iPadMatch) return `iPadOS ${iPadMatch[1].replace(/_/g, ".")}`;
  const macMatch = ua.match(/Mac OS X ([\d_]+)/);
  if (macMatch) return `macOS ${macMatch[1].replace(/_/g, ".")}`;
  const winMatch = ua.match(/Windows NT ([\d.]+)/);
  if (winMatch) {
    const v: Record<string, string> = { "10.0": "10 / 11", "6.3": "8.1", "6.2": "8", "6.1": "7" };
    return `Windows ${v[winMatch[1]] ?? winMatch[1]}`;
  }
  const androidMatch = ua.match(/Android ([\d.]+)/);
  if (androidMatch) return `Android ${androidMatch[1]}`;
  return navigator.platform || "Unknown OS";
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) { const m = ua.match(/Edg\/([\d]+)/); return `Edge v${m?.[1] ?? ""}`; }
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) { const m = ua.match(/Chrome\/([\d]+)/); return `Chrome v${m?.[1] ?? ""}`; }
  if (/Firefox\//i.test(ua)) { const m = ua.match(/Firefox\/([\d]+)/); return `Firefox v${m?.[1] ?? ""}`; }
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) { const m = ua.match(/Version\/([\d]+)/); return `Safari v${m?.[1] ?? ""}`; }
  return "N/A";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EnvCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] leading-none mb-1">{label}</p>
      <p className="text-[12px] font-medium text-[#2E4A4A] truncate">{value}</p>
    </div>
  );
}

const DROPDOWN_OPTIONS: Record<string, string[]> = {
  feedbackType: ["Bug", "Feature Request", "Performance", "UI/UX", "Crash", "Other"],
  severity:     ["Blocker", "Major", "Minor", "Trivial", "Enhancement"],
};

function DropdownField({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4">
      <label className="block text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-[14px] font-medium transition-colors text-left",
            open
              ? "border-[#10B981] bg-[#F0FDF4] text-[#2E4A4A]"
              : "border-[#E5E7EB] bg-white text-[#2E4A4A] hover:border-[#10B981]/50",
            !value && "text-[#9CA3AF]",
          )}
        >
          <span>{value || placeholder}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            color="#9CA3AF"
            strokeWidth={2}
            className={cn("shrink-0 transition-transform duration-200", open && "rotate-180")}
          />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-2xl border border-[#E5E7EB] bg-white shadow-lg overflow-hidden z-10">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={cn(
                  "w-full text-left px-4 py-3 text-[14px] font-medium transition-colors",
                  value === opt
                    ? "bg-[#F0FDF4] text-[#059669] font-semibold"
                    : "text-[#2E4A4A] hover:bg-[#F9FAFB]",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  pageLabel: string;
}

const BetaFeedbackButton = ({ pageLabel }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("");
  const [severity, setSeverity] = useState("");
  const [summary, setSummary] = useState("");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const env = open
    ? { device: detectDevice(), os: detectOS(), browser: detectBrowser() }
    : null;

  const handleClose = () => {
    setOpen(false);
    setFeedbackType("");
    setSeverity("");
    setSummary("");
    setAttachmentName(null);
    setSubmitError(null);
  };

  const canSubmit = feedbackType && severity && summary.trim();

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await (supabase.from("beta_feedback") as any).insert({
      user_id:        user.id,
      app_version:    APP_VERSION,
      device:         detectDevice(),
      os_version:     detectOS(),
      browser_version: detectBrowser(),
      feedback_type:  feedbackType,
      summary:        summary.trim(),
      severity,
      app_page:       pageLabel,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError("Failed to submit. Please try again.");
    } else {
      handleClose();
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Submit beta feedback"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[9000] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform duration-150 active:scale-95 hover:scale-105"
        style={{ background: "#10B981" }}
      >
        <img src="/assets/icons/feedback.svg" alt="" className="w-6 h-6" />
      </button>

      <BottomSheet open={open} onClose={handleClose} style={{ top: "5%" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F0F1F1]">
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
            >
              <img src="/assets/icons/feedback.svg" alt="" className="w-4 h-4" />
            </div>
            <h2 className="text-[22px] font-medium text-[#6B7280] leading-tight">Beta Feedback</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#2E4A4A] hover:bg-black/5 transition-colors ml-1"
          >
            <HugeiconsIcon icon={CancelCircleIcon} size={22} color="currentColor" strokeWidth={1.8} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Environment section */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
              Environment
            </p>
            <div className="rounded-2xl border border-[#F0F1F1] bg-[#FAFAFA] px-4 py-3 grid grid-cols-3 gap-x-3 gap-y-3">
              <EnvCell label="App Version" value={APP_VERSION} />
              <EnvCell label="Device"      value={env?.device  ?? "—"} />
              <EnvCell label="OS Version"  value={env?.os      ?? "—"} />
              <EnvCell label="Browser"     value={env?.browser ?? "—"} />
              <EnvCell label="App Page"    value={pageLabel} />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#F0F1F1] mx-5 my-3" />

          {/* Feedback details */}
          <div className="px-5 pb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3">
              Feedback Details
            </p>

            <div className="pl-3">
              <DropdownField
                label="Feedback Type"
                placeholder="Select type…"
                options={DROPDOWN_OPTIONS.feedbackType}
                value={feedbackType}
                onChange={setFeedbackType}
              />

              <div className="mb-4">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1.5">
                  Summary
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the issue or request…"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-[#E5E7EB] bg-white text-[14px] text-[#2E4A4A] placeholder:text-[#9CA3AF] resize-none outline-none focus:border-[#10B981] focus:bg-[#F0FDF4] transition-colors"
                />
              </div>

              <DropdownField
                label="Severity"
                placeholder="Select severity…"
                options={DROPDOWN_OPTIONS.severity}
                value={severity}
                onChange={setSeverity}
              />

              {/* Attachment */}
              <div className="mb-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1.5">
                  Attachment
                </label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-dashed border-[#D1D5DB] bg-white hover:border-[#10B981]/60 hover:bg-[#F0FDF4] transition-colors text-[14px] font-medium text-[#9CA3AF]"
                >
                  <HugeiconsIcon icon={AttachmentSquareIcon} size={18} color="#9CA3AF" strokeWidth={2} />
                  <span className={attachmentName ? "text-[#2E4A4A]" : ""}>
                    {attachmentName ?? "Add image or screen recording…"}
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? null)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#F0F1F1] bg-white">
          {submitError && (
            <p className="text-xs text-red-500 text-center mb-2">{submitError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full h-12 rounded-full text-white text-sm font-black uppercase tracking-[0.45em] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}
          >
            <img src="/assets/icons/feedback.svg" alt="" className="w-5 h-5" />
            {submitting ? "Submitting…" : "Submit Feedback"}
          </button>
        </div>
      </BottomSheet>
    </>
  );
};

export default BetaFeedbackButton;
