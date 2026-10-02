import Icon from "@/components/ui/icon";
import { APP_VERSION } from "@/lib/version";

export function SettingsActions({
  exportBackup,
  onLogout,
  onDeleteAccount,
  onOpenPrivacyPolicy,
  onOpenTerms,
  onOpenHelp,
}: {
  exportBackup: () => void;
  onLogout: () => void;
  onDeleteAccount?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenTerms?: () => void;
  onOpenHelp?: () => void;
}) {
  return (
    <>
        <button
          onClick={exportBackup}
          className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-white/5 transition-all mt-2"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Icon name="Download" size={18} className="text-emerald-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">Резервная копия</div>
            <div className="text-xs text-muted-foreground">Скачать все чаты в файл JSON</div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground ml-auto" />
        </button>

        {onOpenHelp && (
          <button onClick={onOpenHelp} className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-white/8 transition-all mt-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Icon name="CircleHelp" size={18} className="text-cyan-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Помощь</div>
              <div className="text-xs text-muted-foreground">Ответы на частые вопросы</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground ml-auto" />
          </button>
        )}

        {onOpenPrivacyPolicy && (
          <button onClick={onOpenPrivacyPolicy} className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-white/8 transition-all mt-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Icon name="FileText" size={18} className="text-violet-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Политика конфиденциальности</div>
              <div className="text-xs text-muted-foreground">Как мы храним и защищаем ваши данные</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground ml-auto" />
          </button>
        )}

        {onOpenTerms && (
          <button onClick={onOpenTerms} className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-white/8 transition-all mt-2">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Icon name="ScrollText" size={18} className="text-violet-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Пользовательское соглашение</div>
              <div className="text-xs text-muted-foreground">Правила использования и запрещённый контент</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground ml-auto" />
          </button>
        )}

        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-red-500/10 transition-all mt-2">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
            <Icon name="LogOut" size={18} className="text-red-400" />
          </div>
          <span className="text-sm font-medium text-red-400">Выйти из аккаунта</span>
          <Icon name="ChevronRight" size={16} className="text-red-400/50 ml-auto" />
        </button>

        {onDeleteAccount && (
          <button onClick={onDeleteAccount} className="w-full flex items-center gap-3 px-4 py-3 glass rounded-2xl hover:bg-red-500/15 transition-all mt-2 border border-red-500/20">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Icon name="Trash2" size={18} className="text-red-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-red-400">Удалить аккаунт</div>
              <div className="text-xs text-red-300/70">Полное и безвозвратное удаление всех данных</div>
            </div>
            <Icon name="ChevronRight" size={16} className="text-red-400/50 ml-auto" />
          </button>
        )}

        <div className="w-full text-center text-[11px] text-muted-foreground/60 py-6 select-none">
          Nova {APP_VERSION}
        </div>
    </>
  );
}

export default SettingsActions;
