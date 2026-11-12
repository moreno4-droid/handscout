// Seite «Stäfa»: nächste Spiele, eigene Spieler (inkl. Nachwuchs bis U13) mit Akten, Transfer-Schnellzugriffe.
import { esc, zahl, prozent, datum, wochentag, kodiere, jetztJahr } from '../util.js';
import { rpc } from '../api.js';
import { S } from '../state.js';
import { SCHNELL, mitStandard, kompakt } from '../filters.js';
import { icon, laden, fehlerBox, leer, scoreBadge, labelFuer } from '../ui.js';

export async function render(ctx) {
  const opt = S.opt; let sid = ctx.params.get('s') ? Number(ctx.params.get('s')) : (opt.saisons.find((s) => s.aktuell) || opt.saisons[0])?.id;
  const name = (S.einst.zentrum || window.HANDSCOUT?.STAFA || {}).name || 'Handball Stäfa';
  const chips = SCHNELL.filter((s) => !s.f.nur_stafa).map((s) => `<a class="chip" href="#/suche?f=${kodiere(kompakt(mitStandard(s.f)))}" title="${esc(s.tip)}">${esc(s.t)}</a>`).join('');
  ctx.root.innerHTML = `<div class="seitenkopf"><h1>${esc(name)}</h1></div>
    <section class="box"><h2>Transfers finden</h2><p class="muted klein">Direkt zur passenden Suche für ${esc(name)}:</p><div class="chips">${chips}</div></section>
    <section class="box"><h2>Nächste Spiele</h2><div id="next">${laden(2)}</div></section>
    <section class="box"><div class="seitenkopf innen"><h2>Unsere Spieler</h2><label class="fld inline"><span class="sr-only">Saison</span><select id="ssel">${opt.saisons.map((s) => `<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label></div><div id="uebers">${laden(4)}</div></section>`;
  const $n = ctx.root.querySelector('#next'), $u = ctx.root.querySelector('#uebers');
  rpc('stafa_naechste').then((l) => { $n.innerHTML = l.length ? `<ul class="spiele">${l.map((x) => { const heim = /st(ä|ae|a)fa/i.test(x.home_name || ''); const gegner = heim ? [x.away_name, x.away_team_id] : [x.home_name, x.home_team_id]; return `<li><span><b>${wochentag(x.game_date)}</b> ${datum(x.game_date, true)}</span><span class="psub">${esc(x.league || '')}</span><b>${heim ? 'vs' : '@'} <a href="#/team/${gegner[1]}">${esc(gegner[0])}</a></b></li>`; }).join('')}</ul><p class="muted klein">Tippe auf den Gegner für sein Scouting-Profil.</p>` : leer('Keine kommenden Spiele', 'Sobald der Spielplan von handball.ch importiert ist, erscheinen sie hier.'); }).catch((e) => { $n.innerHTML = fehlerBox(e.message); });
  async function uebersicht() {
    $u.innerHTML = laden(4);
    try {
      const r = await rpc('stafa_uebersicht', { sid }); const gruppen = new Map();
      for (const x of r.rows) { const k = (x.age_class || 'Aktive') + '|' + (x.team || ''); (gruppen.get(k) || gruppen.set(k, []).get(k)).push(x); }
      $u.innerHTML = r.rows.length ? [...gruppen.entries()].map(([k, l]) => { const [ak, team] = k.split('|'); return `<h3 class="gruppe">${esc(team)} <span class="tag">${esc(ak)}</span> <span class="muted klein">${l.length} Spieler</span></h3><div class="tabelle-wrap"><table class="liste klein"><thead><tr><th class="l">Spieler</th><th class="r">Sp</th><th class="r">Tore / Paraden</th><th class="r">Quote</th><th class="r">Score</th><th class="r">Akte</th></tr></thead><tbody>${l.map((x) => `<tr><td class="l"><a class="pname" href="#/spieler/${x.player_id}">${esc(x.name || '?')}</a><span class="psub">${x.birth_year ? 'Jg. ' + x.birth_year : ''}${x.position ? ' · ' + esc(x.position) : x.role === 'G' ? ' · Torhüter' : ''}${labelFuer(x, true) ? ' ' + labelFuer(x, true) : ''}</span></td><td class="r">${x.games}</td><td class="r">${x.role === 'G' ? x.saves : x.goals}</td><td class="r">${x.role === 'G' ? prozent(x.save_pct, 1) : prozent(x.goal_pct)}</td><td class="r">${scoreBadge(x)}</td><td class="r"><a href="#/spieler/${x.player_id}" class="tag ${x.hat_akte ? 'gut' : ''}">${x.hat_akte ? 'vorhanden' : 'anlegen'}</a></td></tr>`).join('')}</tbody></table></div>`; }).join('') : leer('Noch keine Spieler', `Für diese Saison sind keine Spieler mit «${esc(name)}» im Teamnamen gefunden. Prüfe, ob der Import gelaufen ist.`);
    } catch (e) { $u.innerHTML = fehlerBox(e.message); }
  }
  ctx.root.querySelector('#ssel').addEventListener('change', (e) => { sid = Number(e.target.value); uebersicht(); });
  ctx.on = { neu: uebersicht }; await uebersicht();
}
