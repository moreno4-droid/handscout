// Team-Seite für das Gegner-Scouting: Bilanz, Form, Spiele, Schlüsselspieler, Kader.
import { esc, zahl, prozent, datum, haversine } from '../util.js';
import { rpc } from '../api.js';
import { S } from '../state.js';
import { balken } from '../charts.js';
import { icon, laden, fehlerBox, leer, scoreBadge } from '../ui.js';

export async function render(ctx) {
  const tid = Number(ctx.arg); const sid = ctx.params.get('s') ? Number(ctx.params.get('s')) : null;
  ctx.root.innerHTML = `<div class="seitenkopf"><a class="zurueck" href="#/suche" data-act="zurueck">${icon('zurueck')} Zurück</a></div>${laden(5)}`;
  let d; try { d = await rpc('team_profil', sid ? { tid, sid } : { tid }); } catch (e) { return void (ctx.root.innerHTML = fehlerBox(e.message)); }
  if (!d) return void (ctx.root.innerHTML = leer('Team nicht gefunden'));
  const t = d.team, spiele = d.spiele || [], kader = d.kader || [];
  const gespielt = spiele.filter((x) => x.eigen != null && x.fremd != null && (x.eigen + x.fremd > 0)); const kommend = spiele.filter((x) => x.eigen == null).slice(0, 6);
  const sieg = gespielt.filter((x) => x.eigen > x.fremd).length, unent = gespielt.filter((x) => x.eigen === x.fremd).length, nied = gespielt.length - sieg - unent;
  const tf = gespielt.reduce((a, x) => a + x.eigen, 0), tg = gespielt.reduce((a, x) => a + x.fremd, 0);
  const form = gespielt.slice(-5).map((x) => `<span class="form ${x.eigen > x.fremd ? 'w' : x.eigen === x.fremd ? 'u' : 'l'}" title="${datum(x.game_date)} ${esc(x.gegner)} ${x.eigen}:${x.fremd}">${x.eigen > x.fremd ? 'S' : x.eigen === x.fremd ? 'U' : 'N'}</span>`).join('');
  const zentrum = S.einst.zentrum || window.HANDSCOUT?.STAFA || {}; const dist = t.lat != null && zentrum.lat != null ? haversine(zentrum.lat, zentrum.lon, t.lat, t.lon) : null;
  const feld = kader.filter((x) => x.role === 'F'), tw = kader.filter((x) => x.role === 'G');
  const top = [...feld].sort((a, b) => b.goals - a.goals).slice(0, 6); const summeTore = feld.reduce((a, x) => a + x.goals, 0);
  const anteil = summeTore ? Math.round((top.slice(0, 3).reduce((a, x) => a + x.goals, 0) * 100) / summeTore) : null;
  const saisonWahl = (d.saisons || []).length > 1 ? `<div class="chips scroll">${d.saisons.map((s) => `<a class="chip ${s === d.saison ? 'an' : ''}" href="#/team/${tid}?s=${s}">${esc(String(s))}</a>`).join('')}</div>` : '';
  const zeile = (x) => `<tr><td class="l"><a class="pname" href="#/spieler/${x.player_id}">${esc(x.name || '?')}</a><span class="psub">Jg. ${esc(x.birth_year ?? '–')}${x.position ? ' · ' + esc(x.position) : ''}</span></td><td class="r">${x.games}</td>${x.role === 'G' ? `<td class="r">${x.saves}</td><td class="r">${prozent(x.save_pct, 1)}</td>` : `<td class="r">${x.goals}</td><td class="r">${prozent(x.goal_pct)}</td>`}<td class="r">${scoreBadge(x)}</td></tr>`;
  ctx.root.innerHTML = `<div class="seitenkopf"><a class="zurueck" href="#/suche" data-act="zurueck">${icon('zurueck')} Zurück</a><div class="aktionsleiste"><button class="btn secondary klein" data-act="druck">PDF / Druck</button></div></div>
  <header class="phead"><div><h1>${esc(t.name)}</h1><p class="psub gross">${esc([t.verein !== t.name ? t.verein : '', t.city, t.canton].filter(Boolean).join(' · '))}${dist != null ? ` · ${zahl(dist, 0)} km von ${esc(zentrum.name || 'Stäfa')}` : ''}</p>${t.stafa ? '<span class="tag gut">Handball Stäfa</span>' : ''}</div></header>${saisonWahl}
  <section class="box"><h2>Bilanz Saison ${esc(String(d.saison))}</h2>${gespielt.length ? `<div class="kachelgrid"><div class="kachel"><b>${sieg}–${unent}–${nied}</b><span>S–U–N</span></div><div class="kachel"><b>${tf}:${tg}</b><span>Tore</span><small>${zahl(tf / gespielt.length, 1)} : ${zahl(tg / gespielt.length, 1)} pro Spiel</small></div><div class="kachel"><b class="formz">${form || '–'}</b><span>letzte 5</span></div></div>` : '<p class="muted">Noch keine gespielten Partien in der Datenbank.</p>'}${gespielt.length ? balken({ werte: gespielt.slice(-12).map((x) => x.eigen), labels: gespielt.slice(-12).map((x) => `${datum(x.game_date)} gegen ${x.gegner}: ${x.eigen}:${x.fremd}`), titel: 'Eigene Tore der letzten Spiele' }) + '<p class="muted klein">Eigene Tore in den letzten Spielen.</p>' : ''}</section>
  ${kommend.length ? `<section class="box"><h2>Nächste Spiele</h2><ul class="spiele">${kommend.map((x) => `<li><span>${datum(x.game_date, true)}</span><b>${x.heim ? '' : '@ '}<a href="#/team/${x.gegner_id}?s=${d.saison}">${esc(x.gegner)}</a></b></li>`).join('')}</ul></section>` : ''}
  <section class="box"><h2>Schlüsselspieler</h2>${top.length ? `<p class="muted klein">${anteil != null ? `Die 3 besten Schützen erzielen ${anteil} % aller Feldtore des Kaders: ${anteil >= 60 ? 'das Spiel hängt stark an wenigen Spielern.' : 'die Tore sind breit verteilt.'}` : ''}</p>` : ''}
    ${kader.length ? `<div class="tabelle-wrap"><table class="liste klein"><thead><tr><th class="l">Feldspieler</th><th class="r">Sp</th><th class="r">Tore</th><th class="r">Quote</th><th class="r">Score</th></tr></thead><tbody>${[...feld].sort((a, b) => b.goals - a.goals).slice(0, 15).map(zeile).join('')}</tbody></table></div>
    ${tw.length ? `<div class="tabelle-wrap"><table class="liste klein"><thead><tr><th class="l">Torhüter</th><th class="r">Sp</th><th class="r">Paraden</th><th class="r">Quote</th><th class="r">Score</th></tr></thead><tbody>${tw.map(zeile).join('')}</tbody></table></div>` : ''}` : '<p class="muted">Keine Spielerstatistik für diese Saison.</p>'}</section>
  <section class="box"><h2>Alle Spiele</h2>${spiele.length ? `<ul class="spiele">${[...spiele].reverse().map((x) => `<li><span>${datum(x.game_date)}</span><span>${x.heim ? 'vs' : '@'} <a href="#/team/${x.gegner_id}?s=${d.saison}">${esc(x.gegner)}</a></span><b class="${x.eigen == null ? '' : x.eigen > x.fremd ? 'w' : x.eigen === x.fremd ? 'u' : 'l'}">${x.eigen == null || x.eigen + x.fremd === 0 ? '–' : x.eigen + ':' + x.fremd}</b></li>`).join('')}</ul>` : '<p class="muted">Keine Spiele.</p>'}</section>`;
  ctx.on = { druck() { window.print(); }, neu() { render(ctx); } };
}
