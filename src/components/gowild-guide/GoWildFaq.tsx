import { useMemo, useState, type CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SearchingIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/data/gowildGuideContent";

interface Props {
  id?: string;
}

export function GoWildFaq({ id }: Props) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return FAQ_ITEMS;
    return FAQ_ITEMS.filter(
      (f) =>
        f.question.toLowerCase().includes(term) ||
        f.answer.toLowerCase().includes(term),
    );
  }, [q]);

  return (
    <div className="space-y-3" id={id}>
      <div
        className="app-input-container"
        style={{ minHeight: 48, "--input-bg": "#ffffff" } as CSSProperties}
      >
        <button type="button" tabIndex={-1} className="app-input-icon-btn">
          <HugeiconsIcon icon={SearchingIcon} size={18} color="currentColor" strokeWidth={2} />
        </button>
        <input
          type="text"
          className="app-input"
          placeholder="Search the FAQ…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search frequently asked questions"
          style={{ fontSize: 16 }}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="app-input-reset app-input-reset--visible"
            aria-label="Clear search"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={2} />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[#6B7B7B] px-2 py-4 text-center">No matching questions found.</p>
      ) : (
        <Accordion type="single" collapsible className="rounded-xl border border-[#E8EBEB] bg-white px-3">
          {filtered.map((f) => (
            <AccordionItem key={f.id} value={f.id} className="border-b last:border-0">
              <AccordionTrigger className="text-left text-sm font-semibold text-[#1A2E2E]">
                {f.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-[#2E4A4A] leading-relaxed">
                {f.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

export default GoWildFaq;
