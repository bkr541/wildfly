import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Cancel01Icon,
  Tick02Icon,
  Megaphone02Icon,
  EyeIcon,
  UserIcon,
  Clock01Icon,
  ArrowDown01Icon,
  RefreshIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { format, parseISO } from "date-fns";
import { useAnnouncementsAdmin, type Announcement } from "@/hooks/useAnnouncementsAdmin";
import {
  DeveloperToolsAdminShell,
  AdminCard,
  AdminSectionLabel,
  AdminToggleRow,
  AdminSavingIndicator,
} from "./DeveloperToolsAdminShell";

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS = ["all", "free", "pro", "beta"] as const;

const AUDIENCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  all:  { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-200" },
  free: { bg: "bg-[#F3F4F6]",   text: "text-[#6B7280]",  border: "border-[#E5E7EB]"  },
  pro:  { bg: "bg-amber-100",   text: "text-amber-800",  border: "border-amber-200"  },
  beta: { bg: "bg-blue-100",    text: "text-blue-800",   border: "border-blue-200"   },
};

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

const INPUT_CLASS =
  "w-full h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1A2E2E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#059669]/30";

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1A2E2E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#059669]/30 resize-none";

// ── Local primitives ──────────────────────────────────────────────────────────

function AudienceBadge({ audience }: { audience: string }) {
  const c = AUDIENCE_COLORS[audience] ?? AUDIENCE_COLORS.free;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${c.bg} ${c.text} ${c.border}`}
    >
      {audience}
    </span>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] mb-1.5">
      {children}
      {required && <span className="text-[#EF4444] ml-0.5">*</span>}
    </label>
  );
}

// ── Shared form fields ────────────────────────────────────────────────────────

type FormState = typeof EMPTY_FORM;
type SetForm = React.Dispatch<React.SetStateAction<FormState>>;

function AnnouncementFormFields({
  form,
  setForm,
  saving,
  onSave,
  onCancel,
  isEdit,
}: {
  form: FormState;
  setForm: SetForm;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  isEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <FieldLabel required>Title</FieldLabel>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Go Wild sale ends Sunday"
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <FieldLabel required>Body</FieldLabel>
        <textarea
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          placeholder="Message text…"
          rows={3}
          className={TEXTAREA_CLASS}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel>CTA Label</FieldLabel>
          <input
            type="text"
            value={form.cta_label}
            onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
            placeholder="e.g. Book Now"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <FieldLabel>CTA URL</FieldLabel>
          <input
            type="text"
            value={form.cta_url}
            onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
            placeholder="https://…"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Image URL</FieldLabel>
        <input
          type="text"
          value={form.image_url}
          onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
          placeholder="https://…"
          className={INPUT_CLASS}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel>Audience</FieldLabel>
          <div className="relative">
            <select
              value={form.audience}
              onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
              className="appearance-none w-full h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 pr-9 text-sm font-medium text-[#1A2E2E] focus:outline-none focus:ring-2 focus:ring-[#059669]/30 cursor-pointer"
            >
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} color="#9CA3AF" strokeWidth={2} />
            </span>
          </div>
        </div>
        <div>
          <FieldLabel>Priority</FieldLabel>
          <input
            type="number"
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            placeholder="0"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel>Publish At</FieldLabel>
          <input
            type="datetime-local"
            value={form.publish_at}
            onChange={(e) => setForm((f) => ({ ...f, publish_at: e.target.value }))}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <FieldLabel>Expires At</FieldLabel>
          <input
            type="datetime-local"
            value={form.expires_at}
            onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="pt-1 border-t border-[#EEF0F0]">
        <AdminToggleRow
          label="Published"
          checked={form.is_published}
          onChange={() => setForm((f) => ({ ...f, is_published: !f.is_published }))}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.title.trim() || !form.body.trim()}
          className="flex-1 h-10 rounded-xl bg-[#059669] text-white text-sm font-semibold hover:bg-[#047857] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <HugeiconsIcon icon={Tick02Icon} size={14} color="white" strokeWidth={2} />
              {isEdit ? "Save Changes" : "Save Announcement"}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-10 px-4 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-[#1A2E2E] hover:bg-[#F9FAFB] transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

export function AnnouncementsAdminView() {
  const { announcements, loading, saving, error, reload, upsert } = useAnnouncementsAdmin();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(parseISO(d), "MMM d, yyyy h:mm a"); } catch { return d; }
  };

  const openCreate = () => {
    setEditingId(null);
    setExpandedId(null);
    setForm({ ...EMPTY_FORM });
    setShowAdd((v) => !v);
  };

  const openEdit = (ann: Announcement) => {
    setShowAdd(false);
    setExpandedId(null);
    setForm({
      title: ann.title,
      body: ann.body,
      cta_label: ann.cta_label ?? "",
      cta_url: ann.cta_url ?? "",
      image_url: ann.image_url ?? "",
      audience: ann.audience,
      priority: String(ann.priority),
      is_published: ann.is_published,
      publish_at: ann.publish_at ?? "",
      expires_at: ann.expires_at ?? "",
    });
    setEditingId(ann.id);
  };

  const cancelForm = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleUpsert = async () => {
    const ok = await upsert({
      ...(editingId ? { id: editingId } : {}),
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
    });
    if (ok) {
      cancelForm();
    }
  };

  const togglePublish = async (ann: Announcement) => {
    await upsert({
      id: ann.id,
      title: ann.title,
      body: ann.body,
      cta_label: ann.cta_label,
      cta_url: ann.cta_url,
      image_url: ann.image_url,
      audience: ann.audience,
      priority: ann.priority,
      is_published: !ann.is_published,
      publish_at: ann.publish_at,
      expires_at: ann.expires_at,
    });
  };

  const actions = saving ? (
    <AdminSavingIndicator />
  ) : (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={reload}
        className="h-9 w-9 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
        aria-label="Reload announcements"
      >
        <HugeiconsIcon icon={RefreshIcon} size={14} color="currentColor" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={openCreate}
        className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#059669] text-white text-sm font-semibold hover:bg-[#047857] transition-colors"
      >
        <HugeiconsIcon
          icon={showAdd ? Cancel01Icon : PlusSignIcon}
          size={13}
          color="white"
          strokeWidth={2}
        />
        {showAdd ? "Cancel" : "New"}
      </button>
    </div>
  );

  return (
    <DeveloperToolsAdminShell
      title="Announcements"
      description="Create and manage in-app announcements shown to users."
      loading={loading}
      error={error}
      actions={actions}
    >
      {/* ── Create form ── */}
      {showAdd && (
        <AdminCard>
          <AdminSectionLabel>New Announcement</AdminSectionLabel>
          <AnnouncementFormFields
            form={form}
            setForm={setForm}
            saving={saving}
            onSave={handleUpsert}
            onCancel={cancelForm}
            isEdit={false}
          />
        </AdminCard>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && announcements.length === 0 && !showAdd && (
        <AdminCard className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="h-12 w-12 rounded-full bg-[#F3F4F6] flex items-center justify-center">
            <HugeiconsIcon icon={Megaphone02Icon} size={22} color="#9CA3AF" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-[#9CA3AF] font-medium">No announcements yet.</p>
          <button
            type="button"
            onClick={() => { setShowAdd(true); }}
            className="text-xs font-semibold text-[#059669] hover:underline"
          >
            Create the first one
          </button>
        </AdminCard>
      )}

      {/* ── Announcement list ── */}
      {announcements.length > 0 && (
        <div className="flex flex-col gap-3">
          {announcements.map((ann) => {
            const isEditing = editingId === ann.id;
            const isExpanded = expandedId === ann.id;

            return (
              <AdminCard key={ann.id} className="p-0 overflow-hidden">
                {/* Header row */}
                <div className="flex items-start">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) return;
                      setExpandedId(isExpanded ? null : ann.id);
                    }}
                    className="flex-1 text-left px-5 py-3.5 flex items-start gap-3 hover:bg-[#F9FAFB] transition-colors min-w-0"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                        ann.is_published ? "bg-[#059669]" : "bg-[#D1D5DB]"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-[#1A2E2E] truncate">{ann.title}</p>
                        <AudienceBadge audience={ann.audience} />
                        {ann.priority > 0 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            P{ann.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{ann.body}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 bg-[#F3F4F6] px-2 py-1 rounded-full">
                      <HugeiconsIcon icon={EyeIcon} size={11} color="#6B7280" strokeWidth={1.5} />
                      <span className="text-[11px] font-semibold text-[#6B7280]">
                        {ann._view_count ?? 0}
                      </span>
                    </div>
                  </button>

                  {/* Per-row actions */}
                  <div className="flex items-center gap-1 px-3 py-3.5 flex-shrink-0">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={cancelForm}
                        disabled={saving}
                        className="h-7 px-2.5 rounded-lg text-xs font-semibold border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-colors disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(ann)}
                          disabled={saving}
                          className="h-7 px-2.5 rounded-lg text-xs font-semibold border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] transition-colors disabled:opacity-40 flex items-center gap-1"
                        >
                          <HugeiconsIcon
                            icon={PencilEdit01Icon}
                            size={11}
                            color="currentColor"
                            strokeWidth={2}
                          />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePublish(ann)}
                          disabled={saving}
                          className={`h-7 px-2.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${
                            ann.is_published
                              ? "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {ann.is_published ? "Unpublish" : "Publish"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded: edit form or detail view */}
                {(isEditing || isExpanded) && (
                  <div className="border-t border-[#EEF0F0] px-5 py-4">
                    {isEditing ? (
                      <>
                        <AdminSectionLabel>Edit Announcement</AdminSectionLabel>
                        <AnnouncementFormFields
                          form={form}
                          setForm={setForm}
                          saving={saving}
                          onSave={handleUpsert}
                          onCancel={cancelForm}
                          isEdit
                        />
                      </>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-[#1A2E2E] leading-relaxed">{ann.body}</p>

                        {ann.cta_label && (
                          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                            <span className="font-semibold text-[#1A2E2E]">CTA:</span>
                            {ann.cta_label}
                            {ann.cta_url && (
                              <a
                                href={ann.cta_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#059669] underline truncate"
                              >
                                {ann.cta_url}
                              </a>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Publish", value: ann.publish_at },
                            { label: "Expires", value: ann.expires_at },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-start gap-1.5">
                              <HugeiconsIcon
                                icon={Clock01Icon}
                                size={11}
                                color="#9CA3AF"
                                strokeWidth={1.5}
                                className="mt-0.5 shrink-0"
                              />
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                                  {label}
                                </p>
                                <p className="text-xs text-[#1A2E2E]">{fmtDate(value)}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <p className="text-[10px] text-[#9CA3AF]">
                          Created {fmtDate(ann.created_at)}
                          {ann.created_by && ` · ${ann.created_by.slice(0, 8)}…`}
                        </p>

                        {(ann._view_count ?? 0) > 0 ? (
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] mb-1.5 flex items-center gap-1">
                              <HugeiconsIcon icon={UserIcon} size={10} color="#9CA3AF" strokeWidth={1.5} />
                              Seen by {ann._view_count} user
                              {(ann._view_count ?? 0) !== 1 ? "s" : ""}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {(ann._seen_by ?? []).slice(0, 20).map((uid) => (
                                <span
                                  key={uid}
                                  className="px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[10px] font-mono text-[#6B7280]"
                                >
                                  {uid.slice(0, 8)}…
                                </span>
                              ))}
                              {(ann._seen_by?.length ?? 0) > 20 && (
                                <span className="px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[10px] text-[#6B7280]">
                                  +{(ann._seen_by?.length ?? 0) - 20} more
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-[#9CA3AF] italic">No views yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </AdminCard>
            );
          })}
        </div>
      )}
    </DeveloperToolsAdminShell>
  );
}
