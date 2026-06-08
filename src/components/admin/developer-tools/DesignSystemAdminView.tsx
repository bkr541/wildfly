import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { DeveloperToolsAdminShell, ADMIN_CARD } from "./DeveloperToolsAdminShell";
import { DesignSystemContent } from "@/pages/DesignSystemV2";

// Catches render errors inside DesignSystemContent (e.g. broken imports, bad data).
class DesignSystemErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null };

  static getDerivedStateFromError(err: Error) {
    return { error: err.message || "Failed to render Design System." };
  }

  render() {
    if (this.state.error) {
      return (
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
          <p className="text-sm font-semibold text-[#EF4444]">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function DesignSystemAdminView() {
  return (
    <DeveloperToolsAdminShell
      title="Design System"
      description="Component library, design tokens, and canonical patterns for the Wildfly app."
    >
      <DesignSystemErrorBoundary>
        <DesignSystemContent />
      </DesignSystemErrorBoundary>
    </DeveloperToolsAdminShell>
  );
}
