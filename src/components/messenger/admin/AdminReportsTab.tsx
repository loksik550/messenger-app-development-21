import Icon from "@/components/ui/icon";
import { Report, REASON_LABEL, fmtTime } from "./AdminAPI";

interface AdminReportsTabProps {
  visible: boolean;
  reports: Report[];
  statusFilter: "all" | "open" | "resolved";
  onChangeStatusFilter: (s: "all" | "open" | "resolved") => void;
  onResolve: (id: number) => void;
  onDelete: (id: number) => void;
}

export function AdminReportsTab({
  visible, reports, statusFilter, onChangeStatusFilter, onResolve, onDelete,
}: AdminReportsTabProps) {
  if (!visible) return null;
  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex gap-1 glass rounded-xl p-1">
        {(["open", "all", "resolved"] as const).map(s => (
          <button
            key={s}
            onClick={() => onChangeStatusFilter(s)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${statusFilter === s ? "bg-violet-500/30 text-violet-200" : "text-muted-foreground"}`}
          >
            {s === "open" ? "Новые" : s === "all" ? "Все" : "Обработанные"}
          </button>
        ))}
      </div>

      {reports.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-12">
          <Icon name="ShieldCheck" size={32} className="mx-auto mb-2 opacity-40" />
          Жалоб нет
        </div>
      )}

      {reports.map(r => (
        <div key={r.id} className={`glass rounded-2xl p-3 ${r.status === "resolved" ? "opacity-60" : ""}`}>
          <div className="flex items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
              <Icon name="Flag" size={16} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold truncate">{r.reported_name || `ID ${r.reported_user_id}`}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
                  {REASON_LABEL[r.reason] || r.reason}
                </span>
                {r.status === "resolved" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">обработано</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                На кого: {r.reported_phone || "—"} (ID {r.reported_user_id})
              </div>
              <div className="text-xs text-muted-foreground">
                От кого: {r.reporter_name || "—"} (ID {r.reporter_id})
              </div>
              {r.comment && (
                <div className="text-xs text-foreground mt-1.5 bg-white/5 rounded-lg px-2.5 py-1.5">{r.comment}</div>
              )}
              <div className="text-[10px] text-muted-foreground mt-1">{fmtTime(r.created_at)}</div>

              <div className="flex gap-2 mt-2">
                {r.status !== "resolved" && (
                  <button
                    onClick={() => onResolve(r.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition"
                  >
                    Обработано
                  </button>
                )}
                <button
                  onClick={() => onDelete(r.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AdminReportsTab;
