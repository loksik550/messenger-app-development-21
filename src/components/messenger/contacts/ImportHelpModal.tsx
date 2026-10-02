import Icon from "@/components/ui/icon";

export function ImportHelpModal({
  syncing,
  onClose,
  onPickFile,
}: {
  syncing: boolean;
  onClose: () => void;
  onPickFile: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in"
      onClick={onClose}
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
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8">
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
          onClick={onPickFile}
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
  );
}

export default ImportHelpModal;
