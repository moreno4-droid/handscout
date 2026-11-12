// Diagramme als einfache SVG-Grafiken (ohne Zusatzpaket). Farben kommen aus dem Stylesheet und passen sich Hell/Dunkel an.
import { esc, zahl } from './util.js';
const FARBEN = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'];

// Linien: serien = [{name, werte:[{x:'2024/25', y:12.3}|null]}]; gleiche x-Achse für alle Serien
export function linien({ serien, xs, einheit = '', dez = 1, hoehe = 170, titel = '' }) {
  const W = 340, H = hoehe, L = 34, R = 10, T = 12, B = 26;
  const ys = serien.flatMap((s) => s.werte.map((p) => p?.y)).filter((v) => v != null && Number.isFinite(v));
  if (!ys.length || !xs.length) return '<p class="muted klein">Zu wenig Daten für ein Diagramm.</p>';
  let lo = Math.min(...ys), hi = Math.max(...ys); if (lo === hi) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.12; lo = Math.max(0, lo - pad) === 0 && Math.min(...ys) >= 0 ? 0 : lo - pad; hi += pad;
  const sx = (i) => (xs.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (xs.length - 1)), sy = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const raster = [0, 1, 2, 3].map((k) => { const v = lo + ((hi - lo) * k) / 3; return `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" class="raster"/><text x="${L - 5}" y="${sy(v) + 3}" class="achse" text-anchor="end">${zahl(v, dez)}</text>`; }).join('');
  const xl = xs.map((x, i) => `<text x="${sx(i)}" y="${H - 8}" class="achse" text-anchor="${i === 0 && xs.length > 1 ? 'start' : i === xs.length - 1 && xs.length > 1 ? 'end' : 'middle'}">${esc(x)}</text>`).join('');
  const ls = serien.map((s, si) => {
    const pts = s.werte.map((p, i) => (p && p.y != null ? [sx(i), sy(p.y), p.y] : null));
    let d = '', pen = false; pts.forEach((p) => { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); pen = true; });
    return `<path d="${d}" fill="none" stroke="${FARBEN[si % 4]}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>` + pts.filter(Boolean).map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="${FARBEN[si % 4]}"><title>${esc(s.name)}: ${zahl(p[2], dez)}${einheit}</title></circle>`).join('');
  }).join('');
  const leg = serien.length > 1 ? `<div class="legende">${serien.map((s, i) => `<span><i style="background:${FARBEN[i % 4]}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<figure class="grafik"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titel)}">${raster}${xl}${ls}</svg>${leg}</figure>`;
}

// Balken (senkrecht) für die letzten Spiele
export function balken({ werte, labels, hoehe = 130, titel = '', dez = 0 }) {
  const n = werte.length; if (!n) return '<p class="muted klein">Keine Spiele vorhanden.</p>';
  const W = 340, H = hoehe, L = 8, R = 8, T = 16, B = 20, max = Math.max(1, ...werte), bw = (W - L - R) / n;
  const b = werte.map((v, i) => { const h = ((H - T - B) * v) / max, x = L + i * bw + bw * 0.14; return `<rect x="${x.toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${Math.max(h, v > 0 ? 1.5 : 0).toFixed(1)}" rx="2.5" fill="var(--c1)"><title>${esc(labels?.[i] ?? '')}: ${zahl(v, dez)}</title></rect><text x="${(x + bw * 0.36).toFixed(1)}" y="${(H - B - h - 3).toFixed(1)}" class="achse" text-anchor="middle">${v ? zahl(v, dez) : ''}</text>`; }).join('');
  return `<figure class="grafik"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titel)}"><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="raster"/>${b}<text x="${L}" y="${H - 5}" class="achse">älter</text><text x="${W - R}" y="${H - 5}" class="achse" text-anchor="end">neuer</text></svg></figure>`;
}

// Radar: achsen = ['Tore','Quote',…]; serien = [{name, werte:[0..100|null]}]
export function radar({ achsen, serien, titel = '' }) {
  const S = 280, c = S / 2, r = 92, n = achsen.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)]; };
  const ringe = [25, 50, 75, 100].map((p) => `<polygon points="${achsen.map((_, i) => pt(i, p).map((q) => q.toFixed(1)).join(',')).join(' ')}" class="raster" fill="none"/>`).join('');
  const speichen = achsen.map((_, i) => { const p = pt(i, 100); return `<line x1="${c}" y1="${c}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" class="raster"/>`; }).join('');
  const lab = achsen.map((t, i) => { const p = pt(i, 122), anker = p[0] < c - 8 ? 'end' : p[0] > c + 8 ? 'start' : 'middle'; return `<text x="${p[0].toFixed(1)}" y="${(p[1] + 3).toFixed(1)}" class="achse" text-anchor="${anker}">${esc(t)}</text>`; }).join('');
  const flaechen = serien.map((s, si) => { const pts = s.werte.map((v, i) => pt(i, v ?? 0)); return `<polygon points="${pts.map((p) => p.map((q) => q.toFixed(1)).join(',')).join(' ')}" fill="${FARBEN[si % 4]}" fill-opacity="${serien.length > 1 ? 0.14 : 0.22}" stroke="${FARBEN[si % 4]}" stroke-width="2.2" stroke-linejoin="round"/>` + pts.map((p, i) => (s.werte[i] == null ? '' : `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="${FARBEN[si % 4]}"><title>${esc(s.name)} – ${esc(achsen[i])}: ${zahl(s.werte[i])} von 100</title></circle>`)).join(''); }).join('');
  const leg = serien.length > 1 ? `<div class="legende">${serien.map((s, i) => `<span><i style="background:${FARBEN[i % 4]}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<figure class="grafik radar"><svg viewBox="-48 -10 ${S + 96} ${S + 20}" role="img" aria-label="${esc(titel)}">${ringe}${speichen}${lab}${flaechen}</svg>${leg}</figure>`;
}

// Waagrechter Vergleichsbalken je Spieler (für «Vergleich»): zeilen = [{name, wert, text}]
export function vergleichsBalken(zeilen, hoeher = true) {
  const max = Math.max(...zeilen.map((z) => z.wert ?? 0), 0.0001); const best = hoeher ? Math.max(...zeilen.map((z) => z.wert ?? -Infinity)) : Math.min(...zeilen.map((z) => z.wert ?? Infinity));
  return `<div class="vbalken">${zeilen.map((z, i) => `<div class="vb"><span class="vn">${esc(z.name)}</span><span class="vs"><i style="width:${z.wert == null ? 0 : Math.max(2, (z.wert / max) * 100)}%;background:${FARBEN[i % 4]}"></i></span><b class="${z.wert === best ? 'best' : ''}">${esc(z.text)}</b></div>`).join('')}</div>`;
}
export const farbe = (i) => FARBEN[i % 4];
