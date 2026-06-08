import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ViewIcon, ViewOffSlashIcon, Delete02Icon } from "@hugeicons/core-free-icons";
import { useGoWilderToken } from "@/hooks/useGoWilderToken";
import {
  DeveloperToolsAdminShell,
  AdminCard,
  AdminSectionLabel,
} from "./DeveloperToolsAdminShell";

// ── Status badge ──────────────────────────────────────────────────────────────

function TokenStatusBadge({ expiry, hasToken }: { expiry: Date | null; hasToken: boolean }) {
  if (!hasToken) return null;
  if (!expiry) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        Unreadable
      </span>
    );
  }
  const isExpired = expiry < new Date();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
        isExpired
          ? "bg-red-100 text-red-800 border-red-200"
          : "bg-emerald-100 text-emerald-800 border-emerald-200"
      }`}
    >
      {isExpired ? "Expired" : "Valid"}
    </span>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

export function GoWilderTokenAdminView() {
  const { token, setToken, savedToken, loading, initialLoading, expiry, save, remove } =
    useGoWilderToken();
  const [showToken, setShowToken] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isDirty = token !== savedToken;
  const hasToken = !!savedToken;
  const isExpired = expiry ? expiry < new Date() : false;

  const handleDelete = async () => {
    setConfirmDelete(false);
    await remove();
  };

  const expiryLabel = expiry
    ? expiry.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <DeveloperToolsAdminShell
      title="GoWilder Token"
      description="Global GoWilder API token stored in app_config. Shared across all developer-allowlisted users."
      badges={<TokenStatusBadge expiry={expiry} hasToken={hasToken} />}
      loading={initialLoading}
    >
      {/* ── Token input card ── */}
      <AdminCard>
        <AdminSectionLabel>API Token</AdminSectionLabel>

        {!hasToken && (
          <p className="text-xs text-[#9CA3AF] mb-3">
            No GoWilder token saved. Paste a token below to store it globally.
          </p>
        )}

        <div className="relative">
          {showToken ? (
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste GoWilder API token…"
              rows={4}
              disabled={loading}
              className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 pr-10 text-sm text-[#1A2E2E] font-mono placeholder:text-[#9CA3AF] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#059669]/30 resize-none overflow-hidden break-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          ) : (
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste GoWilder API token…"
              disabled={loading}
              className="w-full h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 pr-10 text-sm text-[#1A2E2E] font-mono placeholder:text-[#9CA3AF] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#059669]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          )}

          {(token || hasToken) && (
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className={`absolute right-2.5 text-[#9CA3AF] hover:text-[#1A2E2E] transition-colors ${
                showToken ? "top-2.5" : "top-1/2 -translate-y-1/2"
              }`}
              aria-label={showToken ? "Hide token" : "Reveal token"}
            >
              <HugeiconsIcon
                icon={showToken ? ViewOffSlashIcon : ViewIcon}
                size={16}
                color="currentColor"
                strokeWidth={2}
              />
            </button>
          )}
        </div>

        {hasToken && (
          <div className="mt-3 pt-3 border-t border-[#EEF0F0]">
            <AdminSectionLabel>Expiration</AdminSectionLabel>
            {expiryLabel ? (
              <p className={`text-sm font-medium ${isExpired ? "text-[#EF4444]" : "text-[#1A2E2E]"}`}>
                {isExpired ? "Expired" : "Expires"}{" "}
                <span className="font-normal">{expiryLabel}</span>
              </p>
            ) : (
              <p className="text-sm text-[#9CA3AF]">Could not read token expiration.</p>
            )}
          </div>
        )}
      </AdminCard>

      {/* ── Actions card ── */}
      <AdminCard>
        {confirmDelete ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-[#EF4444]">
              Permanently delete the GoWilder token?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-9 px-4 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-[#1A2E2E] hover:bg-[#F9FAFB] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="h-9 px-4 rounded-xl bg-[#EF4444] text-white text-sm font-semibold hover:bg-[#DC2626] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={loading || !isDirty || !token.trim()}
                className="h-9 px-4 rounded-xl bg-[#059669] text-white text-sm font-semibold hover:bg-[#047857] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Saving…" : "Save Token"}
              </button>
              {isDirty && !loading && (
                <span className="text-xs text-[#9CA3AF]">Unsaved changes</span>
              )}
            </div>
            {hasToken && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={loading}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-[#FCA5A5] text-[#EF4444] text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} color="currentColor" strokeWidth={2} />
                Delete Token
              </button>
            )}
          </div>
        )}
      </AdminCard>
    </DeveloperToolsAdminShell>
  );
}
