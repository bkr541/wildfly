import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, CheckmarkCircle01Icon, HelpCircleIcon } from "@hugeicons/core-free-icons";
import { TROUBLESHOOTER_QUESTIONS } from "@/data/gowildGuideContent";

type Answer = "yes" | "no" | "unsure" | null;

interface Props {
  id?: string;
}

export function GoWildTroubleshooter({ id }: Props) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const issues = useMemo(() => {
    return TROUBLESHOOTER_QUESTIONS.filter((q) => {
      const a = answers[q.id];
      if (!a || a === "unsure") return false;
      const positive = a === "yes";
      return positive === q.positiveIsIssue;
    });
  }, [answers]);

  const totalAnswered = Object.values(answers).filter((a) => a && a !== "unsure").length;

  return (
    <div className="space-y-3" id={id}>
      <ul className="space-y-2">
        {TROUBLESHOOTER_QUESTIONS.map((q) => {
          const a = answers[q.id];
          return (
            <li key={q.id} className="rounded-xl border border-[#E8EBEB] bg-white p-3">
              <p className="text-sm text-[#1A2E2E] font-semibold leading-snug">{q.prompt}</p>
              <div className="mt-2 flex gap-2" role="radiogroup" aria-label={q.prompt}>
                {(["yes", "no", "unsure"] as const).map((opt) => {
                  const sel = a === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                      className={[
                        "px-3 min-h-[36px] rounded-full text-xs font-semibold border transition-all",
                        sel
                          ? "bg-[#059669] text-white border-[#059669]"
                          : "bg-white text-[#2E4A4A] border-[#E8EBEB] hover:border-[#10B981]",
                      ].join(" ")}
                    >
                      {opt === "yes" ? "Yes" : opt === "no" ? "No" : "Not sure"}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <div
        aria-live="polite"
        className="rounded-xl border border-[#E8EBEB] bg-white p-4 space-y-2"
      >
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={issues.length ? AlertCircleIcon : totalAnswered ? CheckmarkCircle01Icon : HelpCircleIcon}
            size={20}
            color={issues.length ? "#92400E" : totalAnswered ? "#059669" : "#6B7B7B"}
            strokeWidth={2}
          />
          <p className="text-sm font-bold text-[#1A2E2E]">
            {issues.length
              ? `Likely cause${issues.length > 1 ? "s" : ""} identified`
              : totalAnswered
                ? "No common causes flagged"
                : "Answer the questions above for guidance"}
          </p>
        </div>
        {issues.length > 0 && (
          <ul className="text-sm text-[#2E4A4A] list-disc pl-5 space-y-1">
            {issues.map((q) => (
              <li key={q.id}>{q.issueExplanation}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[#6B7B7B]">
          <strong>Standard seats being available does not guarantee GoWild availability.</strong>
        </p>
      </div>
    </div>
  );
}

export default GoWildTroubleshooter;
