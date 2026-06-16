const URL_RE = /(https?:\/\/[^\s]+)/g;
const TOKEN_RE = /(https?:\/\/[^\s]+|@[A-Za-zА-Яа-яЁё0-9_]+)/g;

export function LinkifiedText({ text, out, mentions }: { text: string; out: boolean; mentions?: boolean }) {
  const splitRe = mentions ? TOKEN_RE : URL_RE;
  const parts = text.split(splitRe);
  return (
    <>
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`underline ${out ? "text-white" : "text-violet-400"} hover:opacity-80 break-all`}
            >
              {part}
            </a>
          );
        }
        if (mentions && /^@[A-Za-zА-Яа-яЁё0-9_]+$/.test(part)) {
          return (
            <span key={i} className={`font-semibold ${out ? "text-white" : "text-violet-400"}`}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function extractFirstUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[0] : null;
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}