import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import funcUrls from "@/../backend/func2url.json";
import type { User } from "@/lib/api";

interface Props {
  user: User;
  onBack: () => void;
  onDeleted: () => void;
}

export default function AccountDeletePanel({ user, onBack, onDeleted }: Props) {
  const [phoneInput, setPhoneInput] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [openConfirm, setOpenConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const phoneMatches = phoneInput.trim() === (user.phone || "").trim();
  const wordMatches = confirmText.trim().toUpperCase() === "УДАЛИТЬ";
  const canSubmit = phoneMatches && wordMatches && !loading;

  const performDelete = async () => {
    setLoading(true);
    try {
      const url = (funcUrls as Record<string, string>)["account-delete"];
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(user.id),
        },
        body: JSON.stringify({
          confirm: "DELETE",
          phone: phoneInput.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Не удалось удалить аккаунт");
        setLoading(false);
        setOpenConfirm(false);
        return;
      }
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      toast.success("Аккаунт и все данные удалены");
      setTimeout(() => onDeleted(), 600);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка сети";
      toast.error(msg);
      setLoading(false);
      setOpenConfirm(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-accent transition"
          aria-label="Назад"
        >
          <Icon name="ArrowLeft" size={20} />
        </button>
        <h1 className="text-lg font-semibold">Удалить аккаунт</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 flex gap-3">
          <Icon name="TriangleAlert" size={24} className="text-destructive shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold text-destructive mb-1">
              Действие необратимо
            </p>
            <p className="text-foreground/80">
              Будут безвозвратно удалены:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-0.5 text-foreground/70">
              <li>Профиль, имя, аватар, телефон</li>
              <li>Все ваши личные чаты и сообщения</li>
              <li>Истории, реакции, заметки</li>
              <li>Контакты, избранное, черновики</li>
              <li>Баланс кошелька и история операций</li>
              <li>Подписки Pro и купленные стикеры</li>
              <li>Push-токены, сессии, история входа</li>
            </ul>
            <p className="mt-2 text-xs text-foreground/60">
              Сообщения, которые вы отправили другим, будут анонимизированы
              (показаны как «удалено»). Восстановить аккаунт после удаления
              невозможно.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">
            Введите ваш номер телефона для подтверждения
          </label>
          <p className="text-xs text-muted-foreground">
            Привязанный к аккаунту:{" "}
            <span className="font-mono">{user.phone}</span>
          </p>
          <Input
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="+7XXXXXXXXXX"
            type="tel"
            autoComplete="off"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium block">
            Для подтверждения введите слово{" "}
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
              УДАЛИТЬ
            </span>
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="УДАЛИТЬ"
            autoComplete="off"
            disabled={loading}
          />
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
          <Icon name="Info" size={14} className="inline mr-1 -mt-0.5" />
          Согласно ст. 9 152-ФЗ «О персональных данных» вы вправе в любой момент
          отозвать согласие на обработку своих ПД. Удаление аккаунта
          соответствует такому отзыву.
        </div>

        <Button
          variant="destructive"
          size="lg"
          className="w-full"
          disabled={!canSubmit}
          onClick={() => setOpenConfirm(true)}
        >
          <Icon name="Trash2" size={18} className="mr-2" />
          Удалить аккаунт навсегда
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={onBack}
          disabled={loading}
        >
          Отмена
        </Button>
      </div>

      <AlertDialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Точно удалить аккаунт?</AlertDialogTitle>
            <AlertDialogDescription>
              Это последний шаг. После нажатия «Удалить» все данные исчезнут
              навсегда и не подлежат восстановлению.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={performDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Удаление..." : "Удалить навсегда"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}