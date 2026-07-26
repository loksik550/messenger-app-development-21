import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

interface Props {
  onUnlock: () => void;
}

const PIN_KEY = "nova_sec_pin";
const BIO_KEY = "nova_sec_biometric";
const BIO_CRED_KEY = "nova_sec_bio_cred";

function readBool(k: string, def: boolean) {
  const v = localStorage.getItem(k);
  return v == null ? def : v === "1";
}

async function tryBiometric(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    const credId = localStorage.getItem(BIO_CRED_KEY);
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const opts: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: "required",
    };
    if (credId) {
      const raw = Uint8Array.from(atob(credId), (c) => c.charCodeAt(0));
      opts.allowCredentials = [{ id: raw, type: "public-key" }];
    }
    const cred = await navigator.credentials.get({ publicKey: opts });
    return !!cred;
  } catch {
    return false;
  }
}

export default function PinLockScreen({ onUnlock }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const biometricOn = readBool(BIO_KEY, false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const check = (v: string) => {
    const saved = localStorage.getItem(PIN_KEY);
    if (v === saved) {
      onUnlock();
    } else {
      setError("Неверный код");
      setValue("");
      triggerShake();
    }
  };

  const onDigit = (d: string) => {
    setError("");
    const next = (value + d).slice(0, 8);
    setValue(next);
    const saved = localStorage.getItem(PIN_KEY) || "";
    if (next.length >= saved.length && saved.length > 0) {
      setTimeout(() => check(next), 100);
    }
  };

  const onBackspace = () => {
    setError("");
    setValue((v) => v.slice(0, -1));
  };

  const runBiometric = async () => {
    setError("");
    const ok = await tryBiometric();
    if (ok) onUnlock();
    else { setError("Биометрия не распознана, введите код"); triggerShake(); }
  };

  useEffect(() => {
    if (biometricOn) runBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden px-6">
      <div className="mesh-bg" />
      <div className="absolute top-[-10%] right-[-10%] w-80 h-80 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 rounded-full bg-sky-600/15 blur-3xl pointer-events-none" />

      <div className={`w-full max-w-xs flex flex-col items-center ${shake ? "animate-[shake_0.4s_ease]" : ""}`}>
        <div className="w-16 h-16 grad-primary rounded-2xl flex items-center justify-center mb-5 glow-primary">
          <Icon name="Lock" size={30} className="text-white" />
        </div>
        <h1 className="text-xl font-bold mb-1">Введите PIN-код</h1>
        <p className="text-sm text-muted-foreground mb-7 text-center">Приложение защищено кодом доступа</p>

        {/* Dots */}
        <div className="flex items-center gap-3 mb-6 h-4">
          {Array.from({ length: Math.max(4, value.length) }).map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-colors ${i < value.length ? "grad-primary" : "bg-white/15"}`}
            />
          ))}
        </div>

        {error && <p className="text-sm text-red-400 mb-4 animate-fade-in">{error}</p>}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => onDigit(d)}
              className="h-16 rounded-2xl glass text-2xl font-semibold hover:bg-white/10 active:scale-95 transition"
            >
              {d}
            </button>
          ))}
          <button
            onClick={runBiometric}
            disabled={!biometricOn}
            className="h-16 rounded-2xl glass flex items-center justify-center hover:bg-white/10 active:scale-95 transition disabled:opacity-30"
            aria-label="Биометрия"
          >
            <Icon name="Fingerprint" size={26} className="text-violet-400" />
          </button>
          <button
            onClick={() => onDigit("0")}
            className="h-16 rounded-2xl glass text-2xl font-semibold hover:bg-white/10 active:scale-95 transition"
          >
            0
          </button>
          <button
            onClick={onBackspace}
            className="h-16 rounded-2xl glass flex items-center justify-center hover:bg-white/10 active:scale-95 transition"
            aria-label="Стереть"
          >
            <Icon name="Delete" size={24} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <input ref={inputRef} className="sr-only" tabIndex={-1} aria-hidden />

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
