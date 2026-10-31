const CODES: [string, string, string][] = [
  ["998", "UZ", "Узбекистан"],
  ["996", "KG", "Киргизия"],
  ["995", "GE", "Грузия"],
  ["994", "AZ", "Азербайджан"],
  ["993", "TM", "Туркмения"],
  ["992", "TJ", "Таджикистан"],
  ["380", "UA", "Украина"],
  ["375", "BY", "Беларусь"],
  ["374", "AM", "Армения"],
  ["373", "MD", "Молдавия"],
  ["372", "EE", "Эстония"],
  ["371", "LV", "Латвия"],
  ["370", "LT", "Литва"],
  ["972", "IL", "Израиль"],
  ["971", "AE", "ОАЭ"],
  ["90", "TR", "Турция"],
  ["84", "VN", "Вьетнам"],
  ["81", "JP", "Япония"],
  ["86", "CN", "Китай"],
  ["82", "KR", "Южная Корея"],
  ["66", "TH", "Таиланд"],
  ["62", "ID", "Индонезия"],
  ["91", "IN", "Индия"],
  ["49", "DE", "Германия"],
  ["48", "PL", "Польша"],
  ["44", "GB", "Великобритания"],
  ["43", "AT", "Австрия"],
  ["41", "CH", "Швейцария"],
  ["40", "RO", "Румыния"],
  ["39", "IT", "Италия"],
  ["34", "ES", "Испания"],
  ["33", "FR", "Франция"],
  ["31", "NL", "Нидерланды"],
  ["30", "GR", "Греция"],
  ["20", "EG", "Египет"],
  ["55", "BR", "Бразилия"],
  ["61", "AU", "Австралия"],
  ["7", "RU", "Россия"],
  ["1", "US", "США"],
];

const KZ_PREFIX = ["700", "701", "702", "703", "704", "705", "706", "707", "708", "709",
  "747", "771", "775", "776", "777", "778", "760", "761", "762", "763", "764"];

export function detectCountry(phone?: string | null): { code: string; title: string } | null {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d || d.length < 7) return null;
  if (d.startsWith("7") && KZ_PREFIX.includes(d.slice(1, 4))) {
    return { code: "KZ", title: "Казахстан" };
  }
  for (const [pref, code, title] of CODES) {
    if (d.startsWith(pref)) return { code, title };
  }
  return null;
}

function flagEmoji(code: string) {
  return code.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default function DevCountryFlag({ phone, size = 14 }: { phone?: string | null; size?: number }) {
  const c = detectCountry(phone);
  if (!c) {
    return (
      <span title="Страна не определена" className="text-slate-600 shrink-0" style={{ fontSize: size }}>
        🏳️
      </span>
    );
  }
  return (
    <span title={c.title} className="shrink-0 leading-none" style={{ fontSize: size }}>
      {flagEmoji(c.code)}
    </span>
  );
}
