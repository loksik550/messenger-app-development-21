import { useEffect, useState } from "react";
import type { User } from "@/lib/api";
import NovaIdPanel from "@/components/messenger/NovaIdPanel";
import AppIconPanel from "@/components/messenger/AppIconPanel";
import { applyAppIcon } from "@/lib/appIcons";

export default function NovaIdHost(props: {
  currentUser: User;
  onUserUpdate?: (u: User) => void;
  onOpenPro?: () => void;
  onOpenLightning?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    const onIcon = () => setIconOpen(true);
    window.addEventListener("nova:open-nova-id", on);
    window.addEventListener("nova:open-app-icon", onIcon);
    return () => {
      window.removeEventListener("nova:open-nova-id", on);
      window.removeEventListener("nova:open-app-icon", onIcon);
    };
  }, []);
  const wantedIcon = props.currentUser.app_icon || "classic";
  useEffect(() => {
    const key = "nova_applied_icon";
    if (localStorage.getItem(key) === wantedIcon) return;
    applyAppIcon(wantedIcon).then((ok) => { if (ok) localStorage.setItem(key, wantedIcon); });
  }, [wantedIcon]);
  if (iconOpen) {
    return (
      <AppIconPanel
        currentUser={props.currentUser}
        onUserUpdate={props.onUserUpdate}
        onClose={() => setIconOpen(false)}
        onOpenPro={() => { setIconOpen(false); props.onOpenPro?.(); }}
      />
    );
  }
  if (!open) return null;
  return (
    <NovaIdPanel
      {...props}
      onClose={() => setOpen(false)}
      onOpenPro={() => { setOpen(false); props.onOpenPro?.(); }}
      onOpenLightning={() => { setOpen(false); props.onOpenLightning?.(); }}
    />
  );
}
