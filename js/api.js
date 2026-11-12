// Verbindung zur Datenbank (Supabase): Anmelden und geprüfte Funktionen aufrufen. Kein Zusatzpaket nötig.
const C = () => window.HANDSCOUT || {};
const SKEY = 'hs.session', CKEY = 'hs.cache';
export const status = { offline: false, offlineSeit: null };
export class ApiFehler extends Error { constructor(art, msg) { super(msg); this.art = art; } } // art: konfig | login | zugang | netz | fehler

const lies = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
let sess = lies(SKEY);

export const konfigOk = () => { const c = C(); return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY && !/DEIN/.test(c.SUPABASE_URL + c.SUPABASE_ANON_KEY)); };
export const eingeloggt = () => !!(sess && sess.refresh_token);
export const meineEmail = () => sess?.email || '';
const url = (p) => C().SUPABASE_URL.replace(/\/+$/, '') + p;
// Neue Supabase-Schlüssel (sb_publishable_…) sind keine JWTs und dürfen nicht als «Bearer» gesendet werden; alte (eyJ…) schon.
const kopf = (token) => { const k = C().SUPABASE_ANON_KEY; const h = { apikey: k, 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token; else if (!/^sb_/.test(k)) h.Authorization = 'Bearer ' + k; return h; };

function merke(j, email) {
  sess = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600) - 30, email: (j.user && j.user.email) || email || sess?.email || '' };
  schreib(SKEY, sess);
}
async function auth(pfad, body) {
  let res; try { res = await fetch(url(pfad), { method: 'POST', headers: kopf(), body: JSON.stringify(body) }); } catch { throw new ApiFehler('netz', 'Keine Verbindung zum Server.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiFehler('login', j.error_description || j.msg || j.message || 'Anmeldung nicht möglich.');
  return j;
}
export async function login(email, passwort) { const j = await auth('/auth/v1/token?grant_type=password', { email: email.trim(), password: passwort }); merke(j, email.trim()); }
export async function passwortVergessen(email) { await auth('/auth/v1/recover', { email: email.trim() }); }
export function logout() { sess = null; try { localStorage.removeItem(SKEY); } catch {} }
async function erneuern() {
  if (!sess?.refresh_token) throw new ApiFehler('login', 'Bitte neu anmelden.');
  try { merke(await auth('/auth/v1/token?grant_type=refresh_token', { refresh_token: sess.refresh_token })); }
  catch (e) { if (e.art === 'login') { logout(); } throw e; }
}

// Zwischenspeicher für den Offline-Stand: nur lesende Funktionen, höchstens 30 Einträge
const LESEND = new Set(['optionen', 'suche', 'aehnliche', 'profil', 'vergleich', 'entwicklung', 'teams_suche', 'team_profil', 'stafa_naechste', 'stafa_uebersicht', 'wl_liste', 'akte_log']);
function cachePut(key, data) {
  const alle = lies(CKEY) || {}; const text = JSON.stringify(data); if (text.length > 400000) return;
  alle[key] = { t: Date.now(), d: data };
  const keys = Object.keys(alle).sort((a, b) => alle[b].t - alle[a].t); keys.slice(30).forEach((k) => delete alle[k]);
  if (!schreib(CKEY, alle)) { schreib(CKEY, { [key]: alle[key] }); }
}
const cacheGet = (key) => (lies(CKEY) || {})[key];
export const cacheLeeren = () => { try { localStorage.removeItem(CKEY); } catch {} };

export async function rpc(name, args = {}) {
  if (!konfigOk()) throw new ApiFehler('konfig', 'Die App ist noch nicht mit deiner Datenbank verbunden (config.js).');
  if (!eingeloggt()) throw new ApiFehler('login', 'Bitte anmelden.');
  const key = name + ':' + JSON.stringify(args);
  if (sess.expires_at < Date.now() / 1000) await erneuern();
  const senden = () => fetch(url('/rest/v1/rpc/' + name), { method: 'POST', headers: kopf(sess.access_token), body: JSON.stringify(args) });
  let res;
  try {
    res = await senden();
    if (res.status === 401) { await erneuern(); res = await senden(); }
  } catch (e) {
    if (e instanceof ApiFehler) throw e;
    const c = LESEND.has(name) && cacheGet(key);
    if (c) { if (!status.offline) status.offlineSeit = c.t; status.offline = true; return c.d; }
    throw new ApiFehler('netz', 'Keine Verbindung zum Server.');
  }
  status.offline = false;
  const text = await res.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch { /* leer */ }
  if (!res.ok) {
    if (res.status === 403 || j?.code === '42501') throw new ApiFehler('zugang', j?.message === 'Nur Lesezugriff' ? 'Dein Konto darf nur lesen.' : 'Dieses Konto steht nicht auf der Zugangsliste.');
    throw new ApiFehler('fehler', j?.message || 'Fehler ' + res.status);
  }
  if (LESEND.has(name)) cachePut(key, j);
  return j;
}
