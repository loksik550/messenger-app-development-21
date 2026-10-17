export function DevPhoneVk({ phone, vkId, id }: { phone?: string | null; vkId?: number | null; id?: number }) {
  const noPhone = !phone || String(phone).startsWith("vk");
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {noPhone ? (
        <span className="text-amber-400/90">{vkId || String(phone || "").startsWith("vk") ? "без номера" : id ? `ID ${id}` : "—"}</span>
      ) : (
        <span>{phone}</span>
      )}
      {vkId ? (
        <a
          href={`https://vk.com/id${vkId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#0077FF]/20 text-[#5aa7ff] font-bold hover:bg-[#0077FF]/30"
          title={`Профиль ВКонтакте id${vkId}`}
        >
          VK
        </a>
      ) : null}
    </span>
  );
}
