import { useEffect, useState } from "react";
import { applySkin, checkSkinAccess, getStoredSkin } from "@/lib/skins";

/** true — пользователю открыты тестовые темы. Без доступа сохранённая тема сбрасывается. */
export function useSkinAccess(userId?: number | null) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    checkSkinAccess(userId).then((ok) => {
      if (!alive) return;
      setAllowed(ok);
      applySkin(ok ? getStoredSkin() : null);
    });
    return () => { alive = false; };
  }, [userId]);
  return allowed;
}
