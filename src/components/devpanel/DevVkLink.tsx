import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import { devApi } from "@/lib/devApi";
import { useDevVk } from "./useDevVk";

export default function DevVkLink() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");

  const load = () =>
    devApi<{ linked: boolean }>("vk_me")
      .then((r) => setLinked(r.linked))
      .catch(() => setLinked(false));

  const vk = useDevVk(() => {
    setMsg("ВКонтакте привязан — теперь можно входить в панель через ВК");
    load();
  });

  useEffect(() => { load(); }, []);

  const unlink = async () => {
    if (!confirm("Отвязать ВКонтакте? Входить в панель через ВК больше не получится.")) return;
    await devApi("vk_unlink").catch(() => undefined);
    setMsg("ВКонтакте отвязан");
    load();
  };

  if (linked === null) return null;

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0077FF] flex items-center justify-center shrink-0">
          <span className="text-white font-black text-xs">VK</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Вход через ВКонтакте</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {linked ? "Привязан — можно входить в панель без пароля" : "Привяжите ВК, чтобы входить в панель в одно касание"}
          </p>
        </div>
        {linked ? (
          <button onClick={unlink} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10 shrink-0">
            Отвязать
          </button>
        ) : (
          <button
            onClick={() => vk.start("vk_link_start")}
            disabled={vk.busy}
            className="px-3 py-2 rounded-xl bg-[#0077FF] hover:bg-[#0069e0] text-white text-xs font-semibold disabled:opacity-60 shrink-0"
          >
            {vk.busy ? "Ждём ВК…" : "Привязать"}
          </button>
        )}
      </div>
      {(msg || vk.error) && (
        <p className={`text-xs mt-3 flex items-center gap-1.5 ${vk.error ? "text-red-400" : "text-emerald-400"}`}>
          <Icon name={vk.error ? "CircleAlert" : "CircleCheck"} size={13} />
          {vk.error || msg}
        </p>
      )}
    </div>
  );
}
