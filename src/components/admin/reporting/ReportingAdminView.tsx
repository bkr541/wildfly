import React, { useState, useCallback, useEffect, useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  ArrowReloadHorizontalIcon,
  Cancel01Icon,
  BookOpen01Icon,
  Clock01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useReportDefinitions, useRunReport } from "@/hooks/useAdminReporting";
import { ReportCatalog }       from "./ReportCatalog";
import { ReportHeader }        from "./ReportHeader";
import {
  ReportParameterPanel,
  initializeFromDefaults,
  validateParameters,
} from "./ReportParameterPanel";
import { ReportEmptyState }         from "./ReportEmptyState";
import { ReportLoadingState }       from "./ReportLoadingState";
import { ReportErrorState }         from "./ReportErrorState";
import { ReportResultView }         from "./ReportResultView";
import { ReportRunHistory }         from "./ReportRunHistory";
import { ReportRunDetailsDrawer }   from "./ReportRunDetailsDrawer";
import {
  readSlugFromUrl,
  encodeUrlState,
  decodeUrlState,
} from "./reportingUrlState";
import type { ReportDefinition, ReportRun } from "./reportingTypes";
import { cn } from "@/lib/utils";

// ── Shared card style ──────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background:           "rgba(255,255,255,0.92)",
  backdropFilter:       "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border:               "1px solid rgba(203,213,225,0.5)",
  boxShadow:            "0 2px 16px 0 rgba(52,92,90,0.07)",
};

// ── Tab type ───────────────────────────────────────────────────────────────────

type WorkspaceTab = "run" | "history";

// ── Workspace area ─────────────────────────────────────────────────────────────

interface WorkspaceProps {
  definition:          ReportDefinition | null;
  definitions:         ReportDefinition[];
  paramValues:         Record<string, unknown>;
  paramErrors:         Record<string, string>;
  piiEnabled:          boolean;
  isRunning:           boolean;
  lastResultRunAt:     string | null;
  error:               Error | null;
  onParamChange:       (key: string, value: unknown) => void;
  onReset:             () => void;
  onRun:               () => void;
  onRetry:             () => void;
  onPiiChange:         (enabled: boolean) => void;
  onMobileCatalogOpen: () => void;
  onPageChange:        (page: number, pageSize: number) => void;
  reportHookData:      ReturnType<typeof useRunReport>["data"];
  isRefetching:        boolean;
  activeTab:           WorkspaceTab;
  onTabChange:         (tab: WorkspaceTab) => void;
}

function Workspace({
  definition,
  definitions,
  paramValues,
  paramErrors,
  piiEnabled,
  isRunning,
  lastResultRunAt,
  error,
  onParamChange,
  onReset,
  onRun,
  onRetry,
  onPiiChange,
  onMobileCatalogOpen,
  onPageChange,
  reportHookData,
  isRefetching,
  activeTab,
  onTabChange,
}: WorkspaceProps) {
  const hasValidation = Object.keys(paramErrors).length > 0;
  const canRun        = !!definition && !isRunning && !hasValidation;

  // Run details drawer state
  const [selectedRun, setSelectedRun]         = useState<ReportRun | null>(null);
  const [drawerOpen,  setDrawerOpen]           = useState(false);

  function openRunDetails(run: ReportRun) {
    setSelectedRun(run);
    setDrawerOpen(true);
  }

  if (!definition) {
    return <ReportEmptyState type="no-report" onBrowse={onMobileCatalogOpen} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <ReportHeader
        definition={definition}
        lastRunAt={lastResultRunAt}
        onMobileCatalogOpen={onMobileCatalogOpen}
      />

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[#F0F1F1]">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "run"}
          onClick={() => onTabChange("run")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 -mb-px",
            activeTab === "run"
              ? "border-emerald-500 text-emerald-700 bg-emerald-50"
              : "border-transparent text-[#9CA3AF] hover:text-[#374151]",
          )}
        >
          <HugeiconsIcon icon={PlayIcon} size={11} color="currentColor" strokeWidth={2.5} />
          Run
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          onClick={() => onTabChange("history")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 -mb-px",
            activeTab === "history"
              ? "border-emerald-500 text-emerald-700 bg-emerald-50"
              : "border-transparent text-[#9CA3AF] hover:text-[#374151]",
          )}
        >
          <HugeiconsIcon icon={Clock01Icon} size={11} color="currentColor" strokeWidth={2.5} />
          History
        </button>
      </div>

      {/* Tab: Run */}
      {activeTab === "run" && (
        <div className="flex flex-col gap-5">
          {/* Parameter panel */}
          <ReportParameterPanel
            definition={definition}
            values={paramValues}
            onChange={onParamChange}
            errors={paramErrors}
            disabled={isRunning}
            showPiiToggle={definition.contains_pii}
            piiEnabled={piiEnabled}
            onPiiChange={onPiiChange}
            onReset={onReset}
          />

          {/* Run button row */}
          <div
            className="flex items-center gap-3 flex-wrap"
            aria-live="polite"
            aria-label="Report execution controls"
          >
            <button
              type="button"
              onClick={onRun}
              disabled={!canRun}
              aria-disabled={!canRun}
              aria-label={isRunning ? "Report is running…" : "Run report with current parameters"}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all",
                canRun
                  ? "hover:opacity-90 active:opacity-80"
                  : "opacity-50 cursor-not-allowed",
              )}
              style={{
                background: canRun
                  ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                  : "#D1D5DB",
              }}
            >
              {isRunning ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-white border-t-transparent animate-spin flex-shrink-0" />
                  Running…
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} color="white" strokeWidth={2.5} />
                  Run Report
                </>
              )}
            </button>

            {reportHookData && !isRunning && (
              <button
                type="button"
                onClick={onReset}
                aria-label="Reset all filters to defaults"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#9CA3AF] hover:text-[#374151] transition-colors"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={2.5} />
                Reset Filters
              </button>
            )}
          </div>

          {/* Separator */}
          <div className="h-px bg-[#F0F1F1]" />

          {/* Result area */}
          <div aria-live="polite" aria-atomic="false">
            {isRunning && !reportHookData && <ReportLoadingState full />}
            {isRunning && reportHookData  && <ReportLoadingState full={false} />}

            {error && !isRunning && reportHookData && (
              <ReportErrorState error={error} onRetry={onRetry} compact />
            )}
            {error && !isRunning && !reportHookData && (
              <ReportErrorState error={error} onRetry={onRetry} />
            )}

            {!isRunning && !error && !reportHookData && (
              <ReportEmptyState type="no-run" reportName={definition.name} />
            )}

            {reportHookData && (
              <ReportResultView
                result={reportHookData}
                definition={definition}
                isRerunning={isRefetching}
                onPageChange={onPageChange}
              />
            )}
          </div>
        </div>
      )}

      {/* Tab: History */}
      {activeTab === "history" && (
        <ReportRunHistory
          selectedSlug={definition.slug}
          definitions={definitions}
          onSelectRun={openRunDetails}
        />
      )}

      {/* Run details drawer */}
      <ReportRunDetailsDrawer
        run={selectedRun}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────

export function ReportingAdminView() {
  // ── Catalog & definitions ─────────────────────────────────────────────────
  const { data: defsData, isLoading: defsLoading } = useReportDefinitions();
  const reports = useMemo(() => defsData?.reports ?? [], [defsData]);

  const [searchQuery,       setSearchQuery]       = useState("");
  const [selectedSlug,      setSelectedSlug]      = useState<string | null>(null);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);
  const [activeTab,         setActiveTab]         = useState<WorkspaceTab>("run");

  const selectedDefinition = useMemo<ReportDefinition | null>(
    () => reports.find((r) => r.slug === selectedSlug) ?? null,
    [reports, selectedSlug],
  );

  // ── Per-report parameter state ────────────────────────────────────────────
  const [paramStore, setParamStore] = useState<Record<string, Record<string, unknown>>>({});
  const [piiStore,   setPiiStore]   = useState<Record<string, boolean>>({});

  const selectReport = useCallback(
    (slug: string) => {
      setSelectedSlug(slug);
      setMobileCatalogOpen(false);
      const def = reports.find((r) => r.slug === slug);
      if (!def) return;
      setParamStore((prev) => {
        if (prev[slug]) return prev;
        return {
          ...prev,
          [slug]: initializeFromDefaults(def.parameter_schema, def.default_parameters),
        };
      });
    },
    [reports],
  );

  // Seed params when a definition becomes available for the first time.
  useEffect(() => {
    if (!selectedDefinition) return;
    const slug = selectedDefinition.slug;
    setParamStore((prev) => {
      if (prev[slug]) return prev;
      return {
        ...prev,
        [slug]: initializeFromDefaults(
          selectedDefinition.parameter_schema,
          selectedDefinition.default_parameters,
        ),
      };
    });
  }, [selectedDefinition]);

  const currentParams = useMemo(
    () => (selectedSlug ? (paramStore[selectedSlug] ?? {}) : {}),
    [selectedSlug, paramStore],
  );
  const piiEnabled = selectedSlug ? (piiStore[selectedSlug] ?? false) : false;

  function handleParamChange(key: string, value: unknown) {
    if (!selectedSlug) return;
    setParamStore((prev) => ({
      ...prev,
      [selectedSlug]: { ...(prev[selectedSlug] ?? {}), [key]: value },
    }));
  }

  function handlePiiChange(enabled: boolean) {
    if (!selectedSlug) return;
    setPiiStore((prev) => ({ ...prev, [selectedSlug]: enabled }));
  }

  function resetToDefaults() {
    if (!selectedDefinition) return;
    setParamStore((prev) => ({
      ...prev,
      [selectedDefinition.slug]: initializeFromDefaults(
        selectedDefinition.parameter_schema,
        selectedDefinition.default_parameters,
      ),
    }));
    setPiiStore((prev) => ({ ...prev, [selectedDefinition.slug]: false }));
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const paramErrors = useMemo(() => {
    if (!selectedDefinition) return {};
    return validateParameters(selectedDefinition.parameter_schema, currentParams);
  }, [selectedDefinition, currentParams]);

  // ── Report execution ──────────────────────────────────────────────────────
  const reportHook = useRunReport(selectedSlug ?? "__none__");

  function buildRunParams(overridePage?: number, overridePageSize?: number) {
    return {
      ...currentParams,
      ...(selectedDefinition?.contains_pii ? { include_pii: piiEnabled } : {}),
      ...(overridePage !== undefined       ? { _page: overridePage }      : {}),
      ...(overridePageSize !== undefined   ? { _page_size: overridePageSize } : {}),
    };
  }

  function handleRun() {
    if (!selectedDefinition) return;
    reportHook.run(buildRunParams(1));
  }

  function handlePageChange(page: number, pageSize: number) {
    reportHook.run(buildRunParams(page, pageSize));
  }

  const lastResultRunAt = reportHook.data?.generated_at ?? null;

  // ── URL deep-link: read on mount ──────────────────────────────────────────

  const urlReadDoneRef = React.useRef(false);
  useEffect(() => {
    if (urlReadDoneRef.current || reports.length === 0) return;
    urlReadDoneRef.current = true;

    const sp   = new URLSearchParams(window.location.search);
    const slug = readSlugFromUrl(sp);
    if (!slug) return;

    const def = reports.find((r) => r.slug === slug);
    if (!def) return;

    // Apply slug first.
    setSelectedSlug(slug);

    // Decode and apply URL params, excluding forbidden keys.
    const { params: urlParams } = decodeUrlState(sp, def);
    if (Object.keys(urlParams).length > 0) {
      setParamStore((prev) => ({
        ...prev,
        [slug]: {
          ...initializeFromDefaults(def.parameter_schema, def.default_parameters),
          ...urlParams,
        },
      }));
    }
  }, [reports]);

  // ── URL deep-link: write on slug/param change ──────────────────────────────

  useEffect(() => {
    // Never put PII toggle in URL — only slug and non-sensitive params.
    const sp = encodeUrlState(selectedSlug, currentParams, selectedDefinition);
    const newSearch = sp.toString() ? `?${sp.toString()}` : window.location.pathname;
    window.history.replaceState(null, "", newSearch || window.location.pathname);
  }, [selectedSlug, currentParams, selectedDefinition]);

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {/* Desktop two-column layout */}
      <div className="flex gap-4 items-start min-h-0">
        {/* ── Left catalog sidebar (desktop only) ── */}
        <div
          className="hidden md:flex flex-col rounded-2xl overflow-hidden flex-shrink-0 pt-4"
          style={{ ...CARD_STYLE, width: 272 }}
        >
          <div className="flex items-center gap-2 px-4 pb-3 border-b border-[#F0F1F1]">
            <HugeiconsIcon icon={Analytics01Icon} size={16} color="#059669" strokeWidth={2} />
            <span className="text-sm font-black text-[#1A2E2E]">Reports</span>
            {reports.length > 0 && (
              <span className="ml-auto text-[11px] font-semibold text-[#9CA3AF] bg-[#F0F1F1] px-1.5 py-0.5 rounded-full">
                {reports.length}
              </span>
            )}
          </div>
          <div className="flex-1 pt-3 overflow-hidden">
            <ReportCatalog
              reports={reports}
              isLoading={defsLoading}
              selectedSlug={selectedSlug}
              onSelect={selectReport}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
        </div>

        {/* ── Main workspace ── */}
        <div className="flex-1 min-w-0 rounded-2xl p-6" style={CARD_STYLE}>
          <Workspace
            definition={selectedDefinition}
            definitions={reports}
            paramValues={currentParams}
            paramErrors={paramErrors}
            piiEnabled={piiEnabled}
            isRunning={reportHook.isRunning}
            lastResultRunAt={lastResultRunAt}
            error={reportHook.error}
            onParamChange={handleParamChange}
            onReset={resetToDefaults}
            onRun={handleRun}
            onRetry={reportHook.retry}
            onPiiChange={handlePiiChange}
            onMobileCatalogOpen={() => setMobileCatalogOpen(true)}
            onPageChange={handlePageChange}
            reportHookData={reportHook.data}
            isRefetching={reportHook.isRefetching}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      </div>

      {/* ── Mobile: catalog sheet ── */}
      <Sheet open={mobileCatalogOpen} onOpenChange={setMobileCatalogOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-0 flex flex-col">
          <SheetHeader className="px-4 pt-5 pb-3 border-b border-[#F0F1F1]">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={BookOpen01Icon} size={16} color="#059669" strokeWidth={2} />
              <SheetTitle className="text-base font-black text-[#1A2E2E]">
                Reports
              </SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 pt-3 overflow-hidden">
            <ReportCatalog
              reports={reports}
              isLoading={defsLoading}
              selectedSlug={selectedSlug}
              onSelect={selectReport}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile empty state */}
      {!selectedSlug && !mobileCatalogOpen && (
        <div className="md:hidden">
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={CARD_STYLE}>
            <ReportEmptyState
              type="no-report"
              onBrowse={() => setMobileCatalogOpen(true)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
