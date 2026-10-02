import { useState, useRef } from "react";
import { native } from "@/lib/native";
import { track } from "@/lib/track";
import { api } from "@/lib/api";
import { parseVcf } from "@/components/messenger/contacts/parseVcf";

type PickerContact = { name?: string[]; tel?: string[] };
type ContactsManager = {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<PickerContact[]>;
  getProperties: () => Promise<string[]>;
};

export type SyncResult = { added: number; total: number; not_registered: number };
export type FoundFriend = { id: number; name: string; phone: string; avatar_url?: string | null };

export function useContactsImport(currentUserId: number, loadContacts: () => Promise<void>) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<null | SyncResult>(null);
  const [foundFriends, setFoundFriends] = useState<FoundFriend[]>([]);
  const [syncError, setSyncError] = useState("");
  const [showImportHelp, setShowImportHelp] = useState(false);
  const vcfInputRef = useRef<HTMLInputElement>(null);

  const syncPhoneContacts = async () => {
    setSyncError("");
    setSyncResult(null);
    if (native.phoneContacts.supported) {
      setSyncing(true);
      try {
        const { items, denied } = await native.phoneContacts.read();
        if (denied) {
          setSyncError("Нет доступа к контактам. Разрешите его: Настройки → Приложения → Nova → Разрешения → Контакты.");
          return;
        }
        if (items.length === 0) {
          setSyncError("В телефонной книге не нашлось номеров.");
          return;
        }
        track("contacts_sync");
        let added = 0, notReg = 0;
        const found: FoundFriend[] = [];
        for (let i = 0; i < items.length; i += 1000) {
          const data = await api("import_contacts", { contacts: items.slice(i, i + 1000) }, currentUserId);
          if (!data.ok) { setSyncError(data.error || "Не удалось синхронизировать контакты"); return; }
          added += Number(data.added) || 0;
          notReg += Array.isArray(data.not_registered) ? data.not_registered.length : 0;
          if (Array.isArray(data.matched)) found.push(...data.matched);
        }
        setSyncResult({ added, total: items.length, not_registered: notReg });
        setFoundFriends(found);
        try { localStorage.setItem("nova_contacts_synced", String(Date.now())); } catch { /* ignore */ }
        await loadContacts();
        native.haptic.success();
      } catch (e) {
        setSyncError((e as Error).message || "Не удалось получить контакты");
      } finally {
        setSyncing(false);
      }
      return;
    }
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
      const data = await api("import_contacts", { contacts: items }, currentUserId);
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
      const data = await api("import_contacts", { contacts: items }, currentUserId);
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
    if (native.phoneContacts.supported || (nav.contacts && typeof nav.contacts.select === "function")) {
      syncPhoneContacts();
    } else {
      // На iOS / десктопе — показываем подсказку и предлагаем .vcf
      setShowImportHelp(true);
    }
  };

  return {
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
  };
}
