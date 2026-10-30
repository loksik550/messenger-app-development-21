import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, avatarGrad, type Chat, type User } from "@/lib/api";
import { native } from "@/lib/native";
import { inviteLink } from "@/components/messenger/InvitePanel";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";

type BookItem = { name: string; phones: string[] };
type NovaUser = { id: number; name: string; phone: string; avatar_url?: string | null; is_contact: boolean };
type PickerContact = { name?: string[]; tel?: string[] };
type ContactsManager = { select: (props: string[], opts?: { multiple?: boolean }) => Promise<PickerContact[]> };

const norm = (p: string) => {
  let d = (p || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10 && d.startsWith("9")) d = "7" + d;
  return d;
};

export default function PhoneBookPanel({
  currentUser, onClose, onStartChat, onContactsChanged, onPickFile,
}: {
  currentUser: User;
  onClose: () => void;
  onStartChat: (chat: Chat) => void;
  onContactsChanged: () => void;
  onPickFile: () => void;
}) {
  useEdgeSwipeBack(onClose);
  const [items, setItems] = useState<BookItem[] | null>(null);
  const [users, setUsers] = useState<Record<string, NovaUser>>({});
  const [state, setState] = useState<"loading" | "ready" | "denied" | "unsupported" | "empty">("loading");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);

  const match = async (list: BookItem[]) => {
    const phones = list.flatMap(i => i.phones);
    const map: Record<string, NovaUser> = {};
    for (let i = 0; i < phones.length; i += 3000) {
      const r = await api("match_phones", { phones: phones.slice(i, i + 3000) }, currentUser.id).catch(() => null);
      for (const u of (r?.users || []) as NovaUser[]) map[norm(u.phone)] = u;
    }
    setUsers(map);
  };

  const load = async () => {
    setState("loading");
    let list: BookItem[] = [];
    if (native.phoneContacts.supported) {
      const r = await native.phoneContacts.list();
      if (r.denied) { setState("denied"); return; }
      list = r.items;
    } else {
      const nav = navigator as Navigator & { contacts?: ContactsManager };
      if (!nav.contacts?.select) { setState("unsupported"); return; }
      try {
        const picked = await nav.contacts.select(["name", "tel"], { multiple: true });
        list = picked
          .map(c => ({ name: c.name?.[0] || c.tel?.[0] || "", phones: (c.tel || []).filter(Boolean) }))
          .filter(c => c.phones.length)
          .sort((a, b) => a.name.localeCompare(b.name, "ru"));
      } catch { setState("unsupported"); return; }
    }
    setItems(list);
    if (!list.length) { setState("empty"); return; }
    setState("ready");
    match(list);
  };

  useEffect(() => {
    load();
    api("my_referral", {}, currentUser.id).then(r => { if (r?.code) setRefCode(r.code); }).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userOf = (it: BookItem) => {
    for (const p of it.phones) { const u = users[norm(p)]; if (u) return u; }
    return null;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    const list = (items || []).filter(it => !q || it.name.toLowerCase().includes(q) || (qd && it.phones.some(p => p.replace(/\D/g, "").includes(qd))));
    const inNova = list.filter(it => userOf(it));
    const others = list.filter(it => !userOf(it));
    return { inNova, others };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, users, search]);

  const openChat = async (u: NovaUser, displayName: string) => {
    setBusyId(`u${u.id}`);
    if (!u.is_contact) {
      await api("add_contact", { phone: u.phone, name: displayName }, currentUser.id).catch(() => null);
      setUsers(prev => ({ ...prev, [norm(u.phone)]: { ...u, is_contact: true } }));
      onContactsChanged();
    }
    const r = await api("get_or_create_chat", { partner_id: u.id }, currentUser.id).catch(() => null);
    setBusyId(null);
    if (r?.chat_id) {
      onStartChat({ id: r.chat_id, name: displayName || u.name, avatar: (displayName || u.name)[0]?.toUpperCase() || "?", avatar_url: u.avatar_url || null, lastMsg: "", time: "", partner_id: u.id });
      onClose();
    }
  };

  const addContact = async (u: NovaUser, displayName: string) => {
    setBusyId(`u${u.id}`);
    const r = await api("add_contact", { phone: u.phone, name: displayName }, currentUser.id).catch(() => null);
    setBusyId(null);
    if (r?.ok) {
      setUsers(prev => ({ ...prev, [norm(u.phone)]: { ...u, is_contact: true } }));
      native.haptic.success();
      onContactsChanged();
    }
  };

  const invite = async (it: BookItem) => {
    const link = refCode ? inviteLink(refCode) : "https://novaa.pro/";
    const text = `Привет${it.name ? ", " + it.name.split(" ")[0] : ""}! Давай общаться в Nova — это бесплатно: ${link}`;
    await native.share({ title: "Nova", text, dialogTitle: "Пригласить в Nova" });
  };

  const Row = ({ it }: { it: BookItem }) => {
    const u = userOf(it);
    const key = it.name + it.phones[0];
    const busy = u && busyId === `u${u.id}`;
    return (
      <div className="flex items-center gap-3 px-4 py-2.5">
        {u?.avatar_url ? (
          <img src={u.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${u ? avatarGrad(u.id) : "from-slate-600 to-slate-700"} flex items-center justify-center font-bold text-white flex-shrink-0`}>
            {(it.name[0] || "#").toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0" onClick={() => u && openChat(u, it.name)}>
          <div className="font-semibold text-sm truncate">{it.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {u ? <span className="text-emerald-400">в Nova</span> : it.phones[0]}
          </div>
        </div>
        {u ? (
          u.is_contact ? (
            <button onClick={() => openChat(u, it.name)} disabled={!!busy} className="px-3 py-1.5 rounded-xl grad-primary text-white text-xs font-semibold disabled:opacity-50">
              Написать
            </button>
          ) : (
            <button onClick={() => addContact(u, it.name)} disabled={!!busy} className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-semibold disabled:opacity-50 flex items-center gap-1">
              <Icon name="UserPlus" size={13} /> Добавить
            </button>
          )
        ) : (
          <button key={key} onClick={() => invite(it)} className="px-3 py-1.5 rounded-xl bg-cyan-500/15 text-cyan-300 text-xs font-semibold">
            Пригласить
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0f0c1d] animate-fade-in">
      <div className="px-4 pb-3 border-b border-white/5" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onClose} className="p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors" aria-label="Назад">
            <Icon name="ChevronLeft" size={22} />
          </button>
          <h2 className="text-lg font-bold flex-1">Контакты телефона</h2>
          {items && <span className="text-xs text-muted-foreground">{items.length}</span>}
        </div>
        {state === "ready" && (
          <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
            <Icon name="Search" size={15} className="text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Имя или номер..." className="flex-1 bg-transparent outline-none text-sm placeholder-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-sm text-muted-foreground">
            <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            Читаем телефонную книгу...
          </div>
        )}

        {(state === "denied" || state === "unsupported" || state === "empty") && (
          <div className="flex flex-col items-center text-center px-8 py-16">
            <div className="w-16 h-16 glass rounded-3xl flex items-center justify-center mb-4">
              <Icon name={state === "denied" ? "ShieldAlert" : "Contact"} fallback="Users" size={28} className="text-violet-400" />
            </div>
            <p className="font-semibold mb-1">
              {state === "denied" ? "Нет доступа к контактам" : state === "empty" ? "Контакты не найдены" : "Откройте Nova в приложении"}
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              {state === "denied"
                ? native.platform === "ios"
                  ? "Разрешите доступ: Настройки iPhone → Nova → Контакты."
                  : "Разрешите доступ: Настройки → Приложения → Nova → Разрешения → Контакты."
                : state === "empty"
                  ? "В телефонной книге нет номеров."
                  : "Браузер не даёт доступ ко всей телефонной книге. В приложении Nova контакты появятся сразу, а здесь можно загрузить файл контактов (.vcf)."}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {state === "denied" && (
                <button onClick={load} className="grad-primary text-white rounded-xl py-2.5 text-sm font-semibold">Попробовать снова</button>
              )}
              {state === "unsupported" && (
                <button onClick={() => { onClose(); onPickFile(); }} className="grad-primary text-white rounded-xl py-2.5 text-sm font-semibold">Загрузить файл .vcf</button>
              )}
            </div>
          </div>
        )}

        {state === "ready" && (
          <>
            {filtered.inNova.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Уже в Nova · {filtered.inNova.length}</div>
                {filtered.inNova.map(it => <Row key={"n" + it.name + it.phones[0]} it={it} />)}
              </>
            )}
            {filtered.others.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-violet-400 uppercase tracking-wider">Пригласить в Nova · {filtered.others.length}</div>
                {filtered.others.map(it => <Row key={"o" + it.name + it.phones[0]} it={it} />)}
              </>
            )}
            {!filtered.inNova.length && !filtered.others.length && (
              <p className="text-center text-sm text-muted-foreground py-12">Ничего не найдено</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}