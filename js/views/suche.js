// Seite «Suche»: Spieler finden (viele Filter) und Teams für das Gegner-Scouting.
import { esc, zahl, entprellen, kodiere, dekodiere, toast, exportCsv, exportXlsx, drucken, lsGet } from '../util.js';
import { rpc, status } from '../api.js';
import { S, filterSpeichern, filterLoeschen } from '../state.js';
import { STANDARD, mitStandard, kompakt, zuParams, panelHtml, lesePanel, schnellHtml, SCHNELL, saisonIds } from '../filters.js';
import { spielerListe, laden, fehlerBox, icon, leer } from '../ui.js';

export const SPALTEN = {
  F: [['Name', (r) => r.name], ['Jahrgang', (r) => r.birth_year], ['Position', (r) => r.position], ['Team', (r) => r.team], ['Liga', (r) => r.league], ['Saison', (r) => r.season], ['Spiele', (r) => r.games], ['Tore', (r) => r.goals], ['Würfe', (r) => r.shots], ['Tore/Spiel', (r) => r.goals_pg], ['Quote %', (r) => r.goal_pct], ['7m Tore', (r) => r.goals7], ['7m Würfe', (r) => r.shots7], ['Technische Fehler', (r) => r.tf], ['2-Min-Strafen', (r) => r.min2], ['Verwarnungen', (r) => r.warnings], ['Disqualifikationen', (r) => r.disq], ['Score', (r) => r.score], ['Kanton', (r) => r.canton]],
  G: [['Name', (r) => r.name], ['Jahrgang', (r) => r.birth_year], ['Team', (r) => r.team], ['Liga', (r) => r.league], ['Saison', (r) => r.season], ['Spiele', (r) => r.games], ['Paraden', (r) => r.saves], ['Gegenwürfe', (r) => r.shots_gk], ['Paradenquote %', (r) => r.save_pct], ['Paraden/Spiel', (r) => r.saves_pg], ['7m gehalten', (r) => r.saves7], ['7m Gegenwürfe', (r) => r.shots7_gk], ['Score', (r) => r.score], ['Kanton', (r) => r.canton]],
};
export const spaltenFuer = (rolle) => SPALTEN[rolle].map(([titel, wert]) => ({ titel, wert }));

export function setzeUrl(pfad, f) { const k = kompakt(f); const q = Object.keys(k).length ? '?f=' + kodiere(k) : ''; try { history.replaceState(null, '', '#/' + pfad + q); } catch { /* egal */ } }

// Gemeinsame Ansicht für Suche und Rankings: Panel + Ergebnisliste
export async function spielerAnsicht(ctx, { f0, pfad, kopf = '', panelOffen = false, ohneModus = false, vorLaden = null }) {
  const opt = S.opt; let f = mitStandard(f0); let res = null; let nr = 0;
  ctx.root.innerHTML = `${kopf}
    <div class="suchzeile"><label class="sr-only" for="q">Name suchen</label><input id="q" type="search" placeholder="Spieler suchen" value="${esc(f.name)}" autocomplete="off" enterkeyhint="search"><button class="btn secondary" data-act="panel" aria-expanded="${panelOffen}">${icon('filter')} Filter</button></div>
    ${pfad === 'suche' ? schnellHtml() : ''}
    <div id="panel" ${panelOffen ? '' : 'hidden'}>${panelHtml(f, opt, { ohneModus })}</div>
    <div class="werkzeuge" id="werk"></div>
    <div id="res" aria-live="polite">${laden()}</div>`;
  const $res = ctx.root.querySelector('#res'), $q = ctx.root.querySelector('#q'), $p = ctx.root.querySelector('#panel');

  const werkzeuge = () => {
    ctx.root.querySelector('#werk').innerHTML = `<div class="wz-l"><select id="gesp" aria-label="Gespeicherte Filter"><option value="">Gespeicherte Filter${S.filter.length ? ` (${S.filter.length})` : ''}</option>${S.filter.map((x) => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')}</select>
      <button class="btn secondary klein" data-act="speichern">${icon('plus')} Filter speichern</button><button class="btn secondary klein" data-act="link">${icon('teilen')} Link</button></div>
      <div class="wz-r"><button class="btn secondary klein" data-act="csv">${icon('runter')} CSV</button><button class="btn secondary klein" data-act="xlsx">Excel</button><button class="btn secondary klein" data-act="druck">PDF / Druck</button></div>`;
  };
  async function lade() {
    const mein = ++nr; setzeUrl(pfad, f);
    try {
      const p = zuParams(f, opt); res = await rpc('suche', { p }); if (mein !== nr) return;
      const mitSaison = f.saison === 'alle'; const sais = saisonIds(f, opt).length === 1 ? (opt.saisons.find((s) => s.id === saisonIds(f, opt)[0])?.name || '') : f.saison === 'zus' ? 'Alle Saisons zusammen' : 'Alle Saisons';
      const sortAnz = f.sort || (['aufsteiger', 'perlen'].includes(f.modus) ? 'score' : f.rolle === 'G' ? 'save_pct' : 'goals');
      $res.innerHTML = `<p class="info-z"><b>${zahl(res.total)}</b> Treffer · ${esc(sais)}${status.offline ? ' · <span class="offl">Offline-Stand</span>' : ''}</p>${f.modus !== 'liste' ? `<p class="hinweis">${f.modus === 'aufsteiger' ? 'Aufsteiger: Spieler, die mindestens ein Jahr jünger als der Liga-Schnitt sind, einen Score von 0,3 oder mehr erreichen und in der obersten Stufe oder im Nachwuchs spielen.' : 'Versteckte Perlen: starke Spieler (Score ab 1,0, mind. 8 Spiele) in der 1. Liga oder tiefer.'}</p>` : ''}${spielerListe(res, { rolle: f.rolle, sort: sortAnz, dir: f.dir, mitSaison })}`;
    } catch (e) { if (mein === nr) $res.innerHTML = fehlerBox(e.message); }
  }
  const aenderung = (neu) => { f = { ...neu, limit: 50 }; $q.value = f.name; lade(); };
  const vomPanel = () => { f = lesePanel(ctx.root.querySelector('#ffrm'), { ...f, name: $q.value.trim() }); f.limit = 50; if (f.rolle === 'G' && ['goals_pg', 'goals', 'goal_pct', 'tf_pg', 'min2_pg'].includes(f.sort)) f.sort = ''; if (f.rolle === 'F' && ['save_pct', 'saves', 'saves_pg'].includes(f.sort)) f.sort = ''; };
  const panelNeu = () => { $p.innerHTML = panelHtml(f, opt, { ohneModus }); bindPanel(); };
  const bindPanel = () => {
    const form = ctx.root.querySelector('#ffrm'); const spaeter = entprellen(() => { vomPanel(); lade(); }, 350);
    form.addEventListener('input', (e) => { if (e.target.type === 'radio' || e.target.tagName === 'SELECT' || e.target.type === 'checkbox') { vomPanel(); if (e.target.name === 'rolle') panelNeu(); lade(); } else spaeter(); });
    form.addEventListener('submit', (e) => e.preventDefault());
  };
  $q.addEventListener('input', entprellen(() => { f.name = $q.value.trim(); f.limit = 50; lade(); }, 300));
  bindPanel(); werkzeuge();
  ctx.root.addEventListener('change', (e) => { if (e.target.id !== 'gesp') return; const x = S.filter.find((y) => y.name === e.target.value); if (x) { aenderung(mitStandard(x.f)); panelNeu(); } });

  ctx.on = {
    panel(el) { $p.hidden = !$p.hidden; el.setAttribute('aria-expanded', String(!$p.hidden)); },
    reset() { aenderung({ ...STANDARD, rolle: f.rolle }); panelNeu(); },
    schnell(el) { const s = SCHNELL[Number(el.dataset.i)]; aenderung(mitStandard(s.f)); panelNeu(); $p.hidden = true; },
    sort(el) { const k = el.dataset.k; const ziel = k === 'team' ? 'team' : k; const alt = f.sort || (['aufsteiger', 'perlen'].includes(f.modus) ? 'score' : f.rolle === 'G' ? 'save_pct' : 'goals'); f.dir = alt === ziel && f.dir === 'desc' ? 'asc' : alt === ziel ? 'desc' : (['name', 'team'].includes(ziel) ? 'asc' : 'desc'); f.sort = ziel; f.limit = 50; lade(); },
    mehr() { f.limit = (f.limit || 50) + 100; lade(); },
    neu() { lade(); },
    speichern() { const n = prompt_(f); if (!n) return; filterSpeichern(n, kompakt(f)); werkzeuge(); toast('Filter «' + n + '» gespeichert'); },
    async link() { const u = location.href; try { await navigator.clipboard.writeText(u); toast('Link kopiert'); } catch { toast('Link steht oben in der Adresszeile', ''); } },
    csv() { if (!res?.rows?.length) return toast('Nichts zu exportieren'); exportCsv('handscout-' + f.rolle + '-' + new Date().toISOString().slice(0, 10), spaltenFuer(f.rolle), res.rows); },
    async xlsx() { if (!res?.rows?.length) return toast('Nichts zu exportieren'); try { await exportXlsx('handscout-' + f.rolle + '-' + new Date().toISOString().slice(0, 10), spaltenFuer(f.rolle), res.rows); } catch (e) { toast('Excel nicht möglich (' + e.message + '). CSV funktioniert immer.', 'fehler'); } },
    druck: drucken,
  };
  if (vorLaden) vorLaden(f);
  await lade();
}
// Ein Name für den gespeicherten Filter (ohne Browser-Dialog): aus den wichtigsten Einstellungen
function prompt_(f) { const teile = [f.rolle === 'G' ? 'Torhüter' : 'Feldspieler', f.liga, f.alter, f.position, f.km ? '≤' + f.km + ' km' : '', f.modus !== 'liste' ? f.modus : '', f.name].filter(Boolean); return teile.join(' · ').slice(0, 60) || 'Mein Filter'; }

// ---------- Teams ----------
async function teamsAnsicht(ctx, kopf) {
  const opt = S.opt; let t = { saison: 'cur', name: '', liga: '', kanton: '' };
  const q = ctx.params.get('t'); if (q) t = { ...t, ...(dekodiere(q) || {}) };
  ctx.root.innerHTML = `${kopf}<form class="filters teamsf" id="tf" autocomplete="off"><div class="grid">
    <label class="fld"><span>Saison</span><select name="saison">${[['cur', 'Aktuelle Saison'], ...opt.saisons.filter((s) => !s.aktuell).map((s) => [s.id, s.name])].map(([v, n]) => `<option value="${v}" ${String(v) === String(t.saison) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <label class="fld"><span>Teamname</span><input name="name" value="${esc(t.name)}" placeholder="z. B. Stäfa, Kadetten" type="search"></label>
    <label class="fld"><span>Liga</span><input name="liga" value="${esc(t.liga)}" placeholder="z. B. NLB, U17"></label>
    <label class="fld"><span>Kanton</span><select name="kanton"><option value="">Alle</option>${opt.kantone.map((k) => `<option ${k === t.kanton ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></label></div></form><div id="res">${laden()}</div>`;
  const $res = ctx.root.querySelector('#res'); let nr = 0;
  async function lade() {
    const mein = ++nr; const d = new FormData(ctx.root.querySelector('#tf')); t = Object.fromEntries(d.entries());
    const saison = t.saison === 'cur' ? (opt.saisons.find((s) => s.aktuell) || opt.saisons[0])?.id : Number(t.saison);
    try { const r = await rpc('teams_suche', { p: { saison, name: t.name, liga: t.liga, kanton: t.kanton } }); if (mein !== nr) return;
      try { history.replaceState(null, '', '#/suche?tab=teams&t=' + kodiere(t)); } catch {}
      $res.innerHTML = r.rows.length ? `<p class="info-z"><b>${zahl(r.rows.length)}</b> Teams${r.rows.length >= 300 ? ' (erste 300)' : ''}</p><div class="teamliste">${r.rows.map((x) => `<a class="team-k" href="#/team/${x.team_id}?s=${r.saison}"><div><b>${esc(x.name)}</b><span class="psub">${esc(x.league || '')}${x.canton ? ' · ' + esc(x.canton) : ''}${x.city ? ' · ' + esc(x.city) : ''}</span></div><div class="bil"><b>${x.siege}–${x.unentschieden}–${x.spiele - x.siege - x.unentschieden}</b><span>${x.tore_fuer ?? 0}:${x.tore_gegen ?? 0}</span></div></a>`).join('')}</div>` : leer('Keine Teams gefunden', 'Teams erscheinen, sobald ihre Spiele importiert sind.');
    } catch (e) { if (mein === nr) $res.innerHTML = fehlerBox(e.message); }
  }
  const spaeter = entprellen(lade, 300); const form = ctx.root.querySelector('#tf');
  form.addEventListener('input', (e) => (e.target.tagName === 'SELECT' ? lade() : spaeter())); form.addEventListener('submit', (e) => e.preventDefault());
  ctx.on = { neu: lade }; await lade();
}

export async function render(ctx) {
  const tab = ctx.params.get('tab') === 'teams' ? 'teams' : 'spieler';
  const kopf = `<div class="seitenkopf"><h1>Suche</h1><div class="tabs2" role="tablist"><a role="tab" aria-selected="${tab === 'spieler'}" href="#/suche">Spieler</a><a role="tab" aria-selected="${tab === 'teams'}" href="#/suche?tab=teams">Teams</a></div></div>`;
  if (tab === 'teams') return teamsAnsicht(ctx, kopf);
  const f0 = ctx.params.get('f') ? dekodiere(ctx.params.get('f')) : null;
  return spielerAnsicht(ctx, { f0, pfad: 'suche', kopf, panelOffen: !!f0 && Object.keys(f0).length > 1 });
}
