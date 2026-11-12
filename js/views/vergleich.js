// Vergleich von 2 bis 4 Spielern: Tabelle mit Bestwerten, Radar und Entwicklung.
import { esc, zahl, prozent, vorz, toast } from '../util.js';
import { rpc } from '../api.js';
import { S, vergleichLeeren } from '../state.js';
import { radar, linien, vergleichsBalken, farbe } from '../charts.js';
import { icon, laden, fehlerBox, leer, vergleichsLeiste } from '../ui.js';

const rang = (p) => (p == null ? null : Math.round(p * 100));
const ZEILEN = {
  F: [['Spiele', 'games', (v) => zahl(v), 1], ['Tore', 'goals', (v) => zahl(v), 1], ['Tore pro Spiel', 'goals_pg', (v) => zahl(v, 2), 1], ['Wurfquote', 'goal_pct', (v) => prozent(v, 0), 1], ['Würfe pro Spiel', 'shots_pg', (v) => zahl(v, 1), 1], ['Techn. Fehler pro Spiel', 'tf_pg', (v) => zahl(v, 2), -1], ['2-Min-Strafen pro Spiel', 'min2_pg', (v) => zahl(v, 2), -1], ['Verwarnungen', 'warnings', (v) => zahl(v), -1], ['Score', 'score', (v) => vorz(v, 1), 1]],
  G: [['Spiele', 'games', (v) => zahl(v), 1], ['Paraden', 'saves', (v) => zahl(v), 1], ['Gegenwürfe', 'shots_gk', (v) => zahl(v), 0], ['Paradenquote', 'save_pct', (v) => prozent(v, 1), 1], ['Paraden pro Spiel', 'saves_pg', (v) => zahl(v, 1), 1], ['Score', 'score', (v) => vorz(v, 1), 1]],
};

export async function render(ctx) {
  const ids = (ctx.arg || '').split(',').map(Number).filter(Boolean).slice(0, 4);
  if (ids.length < 2) return void (ctx.root.innerHTML = `<div class="seitenkopf"><h1>Vergleich</h1></div>${leer('Wähle mindestens 2 Spieler', 'In der Suche das Vergleichs-Symbol bei 2 bis 4 Spielern antippen, dann unten auf «Vergleichen».', '<a class="btn" href="#/suche">Zur Suche</a>')}`);
  ctx.root.innerHTML = `<div class="seitenkopf"><h1>Vergleich</h1></div>${laden(6)}`;
  let daten; try { daten = await rpc('vergleich', { pids: ids }); } catch (e) { return void (ctx.root.innerHTML = fehlerBox(e.message)); }
  const sp = daten.map((d) => { const s = [...d.saisons].sort((a, b) => b.season_id - a.season_id || b.games - a.games)[0]; return { d, s, name: d.spieler.name || '?', rolle: s?.role || 'F' }; }).filter((x) => x.s);
  if (sp.length < 2) return void (ctx.root.innerHTML = fehlerBox('Für diese Spieler gibt es keine Statistik.', false));
  const gemischt = new Set(sp.map((x) => x.rolle)).size > 1; const rolle = sp[0].rolle; const zeilen = ZEILEN[rolle];
  const kopf = `<div class="vkopf" style="--n:${sp.length}">${sp.map((x, i) => `<a class="vk" href="#/spieler/${x.d.spieler.player_id}" style="--fc:${farbe(i)}"><i></i><b>${esc(x.name)}</b><span class="psub">Jg. ${esc(x.d.spieler.birth_year ?? '–')} · ${esc(x.s.team || '–')}</span><span class="psub">${esc(x.s.league || '')} · ${esc(x.s.season)}</span></a>`).join('')}</div>`;
  const tab = `<div class="tabelle-wrap"><table class="liste vt"><thead><tr><th class="l">Kennzahl</th>${sp.map((x, i) => `<th class="r" style="--fc:${farbe(i)}"><span class="punkt"></span>${esc(x.name.split(' ')[0])}</th>`).join('')}</tr></thead><tbody>${zeilen.map(([t, k, fm, richt]) => { const vals = sp.map((x) => x.s[k]); const ok = vals.filter((v) => v != null); const best = !richt || ok.length < 2 ? null : richt > 0 ? Math.max(...ok) : Math.min(...ok); return `<tr><td class="l">${t}</td>${vals.map((v) => `<td class="r ${best != null && v === best ? 'best' : ''}">${v == null ? '–' : fm(v)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div><p class="muted klein">Fett markiert: bester Wert je Zeile (bei Fehlern und Strafen der niedrigste). Verglichen wird die jeweils letzte Saison des Spielers.</p>`;
  let rad = '';
  if (!gemischt) {
    const f = rolle === 'F';
    const achsen = f ? ['Tore/Spiel', 'Quote', 'Würfe/Spiel', 'Wenig Fehler', 'Fairness'] : ['Paradenquote', 'Paraden/Spiel'];
    const w = (x) => { const st = x.d.staerken; if (!st || !st.qual) return null; return f ? [st.pr_tore, st.pr_quote, st.pr_wuerfe, st.pr_fehler, st.pr_strafen].map(rang) : [st.pr_paraden, st.pr_paraden_pg].map(rang); };
    const serien = sp.map((x) => ({ name: x.name, werte: w(x) })).filter((x) => x.werte);
    if (serien.length >= 2 && f) rad = `<section class="box"><h2>Stärkeprofil</h2><p class="muted klein">Rang in der eigenen Liga und Saison (100 = bester Wert).</p>${radar({ achsen, serien, titel: 'Radar-Vergleich' })}</section>`;
    else if (serien.length >= 2) rad = `<section class="box"><h2>Stärkeprofil</h2>${achsen.map((a, ai) => `<h3 class="klein">${a}</h3>${vergleichsBalken(serien.map((s) => ({ name: s.name, wert: s.werte[ai], text: s.werte[ai] == null ? '–' : String(s.werte[ai]) })))}`).join('')}</section>`;
    if (serien.length < sp.length) rad += `<p class="hinweis warn">${icon('warn')} Bei ${sp.length - serien.length} Spieler(n) fehlt ein fairer Liga-Vergleich (zu wenige Spiele oder Würfe).</p>`;
  } else rad = '<p class="hinweis warn">Feldspieler und Torhüter lassen sich nicht auf denselben Achsen vergleichen. Die Tabelle zeigt die Werte des ersten Spielers als Massstab.</p>';
  const seasonsAll = [...new Set(sp.flatMap((x) => x.d.saisons.map((s) => s.season)))].sort();
  const key = rolle === 'G' ? 'save_pct' : 'goals_pg';
  const ent = !gemischt ? `<section class="box"><h2>Entwicklung</h2>${linien({ serien: sp.map((x) => ({ name: x.name, werte: seasonsAll.map((se) => { const r = x.d.saisons.filter((s) => s.season === se && s.role === rolle).sort((a, b) => b.games - a.games)[0]; return r && r[key] != null ? { y: Number(r[key]) } : null; }) })), xs: seasonsAll, dez: rolle === 'G' ? 0 : 1, titel: 'Entwicklung im Vergleich' })}<p class="muted klein">${rolle === 'G' ? 'Paradenquote in %' : 'Tore pro Spiel'} je Saison.</p></section>` : '';
  ctx.root.innerHTML = `<div class="seitenkopf"><h1>Vergleich</h1><div class="aktionsleiste"><button class="btn secondary klein" data-act="druck">PDF / Druck</button><button class="btn secondary klein" data-act="leeren">Zurücksetzen</button></div></div>${kopf}<section class="box">${tab}</section>${rad}${ent}`;
  ctx.on = { druck() { window.print(); }, leeren() { vergleichLeeren(); vergleichsLeiste(); location.hash = '#/suche'; } };
}
