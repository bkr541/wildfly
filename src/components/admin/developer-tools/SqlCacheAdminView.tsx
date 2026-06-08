import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { useClearFlightCache } from "@/hooks/useClearFlightCache";
import {
  DeveloperToolsAdminShell,
  AdminCard,
  AdminSectionLabel,
} from "./DeveloperToolsAdminShell";

// ── View ──────────────────────────────────────────────────────────────────────

export function SqlCacheAdminView() {
  const { clearing, cleared, setCleared, clear } = useClearFlightCache();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleConfirm = async () => {
    setConfirmClear(false);
    await clear();
  };

  return (
    <DeveloperToolsAdminShell
      title="SQL / Cache Tools"
      description="Inspect and invalidate cached flight data. Use with care — these operations affect live data."
    >
      {/* ── Flight Cache card ── */}
      <AdminCard>
        <AdminSectionLabel>Flight Cache</AdminSectionLabel>

        {cleared ? (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <HugeiconsIcon icon={Tick02Icon} size={16} color="#059669" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#059669]">Cache cleared successfully.</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Your flight_searches rows have been deleted and the shared flight_search_cache has been cleared.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setCleared(false); setConfirmClear(false); }}
              className="text-xs font-semibold text-[#6B7280] hover:text-[#1A2E2E] transition-colors shrink-0"
            >
              Clear again
            </button>
          </div>
        ) : confirmClear ? (
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-[#EF4444]">
                Clear your flight searches and the shared cache?
              </p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Deletes your flight_searches rows and invokes the clear-flight-cache edge function to reset the shared flight_search_cache.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="h-9 px-4 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-[#1A2E2E] hover:bg-[#F9FAFB] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={clearing}
                className="h-9 px-4 rounded-xl bg-[#EF4444] text-white text-sm font-semibold hover:bg-[#DC2626] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#1A2E2E] font-medium">
                Clears your personal flight search history and invalidates the shared flight cache.
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Useful when testing fresh search flows or after a data schema change.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={clearing}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-[#FCA5A5] text-[#EF4444] text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {clearing ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-[#EF4444] border-t-transparent animate-spin" />
                  Clearing…
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={RefreshIcon} size={14} color="currentColor" strokeWidth={2} />
                  Clear Cache
                </>
              )}
            </button>
          </div>
        )}
      </AdminCard>
    </DeveloperToolsAdminShell>
  );
}
