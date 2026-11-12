// Filter: Zustand der Oberfläche → Parameter für die Datenbank, Filter-Formular, Schnellfilter.
import { esc } from './util.js';
import { S } from './state.js';
import { icon } from './ui.js';

export const STANDARD = { rolle: 'F', name: '', saison: 'cur', geschlecht: '', liga: '', alter: '', nachwuchs: false, jahr_von: '', jahr_bis: '', position: '', team: '', kanton: '', km: '', min_spiele: '', min_wuerfe: '', min_tore_pg: '', min_quote: '', max_strafen_pg: '', min_parade: '', modus: 'liste', sort: '', dir: 'desc', nur_stafa: false, limit: 50 };
export const mitStandard = (f) => ({ ...STANDARD, ...(f || {}) });
export const kompakt = (f) => Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== STANDARD[k] && v !== '' && v !== false && k !== 'limit'));

export function saisonIds(f, opt) {
  const alle = (opt?.saisons || []).map((s) => s.id);
  if (f.saison === 'alle' || f.saison === 'zus') return alle;
  if (f.saison && f.saison !== 'cur' && alle.includes(Number(f.saison))) return [Number(f.saison)];
  const akt = (opt?.saisons || []).find((s) => s.aktuell) || (opt?.saisons || [])[0]; return akt ? [akt.id] : [];
}
export function zuParams(f, opt) {
  const c = S.einst.zentrum || window.HANDSCOUT?.STAFA || {};
  const p = { rolle: f.rolle, saisons: saisonIds(f, opt), zusammen: f.saison === 'zus', modus: f.modus, limit: f.limit || 50, dir: f.dir };
  const n = (k, as = k) => { if (f[k] !== '' && f[k] != null) p[as] = f[k]; };
  ['name', 'liga', 'position', 'team', 'kanton', 'jahr_von', 'jahr_bis', 'min_spiele', 'min_wuerfe', 'min_tore_pg', 'min_quote', 'max_strafen_pg', 'min_parade'].forEach((k) => n(k));
  if (f.geschlecht) p.geschlecht = f.geschlecht; if (f.alter) p.altersklasse = f.alter; if (f.nachwuchs) p.nachwuchs = true; if (f.nur_stafa) p.nur_stafa = true;
  if (f.sort) p.sort = f.sort;
  if (f.km && c.lat != null) p.umkreis = { lat: c.lat, lon: c.lon, km: Number(f.km) };
  return p;
}

export const SCHNELL = [
  { t: 'Torhüter im Umkreis', f: { rolle: 'G', km: 30, min_spiele: 3, sort: 'save_pct' }, tip: 'Torhüter bis 30 km von Stäfa, beste Paradenquote zuerst' },
  { t: 'Nachwuchs-Talente', f: { modus: 'aufsteiger', nachwuchs: true, sort: 'score' }, tip: 'Jugendspieler, die jünger als ihre Liga-Mitspieler und stark sind' },
  { t: 'Aufsteiger', f: { modus: 'aufsteiger', sort: 'score' }, tip: 'Junge Spieler, die in der höchsten Stufe überdurchschnittlich spielen' },
  { t: 'Versteckte Perlen', f: { modus: 'perlen', sort: 'score' }, tip: 'Starke Spieler in tieferen Ligen (ab 1. Liga abwärts)' },
  { t: 'Nur Stäfa', f: { nur_stafa: true }, tip: 'Alle Spieler von Handball Stäfa' },
];
export const RANKINGS = [
  { id: 'tore', t: 'Torschützen', f: { rolle: 'F', sort: 'goals', min_spiele: 3 } },
  { id: 'quote', t: 'Wurfquote', f: { rolle: 'F', sort: 'goal_pct', min_wuerfe: 30, min_spiele: 3 } },
  { id: 'fehler', t: 'Wenig Fehler', f: { rolle: 'F', sort: 'tf_pg', dir: 'asc', min_spiele: 5, min_wuerfe: 30 } },
  { id: 'fair', t: 'Fairste', f: { rolle: 'F', sort: 'min2_pg', dir: 'asc', min_spiele: 8, min_wuerfe: 30 } },
  { id: 'torhueter', t: 'Torhüter', f: { rolle: 'G', sort: 'save_pct', min_spiele: 3, min_wuerfe: 30 } },
  { id: 'aufsteiger', t: 'Aufsteiger', f: { modus: 'aufsteiger', sort: 'score' } },
  { id: 'perlen', t: 'Versteckte Perlen', f: { modus: 'perlen', sort: 'score' } },
  { id: 'entwicklung', t: 'Entwicklung', f: {} },
];

const fld = (label, inner, w = '') => `<label class="fld ${w}"><span>${label}</span>${inner}</label>`;
const sel = (name, opts, cur) => `<select name="${name}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
const num = (name, cur, ph = '', step = '1') => `<input name="${name}" inputmode="decimal" type="number" step="${step}" min="0" value="${esc(cur)}" placeholder="${esc(ph)}">`;

export function panelHtml(f, opt, { ohneModus = false } = {}) {
  const sais = [['cur', 'Aktuelle Saison'], ...(opt.saisons || []).filter((s) => !s.aktuell).map((s) => [s.id, s.name]), ['alle', 'Alle Saisons (einzeln)'], ['zus', 'Alle Saisons (zusammen)']];
  const aks = [['', 'Alle'], ...[...new Set((opt.ligen || []).map((l) => l.age_class).filter(Boolean))].sort().map((a) => [a, a])];
  const kant = [['', 'Alle'], ...(opt.kantone || []).map((k) => [k, k])];
  const pos = [['', 'Alle'], ...(opt.positionen || []).map((k) => [k, k])];
  const ligen = [...new Set((opt.ligen || []).map((l) => l.league))].sort();
  const g = f.rolle === 'G';
  const zentrum = (S.einst.zentrum || window.HANDSCOUT?.STAFA || {}).name || 'Stäfa';
  return `<form class="filters" id="ffrm" autocomplete="off">
    <div class="seg" role="radiogroup" aria-label="Spielerart"><label><input type="radio" name="rolle" value="F" ${!g ? 'checked' : ''}><span>Feldspieler</span></label><label><input type="radio" name="rolle" value="G" ${g ? 'checked' : ''}><span>Torhüter</span></label></div>
    <div class="grid">
      ${fld('Saison', sel('saison', sais, f.saison))}
      ${fld('Geschlecht', sel('geschlecht', [['', 'Alle'], ['M', 'Herren'], ['W', 'Damen']], f.geschlecht))}
      ${fld('Liga', `<input name="liga" list="ligenliste" value="${esc(f.liga)}" placeholder="z. B. NLB, U17, 1. Liga"><datalist id="ligenliste">${ligen.map((l) => `<option value="${esc(l)}">`).join('')}</datalist>`)}
      ${fld('Altersklasse', sel('alter', aks, f.alter))}
      ${fld('Jahrgang von', num('jahr_von', f.jahr_von, '2003'))}
      ${fld('Jahrgang bis', num('jahr_bis', f.jahr_bis, '2012'))}
      ${fld('Position', sel('position', pos, f.position))}
      ${fld('Team', `<input name="team" value="${esc(f.team)}" placeholder="Vereinsname">`)}
      ${fld('Kanton', sel('kanton', kant, f.kanton))}
      ${fld(`Umkreis um ${esc(zentrum)}`, sel('km', [['', 'Egal'], ...[10, 20, 30, 50, 80, 120].map((k) => [k, '≤ ' + k + ' km'])], f.km))}
      ${fld('Mindest-Spiele', num('min_spiele', f.min_spiele, '3'))}
      ${fld(g ? 'Mindest-Gegenwürfe' : 'Mindest-Würfe', num('min_wuerfe', f.min_wuerfe, g ? '30' : '15'))}
      ${g ? fld('Paradenquote ab (%)', num('min_parade', f.min_parade, '30')) : fld('Tore pro Spiel ab', num('min_tore_pg', f.min_tore_pg, '2', '0.1'))}
      ${g ? '' : fld('Wurfquote ab (%)', num('min_quote', f.min_quote, '50'))}
      ${g ? '' : fld('Strafen (2′) pro Spiel bis', num('max_strafen_pg', f.max_strafen_pg, '0.5', '0.1'))}
      ${ohneModus ? '' : fld('Ansicht', sel('modus', [['liste', 'Alle Spieler'], ['aufsteiger', 'Aufsteiger / Talente'], ['perlen', 'Versteckte Perlen']], f.modus))}
    </div>
    <div class="checks"><label class="chk"><input type="checkbox" name="nachwuchs" ${f.nachwuchs ? 'checked' : ''}> Nur Nachwuchs (U13–U19)</label><label class="chk"><input type="checkbox" name="nur_stafa" ${f.nur_stafa ? 'checked' : ''}> Nur Handball Stäfa</label></div>
    <div class="fbtn"><button type="button" class="btn secondary klein" data-act="reset">${icon('x')} Zurücksetzen</button></div>
  </form>`;
}
export function lesePanel(form, alt) {
  const f = { ...alt }; const d = new FormData(form);
  for (const k of Object.keys(STANDARD)) if (d.has(k)) f[k] = d.get(k);
  f.nachwuchs = !!form.elements.nachwuchs?.checked; f.nur_stafa = !!form.elements.nur_stafa?.checked;
  return f;
}
export const schnellHtml = () => `<div class="chips" aria-label="Schnellfilter">${SCHNELL.map((s, i) => `<button class="chip" data-act="schnell" data-i="${i}" title="${esc(s.tip)}">${esc(s.t)}</button>`).join('')}</div>`;
