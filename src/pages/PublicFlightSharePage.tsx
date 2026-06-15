import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AirplaneTakeOff01Icon,
  Alert02Icon,
  Refresh01Icon,
  CalendarCheckIn01Icon,
} from "@hugeicons/core-free-icons";
import { getPublicSharedFlightResult } from "@/services/sharedFlightResults";
import type { PublicSharedFlightResultResponse } from "@/services/sharedFlightResults";
import { PublicFlightShareView } from "@/components/flight-share/PublicFlightShareView";

// ── Design tokens ─────────────────────────────────────────────────────────────

const DARK_TEAL = "#1A2E2E";
const MUTED     = "#6B7B7B";
const FAINT     = "#9AADAD";
const EMERALD   = "#059669";

// ── Module-level Promise cache: prevents Strict Mode double fetch ──────────────
// A second mount (React Strict Mode) finds the same Promise and awaits it;
// no second network request is made, so view_count is incremented exactly once.
const sharePromises = new Map<string, Promise<PublicSharedFlightResultResponse>>();

function fetchShare(token: string): Promise<PublicSharedFlightResultResponse> {
  const existing = sharePromises.get(token);
  if (existing) return existing;
  const p = getPublicSharedFlightResult(token).catch(err => {
    sharePromises.delete(token);
    throw err;
  });
  sharePromises.set(token, p);
  return p;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 0 48px" }}>
      {/* Hero skeleton */}
      <div style={{
        width: "100%",
        height: "clamp(160px, 25vw, 253px)",
        background: "linear-gradient(90deg, #E5E7E7 25%, #EEF0F0 50%, #E5E7E7 75%)",
        backgroundSize: "200% 100%",
        opacity: 0.6,
      }} />

      {/* Stats bar skeleton */}
      <div style={{
        background: "#FFF",
        borderBottom: "1px solid #F0F1F1",
        padding: "12px 20px",
        display: "flex",
        gap: 16,
        alignItems: "center",
      }}>
        {[80, 60, 90, 70, 65].map((w, i) => (
          <React.Fragment key={i}>
            <div style={{
              width: w,
              height: 28,
              background: "#E8EBEB",
              borderRadius: 6,
              opacity: 0.6,
            }} />
            {i < 4 && <div style={{ width: 1, height: 24, background: "#E8EBEB" }} />}
          </React.Fragment>
        ))}
      </div>

      <div style={{ padding: "0 12px" }}>
        {/* Disclosure skeleton */}
        <div style={{
          margin: "12px 0 10px",
          height: 58,
          background: "#FFF",
          border: "1px solid #E8EBEB",
          borderRadius: 12,
          opacity: 0.6,
        }} />

        {/* Cards */}
        {[1, 2, 3].map(n => (
          <div key={n} style={{
            height: 72,
            background: "#FFF",
            border: "1px solid #E8EBEB",
            borderRadius: 18,
            marginBottom: 12,
            opacity: 0.6,
          }} />
        ))}
      </div>

    </div>
  );
}

// ── Error views ───────────────────────────────────────────────────────────────

function ErrorView({
  kind,
  onRetry,
}: {
  kind:    string;
  onRetry: () => void;
}) {
  const isGone             = kind === "NOT_FOUND" || kind === "REVOKED";
  const isExpired          = kind === "EXPIRED";
  const isUnsupportedVersion = kind === "UNSUPPORTED_VERSION";
  const isRetryable        = kind === "SERVER_ERROR" || kind === "NETWORK_ERROR";

  const icon      = isExpired ? CalendarCheckIn01Icon : Alert02Icon;
  const iconColor = isGone || isExpired || isUnsupportedVersion ? FAINT : "#EF4444";

  const headline = isGone
    ? "This share link is no longer available"
    : isExpired
    ? "This share link has expired"
    : isUnsupportedVersion
    ? "Unsupported share format"
    : "Something went wrong";

  const body = isGone
    ? "The flight results may have been removed or the link may be invalid."
    : isExpired
    ? "The flight results snapshot has passed its expiry date. The person who shared this may be able to generate a new link."
    : isUnsupportedVersion
    ? "This link uses a snapshot format that isn't supported by the current version of Wildfly. Try updating your browser or ask the sender to reshare."
    : "We weren't able to load these flight results. Please try again.";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F5",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
    }}>
      <div style={{
        background: "#FFF",
        border: "1px solid #E8EBEB",
        borderRadius: 20,
        padding: "40px 32px",
        maxWidth: 440,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(53,92,90,0.08)",
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: isGone || isExpired ? "#F1F5F5" : "#FEF2F2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <HugeiconsIcon icon={icon} size={26} color={iconColor} strokeWidth={1.8} />
        </div>

        <h1 style={{ fontSize: 17, fontWeight: 700, color: DARK_TEAL, margin: "0 0 8px" }}>
          {headline}
        </h1>
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, margin: "0 0 20px" }}>
          {body}
        </p>

        {isRetryable && (
          <button
            onClick={onRetry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 20px",
              background: EMERALD,
              color: "#FFF",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <HugeiconsIcon icon={Refresh01Icon} size={14} color="#FFF" strokeWidth={2.2} />
            Try again
          </button>
        )}

        <div style={{ marginTop: 24 }}>
          <a
            href="/"
            style={{
              fontSize: 12,
              color: EMERALD,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Go to Wildfly →
          </a>
        </div>
      </div>

      {/* Wildfly branding */}
      <p style={{ marginTop: 24, fontSize: 12, color: FAINT }}>
        <strong style={{ color: EMERALD }}>Wildfly</strong> — GoWild flight search
      </p>
    </div>
  );
}

// ── Invalid token view ────────────────────────────────────────────────────────

function InvalidTokenView() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F5",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
    }}>
      <div style={{
        background: "#FFF",
        border: "1px solid #E8EBEB",
        borderRadius: 20,
        padding: "40px 32px",
        maxWidth: 440,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(53,92,90,0.08)",
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#F1F5F5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={26} color={FAINT} strokeWidth={1.8} />
        </div>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: DARK_TEAL, margin: "0 0 8px" }}>
          Invalid link
        </h1>
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, margin: "0 0 20px" }}>
          This share link doesn't look right. Double-check that you have the full link.
        </p>
        <a
          href="/"
          style={{ fontSize: 12, color: EMERALD, fontWeight: 600, textDecoration: "none" }}
        >
          Go to Wildfly →
        </a>
      </div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

export default function PublicFlightSharePage() {
  const { token } = useParams<{ token: string }>();

  const [loading,   setLoading]   = useState(true);
  const [shareData, setShareData] = useState<PublicSharedFlightResultResponse | null>(null);
  const [errorKind, setErrorKind] = useState<string | null>(null);
  const [retryKey,  setRetryKey]  = useState(0);

  // Inject noindex meta tag — this page must never be indexed
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  // Update document title when share data is loaded
  useEffect(() => {
    if (shareData) {
      const { displayModel } = shareData;
      document.title = `${displayModel.originLabel} to ${displayModel.destinationLabel} Flights | Wildfly`;
    } else {
      document.title = "Flight Results | Wildfly";
    }
    return () => {
      document.title = "Wildfly";
    };
  }, [shareData]);

  // Fetch share data
  useEffect(() => {
    if (!token || token.length > 128) return;

    setLoading(true);
    setErrorKind(null);

    fetchShare(token)
      .then(data => {
        setShareData(data);
        setLoading(false);
      })
      .catch(err => {
        const kind = (typeof err === "object" && err !== null && "kind" in err && typeof (err as { kind: unknown }).kind === "string")
          ? String((err as { kind: unknown }).kind)
          : "SERVER_ERROR";
        setErrorKind(kind);
        setLoading(false);
      });
  // retryKey intentionally triggers a fresh fetch on retry; fetchShare is module-level
  }, [token, retryKey]);

  const handleRetry = () => {
    if (token) sharePromises.delete(token);
    setRetryKey(k => k + 1);
  };

  // Invalid / missing token in URL
  if (!token || token.length > 128) {
    return <InvalidTokenView />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F1F5F5" }}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (errorKind) {
    return <ErrorView kind={errorKind} onRetry={handleRetry} />;
  }

  if (!shareData) return null;

  const publicUrl = `${window.location.origin}/share/flights/${token}`;

  return (
    <PublicFlightShareView
      model={shareData.displayModel}
      createdAt={shareData.createdAt}
      expiresAt={shareData.expiresAt}
      publicUrl={publicUrl}
    />
  );
}
