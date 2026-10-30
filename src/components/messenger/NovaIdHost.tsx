import { useEffect, useState } from "react";
import type { User } from "@/lib/api";
import NovaIdPanel from "@/components/messenger/NovaIdPanel";

export default function NovaIdHost(props: {
  currentUser: User;
  onUserUpdate?: (u: User) => void;
  onOpenPro?: () => void;
  onOpenLightning?: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("nova:open-nova-id", on);
    return () => window.removeEventListener("nova:open-nova-id", on);
  }, []);
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
