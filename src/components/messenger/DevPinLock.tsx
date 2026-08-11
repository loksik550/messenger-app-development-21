import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

const PIN_KEY = "nova_devpanel_pin";
const FAIL_KEY = "nova_devpanel_fails";
const LOCK_KEY = "nova_devpanel_locked_until";
const MAX_FAILS = 5;
const LOCK_MINUTES = 5;

async function hashPin(pin: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const enc = new TextEncoder().encode(`nova-dev-${pin}`);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback (не должен использоваться на современных браузерах)
  let h = 0;
  for (let i = 0; i < pin.length; i++) h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0;
  return `fb_${h}`;
}

function getStoredPin(): string | null {
  try { return localStorage.getItem(PIN_KEY); } catch { return null; }
}

export function isDevPinSet(): boolean {
  return !!getStoredPin();
}

export function clearDevPin() {
  try {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(FAIL_KEY);
    localStorage.removeItem(LOCK_KEY);
  } catch { /* ignore */ }
}

function getLockedUntil(): number {
  try { return parseInt(localStorage.getItem(LOCK_KEY) || "0", 10) || 0; } catch { return 0; }
}

function getFails(): number {
  try { return parseInt(localStorage.getItem(FAIL_KEY) || "0", 10) || 0; } catch { return 0; }
}

export function DevPinLock({
  onUnlock,
  onClose,
}: {
  onUnlock: () => void;
  onClose: () => void;
}) {
  const hasPin = isDevPinSet();
  const [mode, setMode] = useState<"enter" | "create" | "confirm">(hasPin ? "enter" : "create");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const update = () => {
      const until = getLockedUntil();
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLockedFor(left);
      if (left <= 0 && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
    update();
    if (getLockedUntil() > Date.now()) {
      tickRef.current = setInterval(update, 1000);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
    try { (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(50); } catch { /* ignore */ }
  };

  const onSubmit = async (current: string) => {
    setError("");
    if (lockedFor > 0) return;
    if (mode === "create") {
      if (current.length < 4) { setError("Минимум 4 цифры"); triggerShake(); return; }
      setFirstPin(current);
      setPin("");
      setMode("confirm");
      return;
    }
    if (mode === "confirm") {
      if (current !== firstPin) {
        setError("PIN-коды не совпадают");
        triggerShake();
        setPin("");
        setFirstPin("");
        setMode("create");
        return;
      }
      const h = await hashPin(current);
      try { localStorage.setItem(PIN_KEY, h); } catch { /* ignore */ }
      try { localStorage.removeItem(FAIL_KEY); localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
      onUnlock();
      return;
    }
    if (mode === "enter") {
      const stored = getStoredPin();
      if (!stored) { onUnlock(); return; }
      const h = await hashPin(current);
      if (h === stored) {
        try { localStorage.removeItem(FAIL_KEY); localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
        onUnlock();
      } else {
        const fails = getFails() + 1;
        try { localStorage.setItem(FAIL_KEY, String(fails)); } catch { /* ignore */ }
        if (fails >= MAX_FAILS) {
          const until = Date.now() + LOCK_MINUTES * 60 * 1000;
          try { localStorage.setItem(LOCK_KEY, String(until)); } catch { /* ignore */ }
          setLockedFor(LOCK_MINUTES * 60);
          if (!tickRef.current) {
            tickRef.current = setInterval(() => {
              const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
              setLockedFor(left);
              if (left <= 0 && tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
            }, 1000);
          }
          setError(`Слишком много попыток. Заблокировано на ${LOCK_MINUTES} мин.`);
        } else {
          setError(`Неверный PIN. Осталось попыток: ${MAX_FAILS - fails}`);
        }
        triggerShake();
        setPin("");
      }
    }
  };

  const handleDigit = (d: string) => {
    if (lockedFor > 0) return;
    setError("");
    setPin(prev => {
      const next = (prev + d).slice(0, 6);
      if (next.length >= 4 && (mode !== "create" || next.length === prev.length + 1)) {
        // Авто-сабмит при 4-х цифрах (для enter и confirm)
        if (mode === "enter" || mode === "confirm") {
          if (next.length === 4) setTimeout(() => onSubmit(next), 100);
        }
      }
      return next;
    });
  };

  const handleBackspace = () => {
    setError("");
    setPin(prev => prev.slice(0, -1));
  };

  const title = mode === "create" ? "Создать PIN-код"
    : mode === "confirm" ? "Подтвердите PIN-код"
    : "Введите PIN-код";
  const subtitle = mode === "create" ? "4–6 цифр для защиты Dev-панели"
    : mode === "confirm" ? "Повторите ваш PIN-код"
    : "Доступ к Dev-панели";

  const formatLockTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        className={`glass-strong rounded-3xl p-6 w-full max-w-xs mx-4 animate-scale-in ${shake ? "animate-[shake_0.4s_ease]" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
              <Icon name="Lock" size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="font-bold">{title}</h2>
              <p className="text-[10px] text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 glass rounded-lg text-muted-foreground hover:text-foreground">
            <Icon name="X" size={14} />
          </button>
        </div>

        {/* Точки */}
        <div className="flex items-center justify-center gap-3 my-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i < pin.length
                  ? "bg-violet-400 scale-110"
                  : "bg-white/15"
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-xs text-red-400 mb-3">{error}</p>
        )}
        {lockedFor > 0 && (
          <p className="text-center text-xs text-amber-400 mb-3">
            Разблокировка через {formatLockTime(lockedFor)}
          </p>
        )}

        {/* Цифровая клавиатура */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button
              key={n}
              onClick={() => handleDigit(String(n))}
              disabled={lockedFor > 0}
              className="aspect-square rounded-2xl glass hover:bg-white/8 active:scale-95 transition text-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {n}
            </button>
          ))}
          {mode === "create" && pin.length >= 4 ? (
            <button
              onClick={() => onSubmit(pin)}
              disabled={lockedFor > 0}
              className="aspect-square rounded-2xl bg-violet-500 text-white active:scale-95 transition text-xs font-bold flex items-center justify-center"
            >
              <Icon name="Check" size={20} />
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={() => handleDigit("0")}
            disabled={lockedFor > 0}
            className="aspect-square rounded-2xl glass hover:bg-white/8 active:scale-95 transition text-xl font-semibold disabled:opacity-40"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={lockedFor > 0 || pin.length === 0}
            className="aspect-square rounded-2xl glass hover:bg-white/8 active:scale-95 transition flex items-center justify-center disabled:opacity-40"
          >
            <Icon name="Delete" size={20} className="text-muted-foreground" />
          </button>
        </div>

        {mode === "enter" && (
          <p className="text-center text-[10px] text-muted-foreground">
            Защита Dev-панели • локально на этом устройстве
          </p>
        )}
        {mode === "create" && (
          <p className="text-center text-[10px] text-muted-foreground">
            PIN сохраняется только на этом устройстве
          </p>
        )}
      </div>
    </div>
  );
}

export default DevPinLock;
