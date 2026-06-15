import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type PageState = "loading" | "success" | "already_done" | "error" | "invalid";

export default function UnsubscribePage() {
  const [state, setState] = useState<PageState>("loading");
  const [emailMasked, setEmailMasked] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const scope = params.get("scope") ?? undefined;

    if (!token) {
      setState("invalid");
      return;
    }

    supabase.functions
      .invoke("messaging-unsubscribe", { body: { token, scope } })
      .then(({ data, error }) => {
        if (error) {
          setErrorMessage(error.message ?? "Unknown error");
          setState("error");
          return;
        }
        if (!data?.success) {
          const code = data?.error?.code;
          if (code === "INVALID_TOKEN") {
            setState("invalid");
          } else {
            setErrorMessage(data?.error?.message ?? "Unknown error");
            setState("error");
          }
          return;
        }
        setEmailMasked(data.data?.email_masked ?? "");
        setState("success");
      })
      .catch(e => {
        setErrorMessage(e.message ?? "Unknown error");
        setState("error");
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F7F7] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
        {/* Logo / Brand */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#345C5A] mb-3">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 4L24 22H4L14 4Z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#1C2B2B]">Wildfly</h1>
        </div>

        {state === "loading" && (
          <>
            <div className="w-8 h-8 rounded-full border-[3px] border-[#345C5A] border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-sm text-[#6B7280]">Processing your request…</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M6 14L11 19L22 9" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#1C2B2B] mb-2">Unsubscribed</h2>
            <p className="text-sm text-[#6B7280] mb-1">
              {emailMasked
                ? <>Your preferences for <strong>{emailMasked}</strong> have been updated.</>
                : "Your preferences have been updated."}
            </p>
            <p className="text-sm text-[#6B7280]">
              You will no longer receive non-essential emails from Wildfly.
              Transactional emails (account security, password reset) will continue to be sent.
            </p>
          </>
        )}

        {state === "invalid" && (
          <>
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 9v6M14 18h.01" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="14" cy="14" r="11" stroke="#D97706" strokeWidth="2" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#1C2B2B] mb-2">Link Expired</h2>
            <p className="text-sm text-[#6B7280]">
              This unsubscribe link is invalid or has expired.
              If you'd like to update your email preferences, please contact{" "}
              <a href="mailto:support@wildfly.app" className="text-[#345C5A] hover:underline font-medium">
                support@wildfly.app
              </a>.
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M9 9l10 10M19 9L9 19" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#1C2B2B] mb-2">Something went wrong</h2>
            <p className="text-sm text-[#6B7280] mb-2">
              We couldn't process your request. Please try again or contact support.
            </p>
            {errorMessage && (
              <p className="text-xs text-red-500 font-mono bg-red-50 rounded-lg px-3 py-2">{errorMessage}</p>
            )}
          </>
        )}

        <div className="mt-8 pt-6 border-t border-[#EEF0F0]">
          <a
            href="/"
            className="text-sm text-[#345C5A] font-semibold hover:underline"
          >
            Return to Wildfly
          </a>
        </div>
      </div>
    </div>
  );
}
