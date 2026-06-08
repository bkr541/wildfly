import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";

// ── Shared style tokens ────────────────────────────────────────────────────────
// Match AdminConsole CARD_STYLE / AdminDashboardView CARD exactly.

export const ADMIN_CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 2px 12px 0 rgba(52,92,90,0.08)",
};

// ── Companion primitives ───────────────────────────────────────────────────────
// Exported so child views stay consistent without re-defining constants.

export function AdminCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl p-5${className ? ` ${className}` : ""}`}
      style={{ ...ADMIN_CARD, ...style }}
    >
      {children}
    </div>
  );
}

export function AdminSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-[#EEF0F0]" />
    </div>
  );
}

// ── Saving indicator ──────────────────────────────────────────────────────────

export function AdminSavingIndicator() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-[#9CA3AF]">
      <span className="h-3 w-3 rounded-full border-[1.5px] border-[#059669] border-t-transparent animate-spin flex-shrink-0" />
      Saving…
    </span>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────

export function AdminToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="flex items-center justify-between w-full gap-4 text-left disabled:opacity-60 disabled:cursor-not-allowed group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1A2E2E] group-disabled:text-[#9CA3AF]">
          {label}
        </p>
        {description && (
          <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div
        className={`relative h-6 w-11 rounded-full flex-shrink-0 transition-colors duration-200 ${
          checked ? "bg-[#059669]" : "bg-[#D1D5DB]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────────

interface DeveloperToolsAdminShellProps {
  title: string;
  description?: string;
  /** Buttons or controls rendered top-right of the header. */
  actions?: React.ReactNode;
  /** Status badges or pills rendered inline beside the title. */
  badges?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  children?: React.ReactNode;
}

export function DeveloperToolsAdminShell({
  title,
  description,
  actions,
  badges,
  loading,
  error,
  children,
}: DeveloperToolsAdminShellProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-[#1A2E2E]">{title}</h2>
            {badges}
          </div>
          {description && (
            <p className="text-sm text-[#6B7280] mt-0.5">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
            {actions}
          </div>
        )}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <AdminCard className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-full border-2 border-[#059669] border-t-transparent animate-spin flex-shrink-0" />
          <p className="text-sm font-semibold text-[#9CA3AF]">Loading…</p>
        </AdminCard>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div
          className="rounded-2xl p-5 flex items-start gap-3"
          style={{ ...ADMIN_CARD, border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={16}
            color="#EF4444"
            strokeWidth={2}
            className="flex-shrink-0 mt-0.5"
          />
          <p className="text-sm font-semibold text-[#EF4444]">{error}</p>
        </div>
      )}

      {/* ── Content ── */}
      {!loading && !error && children}
    </div>
  );
}
