export const parseVcf = (text: string): { phone: string; name?: string }[] => {
  const items: { phone: string; name?: string }[] = [];
  // Каждый контакт — между BEGIN:VCARD и END:VCARD
  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  for (const raw of cards) {
    const block = raw.split(/END:VCARD/i)[0] || "";
    // Склейка многострочных значений (продолжение начинается с пробела)
    const lines = block.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
    let displayName: string | undefined;
    let structuredName: string | undefined;
    const phones: string[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const left = line.slice(0, colon);
      const value = line.slice(colon + 1).trim();
      const upper = left.toUpperCase();
      if (upper === "FN" || upper.startsWith("FN;")) {
        displayName = value;
      } else if (upper === "N" || upper.startsWith("N;")) {
        // N: фамилия;имя;отчество;префикс;суффикс
        const parts = value.split(";").map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) structuredName = `${parts[1]} ${parts[0]}`.trim();
        else if (parts.length === 1) structuredName = parts[0];
      } else if (upper === "TEL" || upper.startsWith("TEL;") || upper.startsWith("TEL:")) {
        const cleaned = value.replace(/[^\d+]/g, "");
        if (cleaned.length >= 5) phones.push(cleaned);
      }
    }
    const nm = displayName || structuredName;
    for (const p of phones) {
      items.push({ phone: p, name: nm });
    }
  }
  return items;
};
