import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Key01Icon } from "@hugeicons/core-free-icons";
import { supabase } from "@/integrations/supabase/client";

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

function getJWTExpiry(token: string): Date | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return null;
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

interface Props {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function TokenExpirationCard({ isCollapsed = false, onToggle }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_config")
        .select("config_value")
        .eq("config_key", "gowilder_token")
        .limit(1)
        .maybeSingle();
      setToken(data?.config_value ?? null);
      setLoading(false);
    })();
  }, []);

  const expiry = token ? getJWTExpiry(token) : null;
  const now = new Date();
  const isExpired = expiry ? expiry < now : false;
  const daysUntilExpiry = expiry ? (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) : null;
  const expiryColor = isExpired
    ? "#EF4444"
    : daysUntilExpiry !== null && daysUntilExpiry < 5
    ? "#EF4444"
    : daysUntilExpiry !== null && daysUntilExpiry <= 10
    ? "#B8860B"
    : "#059669";

  const expiryLabel = expiry
    ? expiry.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <section className="px-5 pt-0 pb-5 relative z-10">
      {/* Section header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-1 px-1 group"
      >
        <div className="flex items-center gap-1.5">
          <HugeiconsIcon icon={Key01Icon} size={13} color="#059669" strokeWidth={2} />
          <h2 className="text-xs font-semibold text-[#059669] uppercase tracking-wider">
            Token Expiration
          </h2>
        </div>
        <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.22, ease: EASE }}>
          <ChevronDown size={15} strokeWidth={2.5} className="text-[#9AADAD]" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="token-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: "visible" }}
          >
            <div style={{ padding: "2px 6px 0" }}>
              {loading ? (
                <div
                  className="rounded-2xl px-4 py-5"
                  style={{
                    background: "rgba(255,255,255,0.72)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: "1px solid rgba(255,255,255,0.55)",
                    boxShadow: "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)",
                  }}
                >
                  <div className="animate-pulse">
                    <div className="h-3 w-24 rounded bg-[#e5e7eb] mb-3" />
                    <div className="h-8 w-full rounded bg-[#e5e7eb] mb-3" />
                    <div className="h-3 w-40 rounded bg-[#e5e7eb]" />
                  </div>
                </div>
              ) : !token ? (
                <div
                  className="rounded-2xl px-3 py-3 flex items-center gap-3"
                  style={{
                    background: "rgba(255,255,255,0.82)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: "1px solid rgba(255,255,255,0.65)",
                    boxShadow: "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)",
                  }}
                >
                  <div className="flex-1 min-w-0 py-1">
                    <p className="text-base text-[#1A2E2E] font-semibold leading-tight">No token configured</p>
                    <p className="text-xs text-[#9AADAD] font-medium mt-0.5">
                      Set the GoWild token in Developer Tools
                    </p>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } }}
                  className="rounded-2xl px-4 pt-3 pb-4"
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: "1px solid rgba(255,255,255,0.65)",
                    boxShadow: "0 2px 4px -1px rgba(16,185,129,0.10), 0 4px 12px -2px rgba(52,92,90,0.15), 0 1px 16px 0 rgba(5,150,105,0.08), 0 1px 2px 0 rgba(0,0,0,0.07)",
                  }}
                >
                  {/* Token label */}
                  <p className="text-[11px] font-semibold text-[#9AADAD] uppercase tracking-widest mb-1.5">
                    GoWild Token
                  </p>

                  {/* Show/hide token input */}
                  <div className="relative flex items-center">
                    <input
                      readOnly
                      type={showToken ? "text" : "password"}
                      value={token}
                      className="w-full text-[13px] font-mono text-[#1A2E2E] bg-[#F7F8F8] border border-[#E3E6E6] rounded-xl px-3 py-2 pr-10 focus:outline-none truncate"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      className="absolute right-2.5 text-[#9AADAD] hover:text-[#2E4A4A] transition-colors"
                    >
                      {showToken ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                    </button>
                  </div>

                  {/* Expiration */}
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <p className="text-[11px] font-semibold text-[#9AADAD] uppercase tracking-widest">Expires</p>
                    {expiryLabel ? (
                      <p
                        className="text-[12px] font-semibold"
                        style={{ color: expiryColor }}
                      >
                        {expiryLabel}
                        {isExpired && " · Expired"}
                      </p>
                    ) : (
                      <p className="text-[12px] text-[#9AADAD]">Unable to decode expiry</p>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
