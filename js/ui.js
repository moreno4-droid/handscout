// Wiederverwendbare Bausteine: Symbole, Kennzahlen, Spielerliste (Tabelle am Computer, Karten am Handy), Vergleichsleiste.
import { esc, zahl, prozent, vorz } from './util.js';
import { S, imVergleich } from './state.js';

const P = {
  suche: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', rank: '<path d="M6 20V10M12 20V4M18 20v-7"/>', stern: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z"/>',
  stafa: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9.5 20v-6h5v6"/>', zahnrad: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>', zurueck: '<path d="M15 5l-7 7 7 7"/>', haken: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>', filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  vergleich: '<path d="M8 4v16M16 4v16M4 8h8M12 16h8"/>', teilen: '<circle cx="6" cy="12" r="2.2"/><circle cx="17" cy="6" r="2.2"/><circle cx="17" cy="18" r="2.2"/><path d="M8 11l7-4M8 13l7 4"/>', runter: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  team: '<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3.5 19c.5-3.4 2.6-5 5.5-5s5 1.600 5.500 5M15 14.500c2.600-.4 4.700.8 5.500 4.500"/>', pin: '<path d="M12 21s6-5.400 6-10.500A6 6 0 0 0 6 10.500C6 15.600 12 21 12 21z"/><circle cx="12" cy="10.500" r="2.200"/>',
  pfeil: '<path d="M9 5l7 7-7 7"/>', kalender: '<rect x="4" y="5.500" width="16" height="14" rx="2"/><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4"/>',
};
export const icon = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[n] || ''}</svg>`;
export const sternIcon = (an) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="${an ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round">${P.stern}</svg>`;

export const ton = (s) => (s == null ? 'leer' : s >= 1 ? 'top' : s >= 0.3 ? 'gut' : s > -0.3 ? 'mittel' : 'schwach');
export const tonText = (s) => (s == null ? '' : s >= 1 ? 'stark' : s >= 0.3 ? 'gut' : s > -0.3 ? 'Schnitt' : 'schwach');
export function scoreBadge(r) {
  if (r.score == null) return `<span class="score leer" title="Zu wenige Spiele oder Würfe für einen fairen Vergleich (Feldspieler: ab 3 Spielen und 15 Würfen, Torhüter: ab 3 Spielen und 30 Gegenwürfen)">–</span>`;
  return `<span class="score ${ton(r.score)}" title="Formwert im Vergleich zur Liga: 0 = Durchschnitt. ${tonText(r.score)}">${vorz(r.score, 1)}<small>${tonText(r.score)}</small></span>`;
}
export const wenigSpiele = (r) => (r.games < 5 ? `<span class="warnchip" title="Nur ${r.games} Spiel(e): Aussagekraft gering">${icon('warn')}${r.games} Sp.</span>` : '');
export const mfLabel = (g) => (g === 'W' ? 'Damen' : g === 'M' ? 'Herren' : '');
export const geschlechtKurz = (g) => (g === 'W' ? 'D' : g === 'M' ? 'H' : '');

export function leer(titel, text = '', aktion = '') { return `<div class="leer"><p class="leer-t">${esc(titel)}</p>${text ? `<p class="muted">${text}</p>` : ''}${aktion}</div>`; }
export const laden = (n = 5) => `<div class="skel" aria-busy="true" aria-label="Lädt">${'<i></i>'.repeat(n)}</div>`;
export const fehlerBox = (msg, retry = true) => `<div class="fehlerbox" role="alert"><b>Das hat nicht geklappt.</b><p>${esc(msg)}</p>${retry ? '<button class="btn" data-act="neu">Nochmals versuchen</button>' : ''}</div>`;

export function sterne(n, id = null) { return `<span class="sterne" aria-label="${n} von 5 Sternen">${[1, 2, 3, 4, 5].map((i) => `<button class="stern ${i <= n ? 'an' : ''}" ${id != null ? `data-act="stern" data-id="${id}" data-n="${i === n ? 0 : i}"` : 'tabindex="-1"'} aria-label="${i} Sterne">${sternIcon(i <= n)}</button>`).join('')}</span>`; }

const KOPF = {
  F: [['name', 'Spieler', 'l'], ['team', 'Team', 'l'], ['games', 'Sp'], ['goals', 'Tore'], ['goals_pg', 'T/Sp'], ['goal_pct', 'Quote'], ['tf_pg', 'TF/Sp'], ['min2_pg', '2′/Sp'], ['score', 'Score']],
  G: [['name', 'Spieler', 'l'], ['team', 'Team', 'l'], ['games', 'Sp'], ['saves', 'Paraden'], ['shots_gk', 'Gegenwürfe'], ['save_pct', 'Quote'], ['saves_pg', 'P/Sp'], ['score', 'Score']],
};
function zellen(r, rolle) {
  return rolle === 'G'
    ? [zahl(r.games), zahl(r.saves), zahl(r.shots_gk), prozent(r.save_pct, 1), zahl(r.saves_pg, 1)]
    : [zahl(r.games), zahl(r.goals), zahl(r.goals_pg, 2), prozent(r.goal_pct), zahl(r.tf_pg, 2), zahl(r.min2_pg, 2)];
}
const metrikenKarte = (r, rolle) => (rolle === 'G'
  ? [['Sp', zahl(r.games)], ['Paraden', zahl(r.saves)], ['Quote', prozent(r.save_pct, 1)], ['P/Sp', zahl(r.saves_pg, 1)]]
  : [['Sp', zahl(r.games)], ['Tore', zahl(r.goals)], ['T/Sp', zahl(r.goals_pg, 1)], ['Quote', prozent(r.goal_pct)]]);

function spielerZelle(r) {
  const sub = [r.birth_year ? 'Jg. ' + r.birth_year : null, r.position || null, mfLabel(r.gender) && r.age_class ? r.age_class : null].filter(Boolean).join(' · ');
  return `<a class="pname" href="#/spieler/${r.player_id}">${esc(r.name || 'Unbekannt')}</a><span class="psub">${esc(sub)} ${labelFuer(r, true)}</span>`;
}
const teamZelle = (r, mitSaison) => `${esc(r.team || '–')}<span class="psub">${esc([r.league, mitSaison ? r.season : null].filter(Boolean).join(' · '))}${r.dist != null ? ' · ' + zahl(r.dist, 0) + ' km' : ''}</span>`;
const aktionen = (r) => `<button class="iconbtn ${r.on_watchlist ? 'an' : ''}" data-act="wl" data-id="${r.player_id}" aria-pressed="${!!r.on_watchlist}" aria-label="${r.on_watchlist ? 'Von Watchlist entfernen' : 'Zur Watchlist'}">${sternIcon(r.on_watchlist)}</button>`
  + `<button class="iconbtn ${imVergleich(r.player_id) ? 'an' : ''}" data-act="cmp" data-id="${r.player_id}" data-name="${esc(r.name)}" aria-pressed="${imVergleich(r.player_id)}" aria-label="Zum Vergleich">${icon('vergleich')}</button>`;

// res: Antwort von suche(); opt: {rolle, sort, dir, mitSaison}
export function spielerListe(res, o) {
  const rows = res.rows || []; if (!rows.length) return leer('Keine Treffer', 'Passe die Filter an: weniger Mindest-Spiele, andere Saison oder grösserer Umkreis.');
  const kopf = KOPF[o.rolle].filter((k) => k[0] !== 'team' || true);
  const dir = (k) => (o.sort === k ? (o.dir === 'asc' ? ' ▲' : ' ▼') : '');
  const th = kopf.map(([k, t, a]) => `<th class="${a === 'l' ? 'l' : 'r'}"><button data-act="sort" data-k="${k === 'team' ? 'team' : k}" aria-label="Sortieren nach ${esc(t)}">${esc(t)}${dir(k)}</button></th>`).join('') + '<th class="akt"></th>';
  const tr = rows.map((r) => { const z = zellen(r, o.rolle); return `<tr class="${r.on_watchlist ? 'wl' : ''}"><td class="l">${spielerZelle(r)}</td><td class="l">${teamZelle(r, o.mitSaison)}</td>${z.map((v) => `<td class="r">${v}</td>`).join('')}<td class="r">${scoreBadge(r)}${wenigSpiele(r)}</td><td class="akt">${aktionen(r)}</td></tr>`; }).join('');
  const karten = rows.map((r) => `<article class="karte ${r.on_watchlist ? 'wl' : ''}"><div class="k1"><div class="kname">${spielerZelle(r)}</div>${scoreBadge(r)}</div><div class="psub kteam">${teamZelle(r, o.mitSaison)}</div><div class="kmetrik">${metrikenKarte(r, o.rolle).map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div><div class="k3">${wenigSpiele(r)}<span class="sp"></span>${aktionen(r)}</div></article>`).join('');
  const mehr = res.total > rows.length ? `<p class="muted klein mitte">${rows.length} von ${zahl(res.total)} Treffern angezeigt. <button class="link" data-act="mehr">Mehr laden</button></p>` : '';
  return `<div class="tabelle-wrap haupt"><table class="liste"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div><div class="karten">${karten}</div>${mehr}`;
}

// Leiste unten: bis zu 4 Spieler zum Vergleichen
export function vergleichsLeiste() {
  const el = document.getElementById('cmpbar'); if (!el) return;
  const n = S.vergleich.length; el.hidden = n === 0; if (!n) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="cmp-in"><span class="cmp-t">${icon('vergleich')} Vergleich</span><span class="cmp-l">${S.vergleich.map((p) => `<button class="chip" data-act="cmp" data-id="${p.id}" data-name="${esc(p.name)}" title="Entfernen">${esc((p.name || '').split(' ')[0])} ${icon('x')}</button>`).join('')}</span>${n >= 2 ? `<a class="btn klein" href="#/vergleich/${S.vergleich.map((p) => p.id).join(',')}">Vergleichen (${n})</a>` : '<span class="muted klein">noch einen wählen</span>'}</div>`;
}

// Nachwuchs-/Rookie-Etikett: Nachwuchs = Jugendklasse U13–U19 (aus dem Ligennamen). Rookie = bis 19 Jahre alt und schon bei den Aktiven.
export function labelFuer(r, html = false) {
  const jahr = new Date().getFullYear(); const alter = r.birth_year ? jahr - r.birth_year : null; let t = null;
  if (r.age_class) t = 'Nachwuchs ' + r.age_class; else if (alter != null && alter <= 19) t = 'Rookie';
  return t ? (html ? `<span class="tag rook">${esc(t)}</span>` : t) : '';
}
