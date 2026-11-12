// Kleine Hilfsfunktionen (Text sicher einbauen, Zahlen formatieren, Export).
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const nf = (d) => new Intl.NumberFormat('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d });
const nfs = {}; export const zahl = (v, d = 0) => (v == null || v === '' || Number.isNaN(Number(v)) ? '–' : (nfs[d] ||= nf(d)).format(Number(v)));
export const prozent = (v, d = 0) => (v == null ? '–' : zahl(v, d) + ' %');
export const vorz = (v, d = 1) => (v == null ? '–' : (Number(v) > 0 ? '+' : '') + zahl(v, d));
export const datum = (iso, mitZeit = false) => { if (!iso) return '–'; const d = new Date(iso); return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) + (mitZeit ? ', ' + d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : ''); };
export const wochentag = (iso) => new Date(iso).toLocaleDateString('de-CH', { weekday: 'short' });
export const entprellen = (f, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
export const haversine = (a, b, c, d) => { const r = (x) => (x * Math.PI) / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
export const lsGet = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* Speicher gesperrt: App läuft trotzdem */ } };
export const kodiere = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const dekodiere = (s) => { try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))); } catch { return null; } };
export const jetztJahr = () => new Date().getFullYear();

export function toast(text, art = '') {
  let box = document.getElementById('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.append(box); }
  if ([...box.children].some((x) => x.textContent === text && !x.classList.contains('weg'))) return;
  const t = document.createElement('div'); t.className = 'toast ' + art; t.textContent = text; box.append(t); setTimeout(() => t.classList.add('weg'), 3200); setTimeout(() => t.remove(), 3700);
}

// Export: CSV mit Semikolon und BOM (öffnet in Schweizer Excel richtig), Excel-Datei (SheetJS wird erst bei Bedarf geladen), PDF über Druckdialog
export function csvText(spalten, zeilen) {
  const q = (v) => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [spalten.map((c) => q(c.titel)).join(';'), ...zeilen.map((z) => spalten.map((c) => q(c.wert(z))).join(';'))].join('\r\n');
}
function speichern(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
export const exportCsv = (name, spalten, zeilen) => speichern(new Blob([csvText(spalten, zeilen)], { type: 'text/csv;charset=utf-8' }), name + '.csv');
export async function exportXlsx(name, spalten, zeilen) {
  if (!window.XLSX) await new Promise((ok, fail) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = () => fail(new Error('Excel-Baustein konnte nicht geladen werden')); document.head.append(s); });
  const ws = window.XLSX.utils.aoa_to_sheet([spalten.map((c) => c.titel), ...zeilen.map((z) => spalten.map((c) => { const v = c.wert(z); return v == null ? '' : v; }))]);
  const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'HandScout'); window.XLSX.writeFile(wb, name + '.xlsx');
}
export const drucken = () => window.print();
