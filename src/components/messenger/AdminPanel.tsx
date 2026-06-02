import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import {
  adminApi,
  Stats,
  SupportTicket,
  SupportMsg,
  AdminUser,
  Report,
} from "./admin/AdminAPI";
import { AdminStatsTab } from "./admin/AdminStatsTab";
import { AdminUsersTab } from "./admin/AdminUsersTab";
import { AdminSupportTab } from "./admin/AdminSupportTab";
import { AdminReportsTab } from "./admin/AdminReportsTab";

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState(() => sessionStorage.getItem("nova_admin_token") || "");
  const [authed, setAuthed] = useState(false);
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<"stats" | "users" | "support" | "reports">("stats");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [supportUnread, setSupportUnread] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsOpenCount, setReportsOpenCount] = useState(0);
  const [reportsStatusFilter, setReportsStatusFilter] = useState<"all" | "open" | "resolved">("open");
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportMsg[]>([]);
  const [ticketReply, setTicketReply] = useState("");
  const [ticketSending, setTicketSending] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<"all" | "open" | "closed">("open");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [confirmClearMsgs, setConfirmClearMsgs] = useState(false);
  const [clearingMsgs, setClearingMsgs] = useState(false);
  const [clearMsgsResult, setClearMsgsResult] = useState<string | null>(null);
  const [confirmNuke, setConfirmNuke] = useState(false);
  const [nuking, setNuking] = useState(false);
  const [nukeResult, setNukeResult] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [apiError, setApiError] = useState<string>("");

  // Авто-скрытие баннера ошибки
  useEffect(() => {
    if (!apiError) return;
    const t = setTimeout(() => setApiError(""), 4000);
    return () => clearTimeout(t);
  }, [apiError]);

  const login = async () => {
    setAuthError("");
    if (!authInput.trim()) { setAuthError("Введите пароль"); return; }
    setAuthLoading(true);
    const data = await adminApi("stats", {}, authInput);
    setAuthLoading(false);
    if (data.users) {
      setToken(authInput);
      sessionStorage.setItem("nova_admin_token", authInput);
      setAuthed(true);
      setStats(data as unknown as Stats);
    } else if (data.error) {
      setAuthError(`Ошибка: ${data.error}`);
    } else {
      setAuthError("Неверный пароль");
    }
  };

  const loadStats = useCallback(async () => {
    const data = await adminApi("stats", {}, token);
    if (data.users) setStats(data as unknown as Stats);
    else if (data.error) setApiError(`Не удалось загрузить статистику: ${data.error}`);
  }, [token]);

  const loadUsers = useCallback(async (q = "") => {
    setLoading(true);
    const data = await adminApi("users", { search: q, limit: 50 }, token);
    if (data.users) {
      setUsers(data.users as AdminUser[]);
      setUsersTotal(data.total as number);
    } else if (data.error) setApiError(`Не удалось загрузить список: ${data.error}`);
    setLoading(false);
  }, [token]);

  const loadTickets = useCallback(async (status: "all" | "open" | "closed" = "open") => {
    const data = await adminApi("support_list_tickets", { status }, token);
    if (Array.isArray(data?.tickets)) {
      setTickets(data.tickets as SupportTicket[]);
      setSupportUnread((data.total_unread as number) || 0);
    }
  }, [token]);

  const loadTicketMessages = useCallback(async (ticketId: number) => {
    const data = await adminApi("support_admin_messages", { ticket_id: ticketId }, token);
    if (data?.messages) setTicketMessages(data.messages as SupportMsg[]);
    if (data?.ticket) setActiveTicket(data.ticket as SupportTicket);
    loadTickets(ticketStatusFilter);
  }, [token, ticketStatusFilter, loadTickets]);

  const loadReports = useCallback(async (status: "all" | "open" | "resolved" = "open") => {
    const data = await adminApi("reports_list", { status }, token);
    if (Array.isArray(data?.reports)) {
      setReports(data.reports as Report[]);
      setReportsOpenCount((data.open_count as number) || 0);
    } else if (data?.error) setApiError(`Не удалось загрузить жалобы: ${data.error}`);
  }, [token]);

  const handleChangeReportsFilter = (s: "all" | "open" | "resolved") => {
    setReportsStatusFilter(s);
    loadReports(s);
  };

  const handleResolveReport = async (id: number) => {
    await adminApi("report_resolve", { report_id: id }, token);
    loadReports(reportsStatusFilter);
  };

  const handleDeleteReport = async (id: number) => {
    setReports(prev => prev.filter(r => r.id !== id));
    await adminApi("report_delete", { report_id: id }, token);
    loadReports(reportsStatusFilter);
  };

  useEffect(() => {
    if (token) {
      adminApi("stats", {}, token).then(d => {
        if (d.users) { setAuthed(true); setStats(d as unknown as Stats); }
      });
    }
  }, [token]);

  // Периодически обновляем счётчик непрочитанных тикетов
  useEffect(() => {
    if (!authed) return;
    loadTickets(ticketStatusFilter);
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadTickets(ticketStatusFilter);
    }, 30000);
    return () => clearInterval(t);
  }, [authed, ticketStatusFilter, loadTickets]);

  // Активный тикет — авто-poll
  useEffect(() => {
    if (!authed || !activeTicket) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadTicketMessages(activeTicket.id);
    }, 10000);
    return () => clearInterval(t);
  }, [authed, activeTicket, loadTicketMessages]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "stats") loadStats();
    if (tab === "users") loadUsers(search);
    if (tab === "support") loadTickets(ticketStatusFilter);
    if (tab === "reports") loadReports(reportsStatusFilter);
  }, [tab, authed]);

  // Периодически обновляем счётчик новых жалоб
  useEffect(() => {
    if (!authed) return;
    loadReports(reportsStatusFilter);
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadReports(reportsStatusFilter);
    }, 30000);
    return () => clearInterval(t);
  }, [authed, reportsStatusFilter, loadReports]);

  const openUser = async (u: AdminUser) => {
    const data = await adminApi("user_detail", { user_id: u.id }, token);
    if (data.user) {
      setSelectedUser(data.user as AdminUser);
      setEditName((data.user as AdminUser).name);
    }
  };

  const saveUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    const data = await adminApi("update_user", { user_id: selectedUser.id, name: editName }, token);
    if (data.user) {
      const updated = data.user as AdminUser;
      setSelectedUser(updated);
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, name: updated.name } : u));
    }
    setSaving(false);
  };

  const deleteUser = (userId: number) => {
    setConfirmDelete(userId);
  };

  const confirmDeleteUser = async () => {
    if (!confirmDelete) return;
    const data = await adminApi("delete_user", { user_id: confirmDelete }, token);
    if (data.ok) {
      setUsers(prev => prev.filter(u => u.id !== confirmDelete));
      setSelectedUser(null);
    } else {
      alert("Не удалось удалить: " + (data.error || "ошибка"));
    }
    setConfirmDelete(null);
  };

  const runClearTestData = async () => {
    setClearing(true);
    setClearResult(null);
    const data = await adminApi("clear_test_data", {}, token);
    setClearing(false);
    setConfirmClear(false);
    if (data.ok) {
      setClearResult(`Обезличено пользователей: ${data.cleared}`);
      setUsers([]);
      loadStats();
      setTimeout(() => setClearResult(null), 4000);
    } else {
      setClearResult("Ошибка: " + (data.error || "не удалось"));
    }
  };

  const runNukeAll = async () => {
    setNuking(true);
    setNukeResult(null);
    const data = await adminApi("nuke_all", {}, token);
    setNuking(false);
    setConfirmNuke(false);
    if (data.ok) {
      setNukeResult(`Снесено: ${data.users} юзеров, ${data.messages} сообщений, ${data.chats} чатов`);
      setUsers([]);
      loadStats();
      setTimeout(() => setNukeResult(null), 6000);
    } else {
      setNukeResult("Ошибка: " + (data.error || "не удалось"));
    }
  };

  const runClearAllMessages = async () => {
    setClearingMsgs(true);
    setClearMsgsResult(null);
    const data = await adminApi("clear_all_messages", {}, token);
    setClearingMsgs(false);
    setConfirmClearMsgs(false);
    if (data.ok) {
      setClearMsgsResult(`Очищено сообщений: ${data.cleared_messages}`);
      loadStats();
      setTimeout(() => setClearMsgsResult(null), 4000);
    } else {
      setClearMsgsResult("Ошибка: " + (data.error || "не удалось"));
    }
  };

  const handleSearchChange = (q: string) => {
    setSearch(q);
    loadUsers(q);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedUser) return;
    setMessageSending(true);
    await adminApi("send_to_user", { user_id: selectedUser.id, text: messageText.trim() }, token);
    setMessageSending(false);
    setShowMessage(false);
    setMessageText("");
  };

  const handleChangeTicketStatusFilter = (s: "all" | "open" | "closed") => {
    setTicketStatusFilter(s);
    loadTickets(s);
  };

  const handleOpenTicket = (t: SupportTicket) => {
    setActiveTicket(t);
    loadTicketMessages(t.id);
  };

  const handleCloseActiveTicket = () => {
    setActiveTicket(null);
    setTicketMessages([]);
  };

  const handleCloseTicket = async () => {
    if (!activeTicket) return;
    await adminApi("support_admin_close", { ticket_id: activeTicket.id }, token);
    setActiveTicket({ ...activeTicket, status: "closed" });
    loadTickets(ticketStatusFilter);
  };

  const handleSendReply = async () => {
    if (!activeTicket) return;
    if (!ticketReply.trim() || ticketSending) return;
    const text = ticketReply.trim();
    setTicketReply("");
    setTicketSending(true);
    await adminApi("support_admin_reply", { ticket_id: activeTicket.id, text }, token);
    setTicketSending(false);
    loadTicketMessages(activeTicket.id);
  };

  if (!authed) return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-strong rounded-3xl p-8 w-full max-w-sm mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
              <Icon name="Terminal" size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Dev Panel</h2>
              <p className="text-xs text-muted-foreground">Только для администратора</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>
        <input
          type="password"
          value={authInput}
          onChange={e => setAuthInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && login()}
          placeholder="Пароль администратора"
          className="w-full glass rounded-xl px-4 py-3 text-sm outline-none mb-3 text-foreground placeholder-muted-foreground"
          autoFocus
        />
        {authError && <p className="text-red-400 text-xs mb-3">{authError}</p>}
        <button
          onClick={login}
          disabled={authLoading}
          className="w-full grad-primary text-white rounded-xl py-3 font-bold text-sm glow-primary disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {authLoading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          {authLoading ? "Проверяем…" : "Войти"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[hsl(var(--background))] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 glass-strong border-b border-white/5" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-500/20 rounded-xl flex items-center justify-center">
            <Icon name="Terminal" size={16} className="text-violet-400" />
          </div>
          <span className="font-bold">Nova Dev Panel</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => tab === "stats" ? loadStats() : tab === "users" ? loadUsers(search) : tab === "support" ? loadTickets(ticketStatusFilter) : loadReports(reportsStatusFilter)} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground" title="Обновить">
            <Icon name="RefreshCw" size={16} />
          </button>
          <button onClick={onClose} className="p-2 glass rounded-xl text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mt-3 mb-3 glass rounded-2xl p-1 gap-1">
        {(["stats", "users", "support", "reports"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t ? "grad-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "stats" ? "📊 Нагрузка" : t === "users" ? "👥 Юзеры" : t === "support" ? "🛟 Тикеты" : "🚩 Жалобы"}
            {t === "support" && supportUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {supportUnread > 99 ? "99+" : supportUnread}
              </span>
            )}
            {t === "reports" && reportsOpenCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {reportsOpenCount > 99 ? "99+" : reportsOpenCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">

        {apiError && (
          <div className="mb-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2 animate-fade-in">
            <Icon name="AlertCircle" size={15} />
            <span className="flex-1">{apiError}</span>
            <button onClick={() => setApiError("")} className="opacity-70 hover:opacity-100"><Icon name="X" size={13} /></button>
          </div>
        )}

        {tab === "stats" && (
          <AdminStatsTab
            stats={stats}
            token={token}
            confirmNuke={confirmNuke}
            setConfirmNuke={setConfirmNuke}
            nuking={nuking}
            nukeResult={nukeResult}
            onNukeAll={runNukeAll}
            confirmClear={confirmClear}
            setConfirmClear={setConfirmClear}
            clearing={clearing}
            clearResult={clearResult}
            onClearTestData={runClearTestData}
            confirmClearMsgs={confirmClearMsgs}
            setConfirmClearMsgs={setConfirmClearMsgs}
            clearingMsgs={clearingMsgs}
            clearMsgsResult={clearMsgsResult}
            onClearAllMessages={runClearAllMessages}
          />
        )}

        <AdminUsersTab
          visible={tab === "users"}
          users={users}
          usersTotal={usersTotal}
          search={search}
          onSearchChange={handleSearchChange}
          loading={loading}
          onOpenUser={openUser}
          onDeleteUser={deleteUser}
          selectedUser={selectedUser}
          onCloseSelected={() => setSelectedUser(null)}
          editName={editName}
          setEditName={setEditName}
          saving={saving}
          onSaveUser={saveUser}
          showMessage={showMessage}
          setShowMessage={setShowMessage}
          messageText={messageText}
          setMessageText={setMessageText}
          messageSending={messageSending}
          onSendMessage={handleSendMessage}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          onConfirmDelete={confirmDeleteUser}
        />

        <AdminSupportTab
          visible={tab === "support"}
          tickets={tickets}
          ticketStatusFilter={ticketStatusFilter}
          onChangeStatusFilter={handleChangeTicketStatusFilter}
          onOpenTicket={handleOpenTicket}
          activeTicket={activeTicket}
          ticketMessages={ticketMessages}
          ticketReply={ticketReply}
          setTicketReply={setTicketReply}
          ticketSending={ticketSending}
          onCloseActiveTicket={handleCloseActiveTicket}
          onCloseTicket={handleCloseTicket}
          onSendReply={handleSendReply}
        />

        <AdminReportsTab
          visible={tab === "reports"}
          reports={reports}
          statusFilter={reportsStatusFilter}
          onChangeStatusFilter={handleChangeReportsFilter}
          onResolve={handleResolveReport}
          onDelete={handleDeleteReport}
        />
      </div>
    </div>
  );
}

export default AdminPanel;