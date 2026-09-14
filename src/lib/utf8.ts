// ATAK.GG — reparación de texto mal decodificado (mojibake).
//
// Causa raíz verificada (no es del backend): el payload de OAuth llega en
// base64 y se decodificaba con `atob`, que devuelve una cadena Latin-1. Un
// nombre correcto en UTF-8 como "Osvaldo Pérez Ochoa" viaja como bytes
// C3 A9 para la "é", y `atob` los entrega como dos caracteres sueltos:
// "Osvaldo PÃ©rez Ochoa". Comprobado reproduciendo el ciclo completo
// (JSON UTF-8 → base64 → atob) — el backend manda el nombre bien.
//
// Aquí van las dos piezas:
//   · b64urlToJsonUtf8 — decodifica el payload como UTF-8 (el arreglo de raíz).
//   · fixMojibakeUtf8  — repara al mostrar los nombres que YA quedaron
//                        guardados mal en localStorage de sesiones anteriores.

/**
 * Repara una cadena UTF-8 que fue leída como Latin-1 (p.ej. "PÃ©rez" → "Pérez").
 * Es idempotente: un nombre correcto se devuelve tal cual, y si la
 * reinterpretación no mejora nada se conserva el original.
 *
 * Alcance: cubre Latin-1, que es donde viven los acentos del español
 * (á é í ó ú ñ ü) — el caso real. Si el texto pasó por Windows-1252 y quedó
 * con caracteres del rango 0x80–0x9F (comillas tipográficas, puntos
 * suspensivos…), esos no se pueden reconstruir byte a byte; la función lo
 * detecta y devuelve el original en vez de corromperlo más.
 */
export function fixMojibakeUtf8(s: string | null | undefined): string {
  if (!s) return '';
  // Sin Ã ni Â no hay mojibake posible: se evita tocar nombres legítimos.
  if (!/[ÃÂ]/.test(s)) return s;
  try {
    const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Solo se acepta si de verdad desaparecieron las secuencias rotas.
    if (/Ã.|Â./.test(s) && !/Ã.|Â./.test(decoded)) return decoded;
    return s;
  } catch {
    // No era UTF-8 válido: el original se queda como está.
    return s;
  }
}

/**
 * Decodifica un payload base64url a JSON respetando UTF-8.
 * Sustituye al viejo `JSON.parse(atob(...))`, que rompía los acentos.
 */
export function b64urlToJsonUtf8<T = unknown>(s: string): T {
  const normalized = s.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0) & 0xff);
  return JSON.parse(new TextDecoder('utf-8').decode(bytes)) as T;
}

/**
 * Repara una vez el nombre ya guardado en localStorage por sesiones anteriores
 * (las que pasaron por el `atob` roto). Sin esto, quien ya inició sesión
 * seguiría viendo "PÃ©rez" hasta volver a entrar.
 */
export function repairStoredUserName(): void {
  try {
    const raw = window.localStorage.getItem('user');
    if (!raw) return;
    const user = JSON.parse(raw);
    if (!user?.name || typeof user.name !== 'string') return;
    const fixed = fixMojibakeUtf8(user.name);
    if (fixed === user.name) return;
    window.localStorage.setItem('user', JSON.stringify({ ...user, name: fixed }));
  } catch { /* sesión ilegible: se deja intacta */ }
}
