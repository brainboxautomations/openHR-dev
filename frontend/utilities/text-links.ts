export type TextPart =
  | { kind: "text"; text: string }
  | { kind: "link"; text: string; href: string };

const LINK_PATTERN =
  /\bhttps?:\/\/[^\s<>"]+|\bwww\.[^\s<>"]+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/[^\s<>"]*/gi;

const TRAILING_PUNCTUATION = /[.,;:!?'"\]]+$/;

function trimTrailing(candidate: string): string {
  let text = candidate.replace(TRAILING_PUNCTUATION, "");
  while (text.endsWith(")")) {
    const opens = text.split("(").length - 1;
    const closes = text.split(")").length - 1;
    if (closes <= opens) break;
    text = text.slice(0, -1).replace(TRAILING_PUNCTUATION, "");
  }
  return text;
}

function toHref(text: string): string | null {
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function splitTextLinks(input: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;

  const pushText = (text: string) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last?.kind === "text") last.text += text;
    else parts.push({ kind: "text", text });
  };

  for (const match of input.matchAll(LINK_PATTERN)) {
    const start = match.index;
    if (start < cursor) continue;
    if (start > 0 && /[@\w./:-]/.test(input[start - 1]!)) continue;
    const text = trimTrailing(match[0]);
    const href = text ? toHref(text) : null;
    if (!href) continue;
    pushText(input.slice(cursor, start));
    parts.push({ kind: "link", text, href });
    cursor = start + text.length;
  }

  pushText(input.slice(cursor));
  return parts;
}
