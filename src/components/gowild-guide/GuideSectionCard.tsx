import { type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";

interface Props {
  id?: string;
  icon: IconSvgElement;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Anchor scroll offset to clear the sticky nav. */
  scrollOffsetClass?: string;
}

/**
 * Frosted Preview-style section card with an emerald header and a content body.
 * Includes anchor scroll-margin so sticky nav links do not cover the heading.
 */
export function GuideSectionCard({
  id,
  icon,
  title,
  subtitle,
  children,
  scrollOffsetClass = "scroll-mt-24",
}: Props) {
  return (
    <section
      id={id}
      className={`rounded-2xl overflow-hidden ${scrollOffsetClass}`}
      style={{
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.55)",
        boxShadow:
          "0 4px 6px -1px rgba(16,185,129,0.08), 0 8px 24px -4px rgba(52,92,90,0.13), 0 2px 40px 0 rgba(5,150,105,0.07)",
      }}
    >
      <header className="px-5 py-4 flex items-center gap-3 border-b border-[#E8EBEB]/70">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#F0FDF4" }}
        >
          <HugeiconsIcon icon={icon} size={22} color="#059669" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[#059669] uppercase tracking-[0.14em] text-sm font-bold leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[#6B7B7B] mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>
      </header>
      <div className="px-5 pt-4 pb-5">{children}</div>
    </section>
  );
}

export default GuideSectionCard;
