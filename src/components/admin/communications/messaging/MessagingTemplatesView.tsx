import { useState, useEffect, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  ArrowReloadHorizontalIcon,
  DocumentCodeIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/developer-tools/DeveloperToolsAdminShell";
import { listTemplates, getTemplate } from "@/services/adminMessaging";
import { MessagingTemplateEditor } from "./MessagingTemplateEditor";
import type { MessagingTemplate } from "./messagingTypes";

export function MessagingTemplatesView() {
  const [templates, setTemplates] = useState<MessagingTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<MessagingTemplate | null | "new">(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listTemplates(showArchived);
      setTemplates(result);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { load(); }, [load]);

  if (editing) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4 py-3">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="text-sm text-[#345C5A] font-semibold hover:underline"
          >
            ← Templates
          </button>
          <span className="text-[#9CA3AF]">/</span>
          <span className="text-sm font-semibold text-[#1C2B2B]">
            {editing === "new" ? "New Template" : (editing as MessagingTemplate).name}
          </span>
        </div>
        <MessagingTemplateEditor
          initial={editing === "new" ? null : editing as MessagingTemplate}
          onSaved={saved => {
            setEditing(null);
            load();
            toast.success(saved.name);
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => setShowArchived(s => !s)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            showArchived
              ? "bg-[#345C5A] text-white border-[#345C5A]"
              : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#345C5A]"
          }`}
        >
          {showArchived ? "Showing Archived" : "Show Archived"}
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-xl border border-[#E5E7EB] text-[#6B7280] hover:border-[#345C5A] transition-colors"
        >
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} className={loading ? "animate-spin" : ""} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#345C5A] text-white text-sm font-semibold hover:bg-[#2a4a48] transition-colors"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={15} />
          New Template
        </button>
      </div>

      {templates.length === 0 && !loading ? (
        <AdminCard className="flex flex-col items-center justify-center py-16 gap-3">
          <HugeiconsIcon icon={DocumentCodeIcon} size={36} className="text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF] font-medium">No templates found</p>
        </AdminCard>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={async () => {
                try {
                  const full = await getTemplate(t.id);
                  setEditing(full);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              className="w-full text-left"
            >
              <AdminCard className="hover:border-[#345C5A]/30 transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  <HugeiconsIcon icon={DocumentCodeIcon} size={16} className="text-[#9CA3AF] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-semibold text-[#1C2B2B]">{t.name}</span>
                      <span className="font-mono text-[10px] bg-[#F3F4F6] text-[#6B7280] px-1.5 py-0.5 rounded">{t.slug}</span>
                      {t.is_transactional && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-1.5 py-0.5 rounded">Transactional</span>
                      )}
                      {t.archived_at && (
                        <span className="text-[10px] bg-stone-100 text-stone-500 font-semibold px-1.5 py-0.5 rounded">Archived</span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-[#9CA3AF] truncate">{t.description}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] whitespace-nowrap">v{t.version}</span>
                </div>
              </AdminCard>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
