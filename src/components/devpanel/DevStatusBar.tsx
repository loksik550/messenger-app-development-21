import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi, formatNum } from "@/lib/devApi";

interface Health {
  db_ms: number;
  online: number;
  per_min: number;
  db_size_mb: number;
  msgs_24h: number;
  server_time: number;
  env: string;
  healthy: boolean;
}

/** Нижняя строка: живое состояние системы */
export default function DevStatusBar() {
  const [h, setHealth] = useState<Health | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const load = () => {
      devApi<Health>("system_health")
        .then(setHealth)
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 30000);
    const tick = setInterval(() => {
      setClock(
        new Date().toLocaleTimeString("ru", {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        }),
      );
    }, 1000);
    return () => {
      clearInterval(timer);
      clearInterval(tick);
    };
  }, []);

  if (!h) return null;

  return (
    <div className="shrink-0 border-t border-white/8 bg-black/30 backdrop-blur-sm px-4 py-2 flex items-center gap-4 text-[11px] text-slate-500 overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={`w-2 h-2 rounded-full ${
            h.healthy ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
          }`}
        />
        <span className={h.healthy ? "text-emerald-400" : "text-amber-400"}>
          {h.healthy ? "Всё работает" : "Замедление"}
        </span>
      </div>

      <Cell icon="Users" text={`В сети: ${formatNum(h.online)}`} />
      <Cell icon="MessageSquare" text={`Сообщений/мин: ${formatNum(h.per_min)}`} />
      <Cell icon="Zap" text={`Отклик: ${h.db_ms} мс`} />
      <Cell icon="Database" text={`База: ${h.db_size_mb} МБ`} />
      <Cell icon="Activity" text={`За сутки: ${formatNum(h.msgs_24h)}`} />

      <div className="ml-auto shrink-0 flex items-center gap-1.5 whitespace-nowrap">
        <Icon name="Clock" size={12} />
        Время сервера: {clock || "—"} МСК
      </div>
    </div>
  );
}

function Cell({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
      <Icon name={icon} size={12} />
      {text}
    </div>
  );
}

/** Значок окружения рядом с названием раздела */
export function DevEnvBadge() {
  const [env, setEnv] = useState("");

  useEffect(() => {
    devApi<{ env: string }>("system_health")
      .then((r) => setEnv(r.env || "PRODUCTION"))
      .catch(() => setEnv("PRODUCTION"));
  }, []);

  if (!env) return null;
  const live = env === "PRODUCTION";

  return (
    <span
      className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider border ${
        live
          ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-400"
          : "bg-amber-500/12 border-amber-500/30 text-amber-400"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
      {env}
    </span>
  );
}
