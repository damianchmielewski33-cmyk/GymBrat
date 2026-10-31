/**
 * `callbackUrl` pochodzi z adresu strony (proxy dopisuje go przy przekierowaniu na /login,
 * ale każdy może podstawić własny). Po zalogowaniu wolno wrócić tylko na ścieżkę tej samej
 * aplikacji — inaczej /login?callbackUrl=https://obcy.pl robi z logowania open redirect.
 */
export function safeCallbackPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  // "//host" i "/\host" przeglądarki traktują jak adres zewnętrzny; sterujące znaki łamią URL.
  if (raw.startsWith("//") || raw.startsWith("/\\") || /[\u0000-\u001f]/.test(raw)) {
    return "/";
  }
  return raw;
}
