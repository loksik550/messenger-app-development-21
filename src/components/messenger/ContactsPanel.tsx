import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { api, avatarGrad, type Contact, type User, type Chat } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";

type PickerContact = { name?: string[]; tel?: string[] };
type ContactsManager = {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<PickerContact[]>;
  getProperties: () => Promise<string[]>;
};

export function ContactsPanel({
  currentUser,
  onStartChat,
  onCall,
  onBack,
}: {
  currentUser: User;
  onStartChat: (chat: Chat) => void;
  onCall: (contact: Contact) => void;
  onBack?: () => void;
}) {
  useEdgeSwipeBack(onBack);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<null | { added: number; total: number; not_registered: number }>(null);
  const [syncError, setSyncError] = useState("");
  const [showImportHelp, setShowImportHelp] = useState(false);
  const vcfInputRef = useRef<HTMLInputElement>(null);

  const loadContacts = async () => {
    setLoading(true);
    const data = await api("get_contacts", {}, currentUser.id);
    if (data.contacts) setContacts(data.contacts);
    setLoading(false);
  };

  useEffect(() => { loadContacts(); }, []);

  const addContact = async () => {
    if (!phone.trim()) return;
    setAdding(true);
    setAddError("");
    const data = await api("add_contact", { phone: phone.trim(), name: name.trim() || undefined }, currentUser.id);
    if (data.ok) {
      setPhone("");
      setName("");
      setShowAdd(false);
      loadContacts();
    } else {
      setAddError(data.error || "Ошибка");
    }
    setAdding(false);
  };

  const syncPhoneContacts = async () => {
    setSyncError("");
    setSyncResult(null);
    const nav = navigator as Navigator & { contacts?: ContactsManager };
    if (!nav.contacts || typeof nav.contacts.select !== "function") {
      setShowImportHelp(true);
      return;
    }
    try {
      setSyncing(true);
      const props = await nav.contacts.getProperties();
      if (!props.includes("tel")) {
        setSyncError("Браузер не разрешает читать номера телефонов из контактов.");
        return;
      }
      const picked = await nav.contacts.select(["name", "tel"], { multiple: true });
      const items: { phone: string; name?: string }[] = [];
      for (const c of picked) {
        const nm = (c.name && c.name[0]) || undefined;
        const tels = c.tel || [];
        for (const t of tels) {
          if (t && typeof t === "string") items.push({ phone: t, name: nm });
        }
      }
      if (items.length === 0) {
        setSyncError("Не выбрано ни одного контакта с номером.");
        return;
      }
      const data = await api("import_contacts", { contacts: items }, currentUser.id);
      if (data.ok) {
        setSyncResult({
          added: Number(data.added) || 0,
          total: items.length,
          not_registered: Array.isArray(data.not_registered) ? data.not_registered.length : 0,
        });
        await loadContacts();
        try { (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(20); } catch { /* ignore */ }
      } else {
        setSyncError(data.error || "Не удалось синхронизировать контакты");
      }
    } catch (e) {
      setSyncError((e as Error).message || "Не удалось получить контакты");
    } finally {
      setSyncing(false);
    }
  };

  const parseVcf = (text: string): { phone: string; name?: string }[] => {
    const items: { phone: string; name?: string }[] = [];
    // Каждый контакт — между BEGIN:VCARD и END:VCARD
    const cards = text.split(/BEGIN:VCARD/i).slice(1);
    for (const raw of cards) {
      const block = raw.split(/END:VCARD/i)[0] || "";
      // Склейка многострочных значений (продолжение начинается с пробела)
      const lines = block.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
      let displayName: string | undefined;
      let structuredName: string | undefined;
      const phones: string[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const colon = line.indexOf(":");
        if (colon < 0) continue;
        const left = line.slice(0, colon);
        const value = line.slice(colon + 1).trim();
        const upper = left.toUpperCase();
        if (upper === "FN" || upper.startsWith("FN;")) {
          displayName = value;
        } else if (upper === "N" || upper.startsWith("N;")) {
          // N: фамилия;имя;отчество;префикс;суффикс
          const parts = value.split(";").map(p => p.trim()).filter(Boolean);
          if (parts.length >= 2) structuredName = `${parts[1]} ${parts[0]}`.trim();
          else if (parts.length === 1) structuredName = parts[0];
        } else if (upper === "TEL" || upper.startsWith("TEL;") || upper.startsWith("TEL:")) {
          const cleaned = value.replace(/[^\d+]/g, "");
          if (cleaned.length >= 5) phones.push(cleaned);
        }
      }
      const nm = displayName || structuredName;
      for (const p of phones) {
        items.push({ phone: p, name: nm });
      }
    }
    return items;
  };

  const handleVcfFile = async (file: File) => {
    setSyncError("");
    setSyncResult(null);
    try {
      setSyncing(true);
      const text = await file.text();
      const items = parseVcf(text);
      if (items.length === 0) {
        setSyncError("В файле не найдено контактов с номерами. Убедись, что это .vcf (vCard).");
        return;
      }
      const data = await api("import_contacts", { contacts: items }, currentUser.id);
      if (data.ok) {
        setSyncResult({
          added: Number(data.added) || 0,
          total: items.length,
          not_registered: Array.isArray(data.not_registered) ? data.not_registered.length : 0,
        });
        await loadContacts();
        try { (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(20); } catch { /* ignore */ }
      } else {
        setSyncError(data.error || "Не удалось импортировать контакты");
      }
    } catch (e) {
      setSyncError((e as Error).message || "Не удалось прочитать файл");
    } finally {
      setSyncing(false);
      if (vcfInputRef.current) vcfInputRef.current.value = "";
    }
  };

  const startImport = () => {
    const nav = navigator as Navigator & { contacts?: ContactsManager };
    if (nav.contacts && typeof nav.contacts.select === "function") {
      syncPhoneContacts();
    } else {
      // На iOS / десктопе — показываем подсказку и предлагаем .vcf
      setShowImportHelp(true);
    }
  };

  const removeContact = async (contactId: number) => {
    await api("remove_contact", { contact_id: contactId }, currentUser.id);
    setContacts(prev => prev.filter(c => c.id !== contactId));
  };

  const openChat = async (contact: Contact) => {
    const data = await api("get_or_create_chat", { partner_id: contact.id }, currentUser.id);
    if (data.chat_id) {
      onStartChat({
        id: data.chat_id,
        name: contact.name,
        avatar: contact.name[0]?.toUpperCase() || "?",
        lastMsg: "",
        time: "",
        partner_id: contact.id,
      });
    }
  };

  const filtered = contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  // Group by first letter
  const grouped = filtered.reduce<Record<string, Contact[]>>((acc, c) => {
    const letter = c.name[0]?.toUpperCase() || "#";
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 py-4 glass-strong border-b border-white/5" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-1 min-w-0">
            {onBack && (
              <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/8 transition-colors flex-shrink-0">
                <Icon name="ChevronLeft" size={20} />
              </button>
            )}
            <h2 className="text-lg font-bold truncate">Контакты</h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={startImport}
              disabled={syncing}
              title="Импортировать контакты"
              className="p-2 rounded-xl transition-all glass hover:bg-white/8 text-muted-foreground disabled:opacity-50"
            >
              {syncing ? (
                <div className="w-[18px] h-[18px] border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              ) : (
                <Icon name="RefreshCw" size={18} />
              )}
            </button>
            <button
              onClick={() => { setShowAdd(v => !v); setAddError(""); }}
              className={`p-2 rounded-xl transition-all ${showAdd ? "grad-primary text-white" : "glass hover:bg-white/8 text-muted-foreground"}`}
            >
              <Icon name={showAdd ? "X" : "UserPlus"} size={18} />
            </button>
          </div>
        </div>
        {syncResult && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2 animate-fade-in">
            <Icon name="CheckCircle2" size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              Добавлено {syncResult.added} из {syncResult.total}.{" "}
              {syncResult.not_registered > 0 && (
                <span className="text-emerald-300/70">{syncResult.not_registered} ещё не в Nova.</span>
              )}
            </div>
            <button onClick={() => setSyncResult(null)} className="text-emerald-300/60 hover:text-emerald-300">
              <Icon name="X" size={12} />
            </button>
          </div>
        )}
        {syncError && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2 animate-fade-in">
            <Icon name="AlertTriangle" size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">{syncError}</div>
            <button onClick={() => setSyncError("")} className="text-amber-300/60 hover:text-amber-300">
              <Icon name="X" size={12} />
            </button>
          </div>
        )}
        {/* Search */}
        <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
          <Icon name="Search" size={15} className="text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск контактов..."
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder-muted-foreground"
          />
        </div>
      </div>

      {/* Add contact form */}
      {showAdd && (
        <div className="px-4 py-4 border-b border-white/5 glass animate-fade-in">
          <p className="text-xs text-muted-foreground mb-3">Добавить по номеру телефона</p>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Номер телефона (+79991234567)"
            className="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none text-foreground placeholder-muted-foreground mb-2"
          />
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Имя (необязательно)"
            className="w-full glass rounded-xl px-4 py-2.5 text-sm outline-none text-foreground placeholder-muted-foreground mb-2"
          />
          {addError && <p className="text-red-400 text-xs mb-2">{addError}</p>}
          <button
            onClick={addContact}
            disabled={adding || !phone.trim()}
            className="w-full grad-primary text-white rounded-xl py-2.5 text-sm font-semibold glow-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {adding ? "Добавляем..." : "Добавить контакт"}
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && contacts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center px-8">
            <div className="w-16 h-16 glass rounded-3xl flex items-center justify-center mb-4">
              <Icon name="Users" size={28} className="text-violet-400" />
            </div>
            <p className="font-semibold mb-1">Контактов пока нет</p>
            <p className="text-sm text-muted-foreground mb-4">Импортируй телефонную книгу или добавь номер вручную</p>
            <button
              onClick={startImport}
              disabled={syncing}
              className="grad-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold glow-primary transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              <Icon name="RefreshCw" size={16} />
              {syncing ? "Синхронизируем..." : "Импортировать контакты"}
            </button>
          </div>
        )}

        {!loading && Object.keys(grouped).sort().map(letter => (
          <div key={letter}>
            <div className="px-4 py-1.5">
              <span className="text-[11px] font-bold text-violet-400 uppercase tracking-wider">{letter}</span>
            </div>
            {grouped[letter].map(contact => (
              <div
                key={contact.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer group"
                onClick={() => openChat(contact)}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0 ${avatarGrad(contact.id)}`}
                >
                  {contact.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{contact.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); onCall(contact); }}
                    className="p-2 glass rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Icon name="Phone" size={15} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); removeContact(contact.id); }}
                    className="p-2 glass rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Icon name="UserMinus" size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <input
        ref={vcfInputRef}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        multiple
        className="hidden"
        onChange={async e => {
          const files = Array.from(e.target.files || []);
          for (const f of files) await handleVcfFile(f);
        }}
      />

      {showImportHelp && (
        <div
          className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in"
          onClick={() => setShowImportHelp(false)}
        >
          <div
            className="w-full sm:max-w-md glass-strong rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl grad-primary flex items-center justify-center">
                  <Icon name="Users" size={18} className="text-white" />
                </div>
                <h3 className="text-base font-bold">Импорт контактов</h3>
              </div>
              <button onClick={() => setShowImportHelp(false)} className="p-2 rounded-xl hover:bg-white/8">
                <Icon name="X" size={16} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Прямой доступ к телефонной книге работает только в Android Chrome. На iPhone, Mac и Windows используй файл vCard (.vcf).
            </p>

            <div className="glass rounded-2xl p-3 mb-3">
              <div className="text-xs font-bold mb-2 flex items-center gap-1.5">
                <Icon name="Smartphone" size={12} className="text-violet-400" />
                Как получить .vcf на iPhone
              </div>
              <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal pl-4">
                <li>Открой приложение «Контакты»</li>
                <li>Нажми «Списки» → выбери «Все контакты»</li>
                <li>Долгое нажатие → «Поделиться»</li>
                <li>Выбери «Сохранить в Файлы» — получится .vcf</li>
                <li>Загрузи его сюда кнопкой ниже</li>
              </ol>
            </div>

            <div className="glass rounded-2xl p-3 mb-4">
              <div className="text-xs font-bold mb-2 flex items-center gap-1.5">
                <Icon name="Monitor" size={12} className="text-violet-400" />
                На Mac / Windows
              </div>
              <p className="text-[11px] text-muted-foreground">
                В приложении «Контакты» (Mac) или «Люди» (Windows) выдели всех → «Экспорт» → формат vCard (.vcf).
              </p>
            </div>

            <button
              onClick={() => vcfInputRef.current?.click()}
              disabled={syncing}
              className="w-full grad-primary text-white rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Загружаем...
                </>
              ) : (
                <>
                  <Icon name="Upload" size={16} />
                  Загрузить .vcf файл
                </>
              )}
            </button>
            <p className="text-[10px] text-muted-foreground text-center mt-3">
              Файл обрабатывается у тебя в браузере, мы загружаем только номера и имена.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}