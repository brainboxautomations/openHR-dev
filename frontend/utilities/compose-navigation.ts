export const COMPOSE_RETURN_PARAM = "returnTo";

const PARSE_ORIGIN = "http://compose.invalid";

export function composeHref(applicationId: string, returnTo?: string | null): string {
  const params = new URLSearchParams({ applicationId });
  if (returnTo) params.set(COMPOSE_RETURN_PARAM, returnTo);
  return `/compose?${params.toString()}`;
}

export function candidateProfilePath(applicationId: string): string {
  return `/candidates/${applicationId}`;
}

function hasUnsafeCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f || character === "\\") return true;
  }
  return false;
}

export function safeComposeReturn(raw: string | null, applicationId: string): string | null {
  if (!raw || !applicationId) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || hasUnsafeCharacters(raw)) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw, PARSE_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.origin !== PARSE_ORIGIN) return null;
  if (parsed.pathname !== `/candidates/${encodeURIComponent(applicationId)}`) return null;

  return `${parsed.pathname}${parsed.search}`;
}

export function composeReturnPath(raw: string | null, applicationId: string): string {
  return safeComposeReturn(raw, applicationId) ?? candidateProfilePath(applicationId);
}
