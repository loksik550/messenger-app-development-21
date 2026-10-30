import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { chatSecurity, safetyCode, markVerified, isVerified, type ChatSecurity } from "@/lib/e2e";

interface Dev { id: string; name: string; created_at: number }

export function useChatSecurity(chatId: number, userId: number, enabled: boolean) {
  const [sec, setSec] = useState<ChatSecurity | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const run = () => chatSecurity(chatId, userId, true).then((s) => { if (alive) setSec(s); }).catch(() => { /* ignore */ });
    run();
    const t = setInterval(run, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [chatId, userId, enabled]);
  return sec;
}

export function E2EBadge({ sec, onClick }: { sec: ChatSecurity | null; onClick: () => void }) {
  if (!sec) return null;
  const warn = sec.conflicts.length > 0;
  if (!sec.encrypted && !warn) return null;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onClick(); } }}
      className={`inline-flex items-center gap-1 cursor-pointer ${warn ? "text-red-400" : sec.encrypted ? "text-emerald-400" : "text-muted-foreground"}`}
      title="Шифрование"
    >
      <Icon name={warn ? "ShieldAlert" : sec.encrypted ? "Lock" : "LockOpen"} size={11} />
      <span>{warn ? "Ключ изменился" : sec.encrypted ? "Зашифровано" : "Без шифрования"}</span>
    </span>
  );
}

export default function E2EPanel({
  chatId, userId, partnerName, sec, onClose,
}: {
  chatId: number;
  userId: number;
  partnerName: string;
  sec: ChatSecurity | null;
  onClose: () => void;
}) {
  const [code, setCode] = useState<string>("");
  const [devs, setDevs] = useState<{ mine: Dev[]; partner: Dev[] }>({ mine: [], partner: [] });
  const [verified, setVerified] = useState(() => isVerified(chatId, userId));
  const [err, setErr] = useState("");

  useEffect(() => {
    safetyCode(chatId, userId)
      .then((r) => { setCode(r.code); setDevs(r.devices); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Нет связи"));
  }, [chatId, userId]);

  const groups = code ? code.split(" ") : [];

  return (
    <div className="fixed inset-0 z-[220] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 animate-fade-in" onClick={onClose} style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      <div className="w-full max-w-sm glass-strong rounded-3xl p-5 max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${sec?.encrypted ? "bg-emerald-500/15 text-emerald-400" : "bg-white/8 text-muted-foreground"}`}>
            <Icon name={sec?.encrypted ? "Lock" : "LockOpen"} size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold">{sec?.encrypted ? "Сквозное шифрование" : "Шифрование пока не включено"}</div>
            <div className="text-xs text-muted-foreground">Чат с {partnerName}</div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground"><Icon name="X" size={18} /></button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {sec?.encrypted
            ? "Текст сообщений шифруется на вашем устройстве и расшифровывается только на устройствах собеседника и ваших. Сервер Nova хранит лишь шифр и прочитать его не может."
            : sec?.reason === "service"
              ? "Это служебный аккаунт или бот — с ним сообщения не шифруются."
              : sec?.reason === "unsupported"
                ? "Это устройство не поддерживает шифрование. Обновите браузер или приложение."
                : `Шифрование включится автоматически, как только ${partnerName} откроет Nova на обновлённой версии. До этого сообщения защищены только при передаче.`}
        </p>

        {sec && sec.conflicts.length > 0 && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex gap-2">
            <Icon name="ShieldAlert" size={16} className="shrink-0 mt-0.5" />
            <span>Ключ устройства «{sec.conflicts.join(", ")}» изменился. На него сообщения не отправляются. Сверьте код с собеседником лично.</span>
          </div>
        )}
        {sec && sec.newDevices.length > 0 && sec.conflicts.length === 0 && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex gap-2">
            <Icon name="Smartphone" size={14} className="shrink-0 mt-0.5" />
            <span>Новое устройство собеседника: {sec.newDevices.join(", ")}. Если не уверены — сверьте код.</span>
          </div>
        )}

        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Код безопасности</div>
        {err ? (
          <p className="text-sm text-red-400 mb-4">{err}</p>
        ) : !code ? (
          <div className="flex justify-center py-6"><Icon name="Loader2" size={20} className="animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-5 gap-2 rounded-2xl bg-white/5 p-3 mb-2 font-mono text-[15px] tracking-wider text-center">
            {groups.map((g, i) => <span key={i}>{g}</span>)}
          </div>
        )}
        <p className="text-xs text-muted-foreground mb-4">
          Откройте этот экран у {partnerName} и сравните цифры. Если они совпадают — переписку никто не подменял.
          Код меняется, когда кто-то из вас входит с нового устройства.
        </p>

        <div className="text-xs text-muted-foreground space-y-1 mb-4">
          <div><span className="text-foreground/80">Ваши устройства:</span> {devs.mine.map((d) => d.name || "устройство").join(", ") || "—"}</div>
          <div><span className="text-foreground/80">Устройства {partnerName}:</span> {devs.partner.map((d) => d.name || "устройство").join(", ") || "нет"}</div>
        </div>

        <button
          onClick={() => { markVerified(chatId, userId); setVerified(true); }}
          disabled={!code || verified}
          className="w-full rounded-xl py-3 text-sm font-bold text-white grad-primary disabled:opacity-60"
        >
          {verified ? "Код сверен" : "Цифры совпадают"}
        </button>
      </div>
    </div>
  );
}
