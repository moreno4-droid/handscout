// Gemeinsamer Zustand: Optionen aus der Datenbank, Einstellungen, Vergleichskorb, gespeicherte Filter.
import { lsGet, lsSet } from './util.js';
export const S = { opt: null, vergleich: lsGet('hs.vergleich', []), einst: { theme: 'system', km: 30, ...lsGet('hs.einst', {}) }, filter: lsGet('hs.filter', []) };
export const speichereEinst = () => lsSet('hs.einst', S.einst);
export function setzeTheme(t) {
  S.einst.theme = t; speichereEinst(); const r = document.documentElement;
  if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
  const dunkel = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dunkel ? '#07101B' : '#0B1F33');
}
export const imVergleich = (id) => S.vergleich.some((p) => p.id === id);
export function vergleichUmschalten(id, name) {
  const i = S.vergleich.findIndex((p) => p.id === id);
  if (i >= 0) S.vergleich.splice(i, 1); else { if (S.vergleich.length >= 4) return false; S.vergleich.push({ id, name }); }
  lsSet('hs.vergleich', S.vergleich); return true;
}
export const vergleichLeeren = () => { S.vergleich = []; lsSet('hs.vergleich', S.vergleich); };
export function filterSpeichern(name, f) { S.filter = [...S.filter.filter((x) => x.name !== name), { name, f }]; lsSet('hs.filter', S.filter); }
export function filterLoeschen(name) { S.filter = S.filter.filter((x) => x.name !== name); lsSet('hs.filter', S.filter); }
