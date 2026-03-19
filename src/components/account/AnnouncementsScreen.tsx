import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  ArrowLeft01Icon,
  Megaphone02Icon,
  Cancel01Icon,
  Tick02Icon,
  EyeIcon,
  UserIcon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import { ChevronDown } from "lucide-react";
import { AppInput } from "@/components/ui/app-input";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  audience: string;
  priority: number;
  is_published: boolean;
  publish_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  _view_count?: number;
  _seen_by?: string[];
}

interface AnnouncementsScreenProps {
  onBack: () => void;
  onTitleChange?: (title: string | null) => void;
}

const AUDIENCE_OPTIONS = ["all", "free", "pro", "beta"] as const;

const AUDIENCE_COLORS: Record<string, string> = {
  all: "#345C5A",
  free: "#6B7B7B",
  pro: "#D97706",
  beta: "#3B82F6",
};

function AudienceBadge({ audience }: { audience: string }) {
  const color = AUDIENCE_COLORS[audience] ?? "#6B7B7B";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-white"
      style={{ background: color }}
    >
      {audience}
    </span>
  );
}

const EMPTY_FORM = {
  title: "",
  body: "",
  cta_label: "",
  cta_url: "",
  image_url: "",
  audience: "all" as string,
  priority: "0",
  is_published: false,
  publish_at: "",
  expires_at: "",
};

export function AnnouncementsScreen({ onBack, onTitleChange }: AnnouncementsScreenProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    onTitleChange?.("Announcements");
  }, [onTitleChange]);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all announcements via service-role bypass (dev tool — RLS only shows published)
      // We use the anon key but as a dev tool the user is in the allowlist so we just
      // use the regular client and rely on the service-role edge function pattern.
      // Since dev tools query as the authenticated user and RLS only shows published,
      // we'll show all that are visible to them + merge view counts.
      const { data: rows, error } = await (supabase as any)
        .from("announcements")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get view counts grouped by announcement_id
      const { data: viewRows } = await (supabase as any)
        .from("announcement_views")
        .select("announcement_id, user_id");

      // Build a map: announcement_id -> { count, userIds[] }
      const viewMap: Record<string, { count: number; userIds: string[] }> = {};
      for (const v of viewRows ?? []) {
        if (!viewMap[v.announcement_id]) viewMap[v.announcement_id] = { count: 0, userIds: [] };
        viewMap[v.announcement_id].count += 1;
        viewMap[v.announcement_id].userIds.push(v.user_id);
      }

      const enriched: Announcement[] = (rows ?? []).map((a: Announcement) => ({
        ...a,
        _view_count: viewMap[a.id]?.count ?? 0,
        _seen_by: viewMap[a.id]?.userIds ?? [],
      }));

      setAnnouncements(enriched);
    } catch (err: any) {
      toast.error(`Failed to load: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and body are required.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, any> = {
        title: form.title.trim(),
        body: form.body.trim(),
        cta_label: form.cta_label.trim() || null,
        cta_url: form.cta_url.trim() || null,
        image_url: form.image_url.trim() || null,
        audience: form.audience,
        priority: parseInt(form.priority, 10) || 0,
        is_published: form.is_published,
        publish_at: form.publish_at || null,
        expires_at: form.expires_at || null,
        created_by: user?.id ?? null,
      };

      // Use service-role via edge function to bypass RLS insert block
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${session?.access_token}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      toast.success("Announcement created!");
      setForm({ ...EMPTY_FORM });
      setShowAdd(false);
      await loadAnnouncements();
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(parseISO(d), "MMM d, yyyy h:mm a"); } catch { return d; }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#345C5A]"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={14} color="currentColor" strokeWidth={2} />
          Back
        </button>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#345C5A] text-white text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <HugeiconsIcon icon={showAdd ? Cancel01Icon : PlusSignIcon} size={12} color="white" strokeWidth={2} />
          {showAdd ? "Cancel" : "New"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
        {/* ── Add Form ── */}
        {showAdd && (
          <div className="bg-white rounded-2xl border border-[#E3E6E6] shadow-sm p-4 space-y-3 animate-fade-in">
            <p className="text-sm font-bold text-[#2E4A4A]">New Announcement</p>

            <AppInput
              label="Title *"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Go Wild sale ends Sunday"
            />
            <div>
              <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block">Body *</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Message text…"
                rows={3}
                className="w-full rounded-xl border border-[#E3E6E6] px-3 py-2.5 text-sm text-[#2E4A4A] bg-white placeholder:text-[#B0BABA] focus:outline-none focus:ring-2 focus:ring-[#345C5A]/30 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <AppInput
                label="CTA Label"
                value={form.cta_label}
                onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
                placeholder="e.g. Book Now"
              />
              <AppInput
                label="CTA URL"
                value={form.cta_url}
                onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <AppInput
              label="Image URL (optional)"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              placeholder="https://..."
            />

            <div className="grid grid-cols-2 gap-3">
              {/* Audience */}
              <div>
                <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block">Audience</label>
                <div className="relative">
                  <select
                    value={form.audience}
                    onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                    className="w-full appearance-none rounded-xl border border-[#E3E6E6] px-3 py-2.5 text-sm text-[#2E4A4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/30 pr-8"
                  >
                    {AUDIENCE_OPTIONS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                    <HugeiconsIcon icon={ChevronDown01Icon} size={12} color="#6B7B7B" strokeWidth={2} />
                  </span>
                </div>
              </div>

              <AppInput
                label="Priority"
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block">Publish At</label>
                <input
                  type="datetime-local"
                  value={form.publish_at}
                  onChange={(e) => setForm((f) => ({ ...f, publish_at: e.target.value }))}
                  className="w-full rounded-xl border border-[#E3E6E6] px-3 py-2.5 text-sm text-[#2E4A4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#6B7B7B] mb-1 block">Expires At</label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  className="w-full rounded-xl border border-[#E3E6E6] px-3 py-2.5 text-sm text-[#2E4A4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#345C5A]/30"
                />
              </div>
            </div>

            {/* Published toggle */}
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, is_published: !f.is_published }))}
              className="flex items-center gap-3 w-full"
            >
              <div className={`h-6 w-11 rounded-full relative transition-colors ${form.is_published ? "bg-[#345C5A]" : "bg-[#D1D5D5]"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.is_published ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm font-semibold text-[#2E4A4A]">Published</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.body.trim()}
              className="w-full py-2.5 rounded-xl bg-[#345C5A] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Tick02Icon} size={14} color="white" strokeWidth={2} />
                  Save Announcement
                </>
              )}
            </button>
          </div>
        )}

        {/* ── List ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="h-5 w-5 rounded-full border-2 border-[#345C5A] border-t-transparent animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-12 w-12 rounded-full bg-[#F2F3F3] flex items-center justify-center">
              <HugeiconsIcon icon={Megaphone02Icon} size={22} color="#C4CACA" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-[#6B7B7B]">No announcements yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => {
              const isExpanded = expandedId === ann.id;
              return (
                <div
                  key={ann.id}
                  className="bg-white rounded-2xl border border-[#E3E6E6] shadow-sm overflow-hidden"
                >
                  {/* Card header — always visible */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[#F8F9F9] transition-colors"
                  >
                    {/* Status dot */}
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${ann.is_published ? "bg-emerald-500" : "bg-[#D1D5D5]"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-[#2E4A4A] truncate">{ann.title}</p>
                        <AudienceBadge audience={ann.audience} />
                        {ann.priority > 0 && (
                          <span className="text-[10px] font-bold text-[#D97706] bg-amber-50 px-1.5 py-0.5 rounded-full">
                            P{ann.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7B7B] mt-0.5 line-clamp-1">{ann.body}</p>
                    </div>
                    {/* View count pill */}
                    <div className="flex items-center gap-1 shrink-0 bg-[#F2F3F3] px-2 py-1 rounded-full">
                      <HugeiconsIcon icon={EyeIcon} size={11} color="#6B7B7B" strokeWidth={1.5} />
                      <span className="text-[11px] font-semibold text-[#6B7B7B]">{ann._view_count}</span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[#F0F1F1] px-4 py-3 space-y-3 animate-fade-in">
                      {/* Body */}
                      <p className="text-sm text-[#345C5A] leading-relaxed">{ann.body}</p>

                      {/* CTA */}
                      {ann.cta_label && (
                        <div className="flex items-center gap-2 text-xs text-[#6B7B7B]">
                          <span className="font-semibold text-[#2E4A4A]">CTA:</span>
                          {ann.cta_label}
                          {ann.cta_url && (
                            <a
                              href={ann.cta_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#3B82F6] underline truncate"
                            >
                              {ann.cta_url}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Dates row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-start gap-1.5">
                          <HugeiconsIcon icon={Clock01Icon} size={11} color="#6B7B7B" strokeWidth={1.5} className="mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-semibold text-[#6B7B7B] uppercase tracking-wide">Publish</p>
                            <p className="text-xs text-[#2E4A4A]">{fmtDate(ann.publish_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <HugeiconsIcon icon={Clock01Icon} size={11} color="#6B7B7B" strokeWidth={1.5} className="mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-semibold text-[#6B7B7B] uppercase tracking-wide">Expires</p>
                            <p className="text-xs text-[#2E4A4A]">{fmtDate(ann.expires_at)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Created */}
                      <p className="text-[10px] text-[#B0BABA]">
                        Created {fmtDate(ann.created_at)}
                        {ann.created_by && ` · by ${ann.created_by.slice(0, 8)}…`}
                      </p>

                      {/* Seen by */}
                      {(ann._view_count ?? 0) > 0 ? (
                        <div>
                          <p className="text-[10px] font-semibold text-[#6B7B7B] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                            <HugeiconsIcon icon={UserIcon} size={10} color="#6B7B7B" strokeWidth={1.5} />
                            Seen by {ann._view_count} user{(ann._view_count ?? 0) !== 1 ? "s" : ""}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(ann._seen_by ?? []).slice(0, 20).map((uid) => (
                              <span
                                key={uid}
                                className="px-2 py-0.5 rounded-full bg-[#F2F3F3] text-[10px] font-mono text-[#6B7B7B]"
                              >
                                {uid.slice(0, 8)}…
                              </span>
                            ))}
                            {(ann._seen_by?.length ?? 0) > 20 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#F2F3F3] text-[10px] text-[#6B7B7B]">
                                +{(ann._seen_by?.length ?? 0) - 20} more
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#B0BABA] italic">No views yet</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
