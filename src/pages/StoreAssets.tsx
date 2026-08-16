import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

/**
 * Страница со скриншотами для магазина приложений.
 * Здесь их можно посмотреть и скачать — по одному или все сразу.
 */

const SHOTS = [
  {
    file: "nova-1-chats.png",
    title: "Список чатов",
    desc: "Главный экран: чаты, группы, истории и фильтры",
  },
  {
    file: "nova-2-profile.png",
    title: "Профиль",
    desc: "Личные данные, кошелёк, Premium и боты",
  },
  {
    file: "nova-3-security.png",
    title: "Безопасность",
    desc: "Шифрование, двухфакторный вход и отпечаток",
  },
  {
    file: "nova-4-chat.png",
    title: "Переписка",
    desc: "Сообщения, голосовые, файлы и звонки",
  },
];

export default function StoreAssets() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    document.title = "Скриншоты Nova для магазина";
  }, []);

  const downloadOne = (file: string) => {
    const a = document.createElement("a");
    a.href = `/store/${file}`;
    a.download = file;
    a.click();
  };

  const downloadAll = async () => {
    setBusy(true);
    setMsg("");
    try {
      for (const s of SHOTS) {
        downloadOne(s.file);
        await new Promise((r) => setTimeout(r, 600));
      }
      setMsg("Все четыре скачаны — проверьте папку «Загрузки»");
      setTimeout(() => setMsg(""), 6000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white px-5 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <Icon name="Images" size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">Скриншоты для магазина</h1>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          Четыре экрана Nova в формате 1080×1920. Вертикальные, без посторонних
          элементов и личных данных.
        </p>

        <div className="bg-emerald-500/[0.07] border border-emerald-500/20 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Icon name="CircleCheck" size={18} className="text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-300 leading-relaxed">
              <div className="font-semibold text-white mb-1.5">Что исправлено</div>
              <ul className="space-y-1 text-slate-400">
                <li>· Один размер у всех — 1080×1920, вертикально</li>
                <li>· Убран личный номер телефона с профиля</li>
                <li>· Заменена картинка профиля на нейтральную</li>
                <li>· Убрана полоса прокрутки и обрезанные строки</li>
                <li>· Экраны заполнены — нет пустых областей</li>
                <li>· Показана настоящая работа приложения</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          onClick={downloadAll}
          disabled={busy}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 font-semibold mb-3 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Icon name="Download" size={18} />
          {busy ? "Скачиваю..." : "Скачать все четыре"}
        </button>

        {msg && (
          <div className="text-sm text-emerald-400 mb-4 flex items-center gap-2">
            <Icon name="CircleCheck" size={15} />
            {msg}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {SHOTS.map((s, i) => (
            <div key={s.file} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
              <a href={`/store/${s.file}`} target="_blank" rel="noreferrer">
                <img
                  src={`/store/${s.file}`}
                  alt={s.title}
                  className="w-full block border-b border-white/8"
                />
              </a>
              <div className="p-3">
                <div className="text-sm font-semibold">
                  {i + 1}. {s.title}
                </div>
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">{s.desc}</div>
                <button
                  onClick={() => downloadOne(s.file)}
                  className="w-full mt-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center justify-center gap-1.5 hover:bg-white/10 transition"
                >
                  <Icon name="Download" size={13} />
                  Скачать
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="Info" size={17} className="text-sky-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-400 leading-relaxed">
              <div className="font-semibold text-white mb-1">Прямые ссылки</div>
              {SHOTS.map((s) => (
                <div key={s.file} className="text-xs mt-1 break-all">
                  <a
                    href={`/store/${s.file}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-400 hover:underline"
                  >
                    /store/{s.file}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
