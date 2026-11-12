// Spielerprofil: Kennzahlen, Stärken, Entwicklung, Karriereweg, letzte Spiele, ähnliche Spieler, Watchlist und Akte.
import { esc, zahl, prozent, vorz, datum, haversine, toast, jetztJahr } from '../util.js';
import { rpc, status } from '../api.js';
import { S, imVergleich, vergleichUmschalten } from '../state.js';
import { linien, balken, radar } from '../charts.js';
import { icon, laden, fehlerBox, scoreBadge, mfLabel, sternIcon, leer, labelFuer } from '../ui.js';
import { vergleichsLeiste } from '../ui.js';

const kachel = (l, v, u = '', tip = '') => `<div class="kachel" ${tip ? `title="${esc(tip)}"` : ''}><b>${v}</b><span>${esc(l)}</span>${u ? `<small>${u}</small>` : ''}</div>`;
const prozentRang = (p) => (p == null ? null : Math.round(p * 100));
const STATUS = [['beobachten', 'Beobachten'], ['kontaktieren', 'Kontaktieren'], ['abgesagt', 'Abgesagt']];

function karriere(sa) {
  const asc = [...sa].sort((a, b) => a.season_id - b.season_id); const zeilen = [];
  asc.forEach((s, i) => {
    const v = asc[i - 1]; const hinweise = [];
    if (v && v.team_id !== s.team_id) hinweise.push('<span class="tag">Vereinswechsel</span>');
    if (v && v.stufe != null && s.stufe != null && s.stufe < v.stufe) hinweise.push('<span class="tag gut">Liga höher ↑</span>');
    if (v && v.stufe != null && s.stufe != null && s.stufe > v.stufe) hinweise.push('<span class="tag schwach">Liga tiefer ↓</span>');
    zeilen.push(`<li><span class="jahr">${esc(s.season)}</span><div><b>${esc(s.team || '–')}</b><span class="psub">${esc(s.league || '')} · ${s.games} Spiele${s.role === 'G' ? ' (Torhüter)' : ''}</span>${hinweise.join('')}</div></li>`);
  });
  return `<ol class="weg">${zeilen.join('')}</ol>`;
}

export async function render(ctx) {
  const pid = Number(ctx.arg); if (!pid) return void (ctx.root.innerHTML = fehlerBox('Ungültiger Spieler.', false));
  ctx.root.innerHTML = `<div class="seitenkopf"><a class="zurueck" href="#/suche" data-act="zurueck">${icon('zurueck')} Zurück</a></div>${laden(6)}`;
  let d; try { d = await rpc('profil', { pid }); } catch (e) { return void (ctx.root.innerHTML = fehlerBox(e.message)); }
  if (!d) return void (ctx.root.innerHTML = leer('Spieler nicht gefunden', 'Diese Nummer gibt es nicht in der Datenbank.'));
  const sp = d.spieler, sa = d.saisons || [], gm = d.spiele || [], w = d.watch, ak = d.akte;
  if (!sa.length) return void (ctx.root.innerHTML = `<div class="seitenkopf"><a class="zurueck" href="#/suche">${icon('zurueck')} Suche</a></div><h1>${esc(sp.name || 'Spieler')}</h1>${leer('Noch keine Saisonstatistik', 'Für diesen Spieler sind keine Spielberichte importiert.')}`);
  let wahl = sa[0].season_id; const rolleOf = (id) => sa.find((x) => x.season_id === id)?.role || sa[0].role;
  const zentrum = S.einst.zentrum || window.HANDSCOUT?.STAFA || {};
  const letzte = sa[0]; const dist = letzte.lat != null && zentrum.lat != null ? haversine(zentrum.lat, zentrum.lon, letzte.lat, letzte.lon) : null;
  const alter = sp.birth_year ? jetztJahr() - sp.birth_year : null;
  const asc = [...sa].sort((a, b) => a.season_id - b.season_id); const rolle = letzte.role;
  const eine = (id) => sa.filter((x) => x.season_id === id);

  function kennzahlen() {
    const zeilen = eine(wahl); const s = zeilen.sort((a, b) => b.games - a.games)[0]; const g = s.role === 'G';
    return `<div class="saisonwahl chips scroll" role="tablist" aria-label="Saison wählen">${[...new Set(sa.map((x) => x.season_id))].map((id) => `<button class="chip ${id === wahl ? 'an' : ''}" role="tab" aria-selected="${id === wahl}" data-act="saison" data-id="${id}">${esc(sa.find((x) => x.season_id === id).season)}</button>`).join('')}</div>
    <p class="muted klein">${esc(s.team || '–')} · ${esc(s.league || '')}${zeilen.length > 1 ? ` · (+${zeilen.length - 1} weitere Einträge in dieser Saison, siehe Tabelle)` : ''}</p>
    ${s.games < 5 ? `<p class="hinweis warn">${icon('warn')} Nur ${s.games} Spiel(e) in dieser Saison: die Zahlen sind mit Vorsicht zu lesen.</p>` : ''}
    <div class="kachelgrid">${g
      ? kachel('Spiele', zahl(s.games)) + kachel('Paraden', zahl(s.saves), `von ${zahl(s.shots_gk)}`) + kachel('Paradenquote', prozent(s.save_pct, 1)) + kachel('Paraden/Spiel', zahl(s.saves_pg, 1)) + kachel('7m gehalten', `${zahl(s.saves7)}`, `von ${zahl(s.shots7_gk)}`) + kachel('Score', s.score == null ? '–' : vorz(s.score, 1), '', 'Vergleich mit der Liga, 0 = Durchschnitt')
      : kachel('Spiele', zahl(s.games)) + kachel('Tore', zahl(s.goals), `bei ${zahl(s.shots)} Würfen`) + kachel('Tore/Spiel', zahl(s.goals_pg, 2)) + kachel('Quote', prozent(s.goal_pct, 0)) + kachel('7m', `${zahl(s.goals7)}`, `von ${zahl(s.shots7)}`) + kachel('Techn. Fehler', zahl(s.tf), `${zahl(s.tf_pg, 2)} pro Spiel`) + kachel('2-Min-Strafen', zahl(s.min2), `${zahl(s.min2_pg, 2)} pro Spiel`) + kachel('Verw. / Disq.', `${zahl(s.warnings)} / ${zahl(s.disq)}`) + kachel('Score', s.score == null ? '–' : vorz(s.score, 1), '', 'Vergleich mit der Liga, 0 = Durchschnitt')}</div>`;
  }

  function staerken() {
    const st = d.staerken; if (!st) return '';
    if (!st.qual) return `<section class="box"><h2>Stärken und Schwächen</h2><p class="muted">Noch nicht aussagekräftig: Für den fairen Liga-Vergleich braucht es mindestens 3 Spiele und ${rolle === 'G' ? '30 Gegenwürfe' : '15 Würfe'}.</p></section>`;
    const F = [['Tore pro Spiel', st.pr_tore], ['Wurfquote', st.pr_quote], ['Würfe pro Spiel', st.pr_wuerfe], ['Wenig Fehler', st.pr_fehler], ['Fairness', st.pr_strafen]];
    const G = [['Paradenquote', st.pr_paraden], ['Paraden pro Spiel', st.pr_paraden_pg]];
    const achsen = (rolle === 'G' ? G : F).map(([t, p]) => [t, prozentRang(p)]);
    const starke = achsen.filter(([, p]) => p >= 75).map(([t]) => t), schwache = achsen.filter(([, p]) => p != null && p <= 25).map(([t]) => t);
    const bars = `<div class="rang">${achsen.map(([t, p]) => `<div class="rg"><span>${esc(t)}</span><span class="rb"><i style="width:${p ?? 0}%"></i></span><b>${p == null ? '–' : p}</b></div>`).join('')}</div>`;
    return `<section class="box"><h2>Stärken und Schwächen</h2><p class="muted klein">Rang unter ${zahl(st.vergleichsspieler)} Spielern der Liga «${esc(st.league)}» (100 = bester Wert, 50 = Mitte).</p>
      <div class="zwei">${rolle === 'G' ? bars : radar({ achsen: achsen.map((a) => a[0]), serien: [{ name: sp.name, werte: achsen.map((a) => a[1]) }], titel: 'Radar: Stärken im Liga-Vergleich' })}<div>${rolle === 'G' ? '' : bars}
      <p><b>Stärken:</b> ${starke.length ? esc(starke.join(', ')) : '<span class="muted">keine ausgeprägte</span>'}</p><p><b>Schwächen:</b> ${schwache.length ? esc(schwache.join(', ')) : '<span class="muted">keine ausgeprägte</span>'}</p></div></div></section>`;
  }

  function entwicklung() {
    const rs = asc.filter((x) => x.role === rolle); const xs = rs.map((x) => x.season);
    if (rs.length < 2) return `<section class="box"><h2>Entwicklung</h2><p class="muted">Erst eine Saison vorhanden: eine Entwicklung ist ab der zweiten Saison sichtbar.</p></section>`;
    const l = rs[rs.length - 1], v = rs[rs.length - 2];
    const diff = rolle === 'G' ? l.save_pct != null && v.save_pct != null ? `Paradenquote ${vorz(l.save_pct - v.save_pct, 1)} Prozentpunkte gegenüber ${esc(v.season)}` : '' : l.goals_pg != null && v.goals_pg != null ? `Tore pro Spiel ${vorz(l.goals_pg - v.goals_pg, 2)} gegenüber ${esc(v.season)}` : '';
    const serien = rolle === 'G' ? [{ name: 'Paradenquote %', werte: rs.map((x) => ({ y: x.save_pct })) }] : [{ name: 'Tore pro Spiel', werte: rs.map((x) => ({ y: x.goals_pg })) }];
    return `<section class="box"><h2>Entwicklung</h2>${diff ? `<p>${diff}.</p>` : ''}${linien({ serien, xs, dez: rolle === 'G' ? 0 : 1, titel: 'Entwicklung über die Saisons' })}${rolle === 'F' ? linien({ serien: [{ name: 'Wurfquote %', werte: rs.map((x) => ({ y: x.goal_pct })) }], xs, dez: 0, titel: 'Wurfquote über die Saisons' }) : ''}
      ${rs.some((x) => x.score != null) ? linien({ serien: [{ name: 'Score', werte: rs.map((x) => ({ y: x.score })) }], xs, dez: 1, titel: 'Score über die Saisons' }) : ''}</section>`;
  }

  function spielTabelle() {
    if (!gm.length) return '';
    const letztere = gm.slice(0, 10).reverse(); const g = rolle === 'G';
    const werte = letztere.map((x) => (g ? x.saves : x.goals)), labels = letztere.map((x) => `${datum(x.game_date)} gegen ${x.gegner}`);
    return `<section class="box"><h2>Letzte Spiele</h2><p class="muted klein">${g ? 'Paraden' : 'Tore'} in den letzten ${letztere.length} Spielen</p>${balken({ werte, labels, titel: 'Letzte Spiele' })}
      <div class="tabelle-wrap"><table class="liste klein"><thead><tr><th class="l">Datum</th><th class="l">Gegner</th><th class="r">Resultat</th>${g ? '<th class="r">Paraden</th><th class="r">Quote</th>' : '<th class="r">Tore</th><th class="r">Würfe</th><th class="r">TF</th><th class="r">2′</th>'}</tr></thead><tbody>${gm.slice(0, 15).map((x) => `<tr><td class="l">${datum(x.game_date)}</td><td class="l">${x.heim ? '' : '@ '}${esc(x.gegner || '')}</td><td class="r">${zahl(x.eigen)}:${zahl(x.fremd)}</td>${x.role === 'G' ? `<td class="r">${x.saves}</td><td class="r">${x.shots_gk ? zahl((x.saves * 100) / x.shots_gk, 0) + ' %' : '–'}</td>` : `<td class="r">${x.goals}</td><td class="r">${x.shots}</td><td class="r">${x.tf}</td><td class="r">${x.min2}</td>`}</tr>`).join('')}</tbody></table></div></section>`;
  }

  const seasonTable = () => {
    const g = rolle === 'G';
    return `<section class="box"><h2>Saison für Saison</h2><div class="tabelle-wrap"><table class="liste klein"><thead><tr><th class="l">Saison</th><th class="l">Team</th><th class="l">Liga</th><th class="r">Sp</th>${g ? '<th class="r">Paraden</th><th class="r">Gegenwürfe</th><th class="r">Quote</th><th class="r">7m</th>' : '<th class="r">Tore</th><th class="r">Würfe</th><th class="r">Quote</th><th class="r">7m</th><th class="r">TF</th><th class="r">2′</th><th class="r">Verw.</th><th class="r">Disq.</th>'}<th class="r">Score</th></tr></thead><tbody>${sa.map((x) => `<tr><td class="l">${esc(x.season)}</td><td class="l">${esc(x.team || '–')}</td><td class="l">${esc(x.league || '')}</td><td class="r">${x.games}</td>${x.role !== rolle ? `<td class="r" colspan="${g ? 4 : 8}">als ${x.role === 'G' ? 'Torhüter' : 'Feldspieler'}: ${x.role === 'G' ? `${x.saves}/${x.shots_gk} Paraden` : `${x.goals} Tore`}</td>` : g ? `<td class="r">${x.saves}</td><td class="r">${x.shots_gk}</td><td class="r">${prozent(x.save_pct, 1)}</td><td class="r">${x.saves7}/${x.shots7_gk}</td>` : `<td class="r">${x.goals}</td><td class="r">${x.shots}</td><td class="r">${prozent(x.goal_pct)}</td><td class="r">${x.goals7}/${x.shots7}</td><td class="r">${x.tf}</td><td class="r">${x.min2}</td><td class="r">${x.warnings}</td><td class="r">${x.disq}</td>`}<td class="r">${x.score == null ? '–' : vorz(x.score, 1)}</td></tr>`).join('')}</tbody></table></div></section>`;
  };

  const aehnlich = (d.aehnlich || []).length ? `<section class="box"><h2>Ähnliche Spieler</h2><p class="muted klein">Gleiche Saison und Liga-Gruppe, ähnliche Zahlen und ähnliches Alter.</p><div class="teamliste">${d.aehnlich.map((x) => `<a class="team-k" href="#/spieler/${x.player_id}"><div><b>${esc(x.name)}</b><span class="psub">Jg. ${esc(x.birth_year ?? '–')} · ${esc(x.team || '–')} · ${esc(x.league || '')}</span></div><div class="bil"><b>${x.aehnlichkeit} %</b><span>ähnlich</span></div></a>`).join('')}</div></section>` : '';

  function watchBox() {
    const sn = w?.stars ?? 0;
    return `<section class="box" id="watch"><h2>${sternIcon(!!w)} Watchlist${w ? ' <span class="tag gut">drauf</span>' : ''}</h2><form id="wf" class="stack">
      <div class="grid"><label class="fld"><span>Status</span><select name="status">${STATUS.map(([v, t]) => `<option value="${v}" ${v === (w?.status || 'beobachten') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="fld"><span>Erinnerung am</span><input type="date" name="erinnerung" value="${esc(w?.erinnerung || '')}"></label></div>
      <div class="fld"><span>Einschätzung (Sterne)</span><div class="sterne" id="pst" data-n="${sn}">${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="stern ${i <= sn ? 'an' : ''}" data-act="pstern" data-n="${i}" aria-label="${i} Sterne">${sternIcon(i <= sn)}</button>`).join('')}</div></div>
      <label class="fld"><span>Notizen</span><textarea name="notiz" rows="4" placeholder="Eindruck, Gespräche, nächste Schritte …">${esc(w?.notiz || '')}</textarea></label>
      <div class="fbtn"><button type="button" class="btn" data-act="wlsave">Speichern</button>${w ? '<button type="button" class="btn secondary warn" data-act="wldel">Von Watchlist entfernen</button>' : ''}</div>
      ${w ? `<p class="muted klein">Zuletzt geändert von ${esc(w.geaendert_von || '–')} am ${datum(w.geaendert_am)}</p>` : ''}</form></section>`;
  }
  function akteBox() {
    const a = ak || {}; const offen = !!ak || (letzte.age_class);
    return `<section class="box" id="akte"><h2>Spieler-Akte <span class="muted klein">Talent Card · Schule/Lehre · Training · Ziele</span></h2>${offen ? '' : '<p class="muted klein">Für Nachwuchs- und Stäfa-Spieler. Ausfüllen, wenn der Spieler für euch relevant wird.</p>'}
      <form id="af" class="stack"><label class="fld"><span>Talent Card</span><textarea name="talent_card" rows="3" placeholder="Stärken, Entwicklungsfelder, Einschätzung …">${esc(a.talent_card || '')}</textarea></label>
      <div class="grid"><label class="fld"><span>Schule / Lehre</span><input name="schule_lehre" value="${esc(a.schule_lehre || '')}" placeholder="z. B. Kanti Wattwil, 2. Lehrjahr"></label><label class="fld"><span>Trainingstage</span><input name="trainingstage" value="${esc(a.trainingstage || '')}" placeholder="z. B. Mo, Mi, Fr"></label></div>
      <label class="fld"><span>Ziele</span><textarea name="ziele" rows="2" placeholder="Kurzfristig und langfristig">${esc(a.ziele || '')}</textarea></label><label class="fld"><span>Weitere Notizen</span><textarea name="notizen" rows="3">${esc(a.notizen || '')}</textarea></label>
      <p class="muted klein">${icon('warn')} Daten von Minderjährigen: nur sachliche Angaben, die du wirklich brauchst. Nichts weitergeben.</p>
      <div class="fbtn"><button type="button" class="btn" data-act="aktesave">Akte speichern</button><button type="button" class="btn secondary" data-act="akteLog">Änderungsprotokoll</button></div><div id="aklog"></div></form></section>`;
  }

  const sub = [sp.birth_year ? `Jg. ${sp.birth_year}${alter != null ? ` (${alter} J.)` : ''}` : null, sp.position || (rolle === 'G' ? 'Torhüter' : null), sp.hand ? (sp.hand === 'R' ? 'rechtshändig' : sp.hand === 'L' ? 'linkshändig' : sp.hand) : null].filter(Boolean).join(' · ');
  const zeichne = () => {
    ctx.root.innerHTML = `<div class="seitenkopf"><a class="zurueck" href="#/suche" data-act="zurueck">${icon('zurueck')} Zurück</a><div class="aktionsleiste"><button class="btn secondary klein" data-act="cmp2">${icon('vergleich')} ${imVergleich(pid) ? 'Im Vergleich' : 'Vergleichen'}</button><button class="btn secondary klein" data-act="druck">PDF / Druck</button></div></div>
      <header class="phead"><div><h1>${esc(sp.name || 'Unbekannt')}</h1><p class="psub gross">${esc(sub)}</p><p class="psub gross">${esc(letzte.team || '–')} · ${esc(letzte.league || '')}${letzte.canton ? ' · ' + esc(letzte.canton) : ''}${dist != null ? ` · ${zahl(dist, 0)} km von ${esc(zentrum.name || 'Stäfa')}` : ''}</p>${mfLabel(letzte.gender) ? `<span class="tag">${mfLabel(letzte.gender)}</span>` : ''}${letzte.age_class ? `<span class="tag">${esc(letzte.age_class)}</span>` : ''}${labelFuer({ ...letzte, birth_year: sp.birth_year }, true)}${w ? `<span class="tag gut">Watchlist: ${esc(STATUS.find((x) => x[0] === w.status)?.[1] || '')}</span>` : ''}${letzte.jahr_vorsprung >= 1 ? `<span class="tag gut" title="Jünger als der Liga-Median (${esc(letzte.liga_median_jahr)})">${zahl(letzte.jahr_vorsprung, 1)} Jahre jünger als Liga-Schnitt</span>` : ''}</div><div class="pscore">${scoreBadge(letzte)}</div></header>
      ${status.offline ? '<p class="hinweis warn">Offline-Stand: Du siehst die zuletzt geladenen Daten.</p>' : ''}
      <section class="box" id="kz">${kennzahlen()}</section>${staerken()}${entwicklung()}<section class="box"><h2>Karriereweg</h2>${karriere(sa)}</section>${seasonTable()}${spielTabelle()}${aehnlich}${watchBox()}${akteBox()}
      <p class="muted klein">Quelle: handball.ch (Matchcenter). Nicht erfasste Werte bleiben leer, nichts wird geschätzt. Die Position ist nur in einigen Ligen vorhanden.</p>`;
  };
  zeichne();

  const formWerte = (id) => Object.fromEntries(new FormData(ctx.root.querySelector(id)).entries());
  ctx.on = {
    saison(el) { wahl = Number(el.dataset.id); ctx.root.querySelector('#kz').innerHTML = kennzahlen(); },
    cmp2() { const ok = vergleichUmschalten(pid, sp.name); if (!ok) toast('Maximal 4 Spieler im Vergleich', 'fehler'); vergleichsLeiste(); zeichne(); },
    druck() { window.print(); },
    pstern(el) { const n = Number(el.dataset.n); const box = ctx.root.querySelector('#pst'); const neu = Number(box.dataset.n) === n ? 0 : n; box.dataset.n = neu; box.querySelectorAll('.stern').forEach((b, i) => { b.classList.toggle('an', i < neu); b.innerHTML = sternIcon(i < neu); }); },
    async wlsave() { const v = formWerte('#wf'); try { await rpc('wl_setzen', { pid, daten: { status: v.status, stars: Number(ctx.root.querySelector('#pst').dataset.n), notiz: v.notiz, erinnerung: v.erinnerung || '' } }); toast('Watchlist gespeichert', 'ok'); render(ctx); } catch (e) { toast(e.message, 'fehler'); } },
    async wldel() { try { await rpc('wl_loeschen', { pid }); toast('Von Watchlist entfernt'); render(ctx); } catch (e) { toast(e.message, 'fehler'); } },
    async aktesave() { try { await rpc('akte_speichern', { pid, daten: formWerte('#af') }); toast('Akte gespeichert', 'ok'); } catch (e) { toast(e.message, 'fehler'); } },
    async akteLog() { try { const l = await rpc('akte_log', { pid }); ctx.root.querySelector('#aklog').innerHTML = l.length ? `<ul class="log">${l.map((x) => `<li><b>${esc(x.wer || '–')}</b> · ${datum(x.zeit, true)}<span class="psub">${esc(Object.keys(x.aenderungen || {}).map((k) => ({ talent_card: 'Talent Card', schule_lehre: 'Schule/Lehre', trainingstage: 'Trainingstage', ziele: 'Ziele', notizen: 'Notizen' }[k] || k)).join(', '))}</span></li>`).join('')}</ul>` : '<p class="muted klein">Noch keine Änderungen.</p>'; } catch (e) { toast(e.message, 'fehler'); } },
    neu() { render(ctx); },
  };
}
