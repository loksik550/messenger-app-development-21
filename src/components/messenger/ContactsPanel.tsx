import { useState, useEffect } from "react";
import { native } from "@/lib/native";
import Icon from "@/components/ui/icon";
import { api, type Contact, type User, type Chat } from "@/lib/api";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import { useContactsImport } from "@/components/messenger/contacts/useContactsImport";
import { ImportHelpModal } from "@/components/messenger/contacts/ImportHelpModal";
import { SyncBanners } from "@/components/messenger/contacts/SyncBanners";
import { AddContactForm } from "@/components/messenger/contacts/AddContactForm";
import { ContactListItem } from "@/components/messenger/contacts/ContactListItem";

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

  const loadContacts = async () => {
    setLoading(true);
    const data = await api("get_contacts", {}, currentUser.id);
    if (data.contacts) setContacts(data.contacts);
    setLoading(false);
  };

  const {
    syncing,
    syncResult,
    setSyncResult,
    foundFriends,
    setFoundFriends,
    syncError,
    setSyncError,
    showImportHelp,
    setShowImportHelp,
    vcfInputRef,
    handleVcfFile,
    startImport,
  } = useContactsImport(currentUser.id, loadContacts);

  useEffect(() => { loadContacts(); }, []);

  // Контакт могли удалить из профиля собеседника — обновляем список
  useEffect(() => {
    const onChanged = () => loadContacts();
    window.addEventListener("nova:contacts-changed", onChanged);
    return () => window.removeEventListener("nova:contacts-changed", onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <SyncBanners
          currentUserId={currentUser.id}
          onStartChat={onStartChat}
          syncResult={syncResult}
          onDismissResult={() => setSyncResult(null)}
          foundFriends={foundFriends}
          onDismissFriends={() => setFoundFriends([])}
          syncError={syncError}
          onDismissError={() => setSyncError("")}
        />
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
        <AddContactForm
          phone={phone}
          setPhone={setPhone}
          name={name}
          setName={setName}
          addError={addError}
          adding={adding}
          onSubmit={addContact}
        />
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
              {syncing ? "Ищем друзей..." : (native.phoneContacts.supported ? "Найти друзей из контактов" : "Импортировать контакты")}
            </button>
          </div>
        )}

        {!loading && Object.keys(grouped).sort().map(letter => (
          <div key={letter}>
            <div className="px-4 py-1.5">
              <span className="text-[11px] font-bold text-violet-400 uppercase tracking-wider">{letter}</span>
            </div>
            {grouped[letter].map(contact => (
              <ContactListItem
                key={contact.id}
                contact={contact}
                onOpen={openChat}
                onCall={onCall}
                onRemove={removeContact}
              />
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
        <ImportHelpModal
          syncing={syncing}
          onClose={() => setShowImportHelp(false)}
          onPickFile={() => vcfInputRef.current?.click()}
        />
      )}
    </div>
  );
}
