import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import PrivacyPolicyPanel from "./PrivacyPolicyPanel";

const CONSENT_KEY = "nova_consent_v1";

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function setConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "accepted");
    localStorage.setItem(CONSENT_KEY + "_at", String(Date.now()));
  } catch {
    /* ignore */
  }
}

interface Props {
  onAccept: () => void;
}

export default function ConsentScreen({ onAccept }: Props) {
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [agreeProcessing, setAgreeProcessing] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const canContinue = agreePolicy && agreeProcessing && agreeAge;

  const handleContinue = () => {
    if (!canContinue) return;
    setConsent();
    onAccept();
  };

  if (showPolicy) {
    return <PrivacyPolicyPanel onBack={() => setShowPolicy(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-12 pb-6 max-w-md mx-auto w-full">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-3xl bg-primary/15 flex items-center justify-center">
            <Icon name="ShieldCheck" size={42} className="text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">
          Добро пожаловать в Nova
        </h1>
        <p className="text-center text-muted-foreground text-sm mb-7">
          Перед началом ознакомьтесь с правилами обработки персональных данных
        </p>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => setShowPolicy(true)}
            className="w-full text-left p-4 rounded-xl border border-border hover:bg-accent transition flex items-center gap-3"
          >
            <Icon name="FileText" size={20} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                Политика конфиденциальности
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Что мы собираем и как защищаем
              </div>
            </div>
            <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={agreePolicy}
              onCheckedChange={(v) => setAgreePolicy(!!v)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              Я ознакомился с{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPolicy(true);
                }}
                className="text-primary underline underline-offset-2"
              >
                Политикой конфиденциальности
              </button>{" "}
              и принимаю её условия
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={agreeProcessing}
              onCheckedChange={(v) => setAgreeProcessing(!!v)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              Я даю согласие на обработку своих персональных данных
              (номер телефона, имя, аватар, сообщения) в целях работы
              мессенджера, согласно ст. 9 152-ФЗ
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={agreeAge}
              onCheckedChange={(v) => setAgreeAge(!!v)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              Мне исполнилось 14 лет
            </span>
          </label>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground mb-5 flex gap-2">
          <Icon name="Info" size={14} className="shrink-0 mt-0.5" />
          <span>
            Вы можете отозвать согласие в любой момент, удалив аккаунт в
            настройках. Все данные хранятся на серверах в России.
          </span>
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
}
