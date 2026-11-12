// Seite «Rankings»: vorbereitete Ranglisten (Torschützen, Quote, Fehler, Torhüter, Aufsteiger, Perlen, Entwicklung).
import { esc, zahl, vorz, dekodiere } from '../util.js';
import { rpc } from '../api.js';
import { S } from '../state.js';
import { RANKINGS, mitStandard, STANDARD } from '../filters.js';
import { spielerAnsicht } from './suche.js';
import { laden, fehlerBox, leer, scoreBadge, icon } from '../ui.js';

export async function render(ctx) {
  const id = ctx.arg || 'tore'; const board = RANKINGS.find((r) => r.id === id) || RANKINGS[0];
  const kopf = `<div class="seitenkopf"><h1>Rankings</h1></div><div class="chips scroll" role="tablist" aria-label="Rangliste wählen">${RANKINGS.map((r) => `<a class="chip ${r.id === board.id ? 'an' : ''}" role="tab" aria-selected="${r.id === board.id}" href="#/rankings/${r.id}">${esc(r.t)}</a>`).join('')}</div>`;
  if (board.id === 'entwicklung') return entwicklung(ctx, kopf);
  const f0 = ctx.params.get('f') ? dekodiere(ctx.params.get('f')) : board.f;
  return spielerAnsicht(ctx, { f0: { ...board.f, ...(f0 || {}) }, pfad: 'rankings/' + board.id, kopf, ohneModus: true });
}

async function entwicklung(ctx, kopf) {
  const opt = S.opt; let rolle = 'F', saison = (opt.saisons.find((s) => s.aktuell) || opt.saisons[0])?.id, ges = '';
  ctx.root.innerHTML = `${kopf}<p class="hinweis">Wer hat sich gegenüber der Vorsaison am stärksten verbessert? Verglichen wird der Score (Abstand zum Liga-Durchschnitt), nur Spieler mit genug Spielen in beiden Saisons.</p>
  <form class="filters" id="ef"><div class="grid"><label class="fld"><span>Saison</span><select name="saison">${opt.saisons.map((s) => `<option value="${s.id}" ${s.id === saison ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
  <label class="fld"><span>Art</span><select name="rolle"><option value="F">Feldspieler</option><option value="G">Torhüter</option></select></label>
  <label class="fld"><span>Geschlecht</span><select name="geschlecht"><option value="">Alle</option><option value="M">Herren</option><option value="W">Damen</option></select></label></div></form><div id="res">${laden()}</div>`;
  const form = ctx.root.querySelector('#ef'), $res = ctx.root.querySelector('#res');
  async function lade() {
    const d = Object.fromEntries(new FormData(form).entries()); $res.innerHTML = laden();
    try {
      const r = await rpc('entwicklung', { p: { saison: Number(d.saison), rolle: d.rolle, geschlecht: d.geschlecht, min_spiele: 8 } });
      if (!r.length) return void ($res.innerHTML = leer('Keine Vergleichsdaten', 'Es braucht Spieler mit je mindestens 8 Spielen in dieser und der Vorsaison.'));
      $res.innerHTML = `<div class="tabelle-wrap haupt"><table class="liste"><thead><tr><th class="l">Spieler</th><th class="l">Team</th><th class="r">Sp</th><th class="r">${d.rolle === 'G' ? 'Paradenquote' : 'Tore/Sp'}</th><th class="r">Vorher</th><th class="r">Veränderung Score</th></tr></thead><tbody>${r.map((x) => `<tr><td class="l"><a class="pname" href="#/spieler/${x.player_id}">${esc(x.name)}</a><span class="psub">Jg. ${esc(x.birth_year ?? '–')}</span></td><td class="l">${esc(x.team || '–')}<span class="psub">${esc(x.league || '')}</span></td><td class="r">${x.games}</td><td class="r">${d.rolle === 'G' ? zahl(x.save_pct, 1) + ' %' : zahl(x.goals_pg, 2)}</td><td class="r">${d.rolle === 'G' ? zahl(x.save_pct_vorher, 1) + ' %' : zahl(x.goals_pg_vorher, 2)}</td><td class="r"><span class="score ${x.d_score >= 0.5 ? 'top' : x.d_score > 0 ? 'gut' : 'schwach'}">${vorz(x.d_score, 2)}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="karten">${r.map((x) => `<article class="karte"><div class="k1"><div class="kname"><a class="pname" href="#/spieler/${x.player_id}">${esc(x.name)}</a><span class="psub">${esc(x.team || '–')} · ${esc(x.league || '')}</span></div><span class="score ${x.d_score >= 0.5 ? 'top' : x.d_score > 0 ? 'gut' : 'schwach'}">${vorz(x.d_score, 2)}<small>Score</small></span></div><div class="kmetrik"><div><b>${x.games}</b><span>Sp</span></div><div><b>${d.rolle === 'G' ? zahl(x.save_pct, 1) : zahl(x.goals_pg, 2)}</b><span>jetzt</span></div><div><b>${d.rolle === 'G' ? zahl(x.save_pct_vorher, 1) : zahl(x.goals_pg_vorher, 2)}</b><span>vorher</span></div><div><b>${vorz(d.rolle === 'G' ? x.d_paraden : x.d_tore, 1)}</b><span>Diff.</span></div></div></article>`).join('')}</div>`;
    } catch (e) { $res.innerHTML = fehlerBox(e.message); }
  }
  form.addEventListener('input', lade); form.addEventListener('submit', (e) => e.preventDefault()); ctx.on = { neu: lade }; await lade();
}
