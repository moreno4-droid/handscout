// Watchlist: Spieler mit Status, Sternen, Notizen und Erinnerungen.
import { esc, zahl, prozent, datum, toast, exportCsv, exportXlsx } from '../util.js';
import { rpc } from '../api.js';
import { icon, laden, fehlerBox, leer, scoreBadge, sterne, sternIcon } from '../ui.js';

const STATUS = [['alle', 'Alle'], ['beobachten', 'Beobachten'], ['kontaktieren', 'Kontaktieren'], ['abgesagt', 'Abgesagt']];
const SP = [['Name', (r) => r.name], ['Jahrgang', (r) => r.birth_year], ['Team', (r) => r.team], ['Liga', (r) => r.league], ['Status', (r) => r.status], ['Sterne', (r) => r.stars], ['Erinnerung', (r) => r.erinnerung], ['Notiz', (r) => r.notiz]].map(([titel, wert]) => ({ titel, wert }));

export async function render(ctx) {
  let filter = ctx.params.get('s') || 'alle'; let liste = [];
  const heute = new Date().toISOString().slice(0, 10);
  const zeichne = () => {
    const anz = Object.fromEntries(STATUS.map(([k]) => [k, k === 'alle' ? liste.length : liste.filter((x) => x.status === k).length]));
    const faellig = liste.filter((x) => x.erinnerung && x.erinnerung <= heute && x.status !== 'abgesagt');
    const zeigen = liste.filter((x) => filter === 'alle' || x.status === filter);
    ctx.root.innerHTML = `<div class="seitenkopf"><h1>Watchlist</h1><div class="aktionsleiste"><button class="btn secondary klein" data-act="csv">${icon('runter')} CSV</button><button class="btn secondary klein" data-act="xlsx">Excel</button><button class="btn secondary klein" data-act="druck">PDF / Druck</button></div></div>
    ${faellig.length ? `<p class="hinweis warn">${icon('kalender')} ${faellig.length} Erinnerung(en) fällig: ${faellig.slice(0, 4).map((x) => `<a href="#/spieler/${x.player_id}">${esc(x.name)}</a>`).join(', ')}${faellig.length > 4 ? ' …' : ''}</p>` : ''}
    <div class="chips scroll" role="tablist">${STATUS.map(([k, t]) => `<button class="chip ${k === filter ? 'an' : ''}" role="tab" aria-selected="${k === filter}" data-act="filter" data-k="${k}">${t} <span class="n">${anz[k]}</span></button>`).join('')}</div>
    ${zeigen.length ? `<div class="wl-liste">${zeigen.map((x) => `<article class="karte wl-k" data-id="${x.player_id}"><div class="k1"><div class="kname"><a class="pname" href="#/spieler/${x.player_id}">${esc(x.name || 'Unbekannt')}</a><span class="psub">${[x.birth_year ? 'Jg. ' + x.birth_year : '', x.position, x.team, x.league].filter(Boolean).map(esc).join(' · ')}</span></div>${x.score != null ? scoreBadge(x) : ''}</div>
      <div class="wl-m">${sterne(x.stars, x.player_id)}<select class="statussel" data-id="${x.player_id}" aria-label="Status">${STATUS.slice(1).map(([k, t]) => `<option value="${k}" ${k === x.status ? 'selected' : ''}>${t}</option>`).join('')}</select>${x.erinnerung ? `<span class="tag ${x.erinnerung <= heute ? 'schwach' : ''}">${icon('kalender')} ${datum(x.erinnerung)}</span>` : ''}</div>
      ${x.l_games != null || x.games != null ? `<div class="psub">${x.role === 'G' ? `${zahl(x.games)} Sp · Paradenquote ${prozent(x.save_pct, 1)}` : `${zahl(x.games)} Sp · ${zahl(x.goals_pg, 2)} Tore/Sp · Quote ${prozent(x.goal_pct)}`} (${esc(x.season || '')})</div>` : ''}
      ${x.notiz ? `<p class="notiz">${esc(x.notiz).replace(/\n/g, '<br>')}</p>` : ''}<p class="muted klein">Zuletzt: ${esc(x.geaendert_von || '–')}, ${datum(x.geaendert_am)}</p></article>`).join('')}</div>` : leer('Noch niemand auf der Watchlist', 'In der Suche oder im Profil auf den Stern tippen, um Spieler zu merken.', '<a class="btn" href="#/suche">Spieler suchen</a>')}`;
  };
  const lade = async () => { ctx.root.innerHTML = `<div class="seitenkopf"><h1>Watchlist</h1></div>${laden(4)}`; try { liste = await rpc('wl_liste'); zeichne(); } catch (e) { ctx.root.innerHTML = fehlerBox(e.message); } };
  ctx.root.addEventListener('change', async (e) => { const s = e.target.closest('.statussel'); if (!s) return; try { await rpc('wl_setzen', { pid: Number(s.dataset.id), daten: { status: s.value } }); const x = liste.find((y) => y.player_id === Number(s.dataset.id)); if (x) x.status = s.value; toast('Status gespeichert', 'ok'); zeichne(); } catch (er) { toast(er.message, 'fehler'); } });
  ctx.on = {
    filter(el) { filter = el.dataset.k; zeichne(); },
    async stern(el) { const id = Number(el.dataset.id), n = Number(el.dataset.n); try { await rpc('wl_setzen', { pid: id, daten: { stars: n } }); const x = liste.find((y) => y.player_id === id); if (x) x.stars = n; zeichne(); } catch (er) { toast(er.message, 'fehler'); } },
    csv() { exportCsv('handscout-watchlist', SP, liste); }, async xlsx() { try { await exportXlsx('handscout-watchlist', SP, liste); } catch (e) { toast('Excel nicht möglich. CSV funktioniert immer.', 'fehler'); } }, druck() { window.print(); }, neu: lade,
  };
  await lade();
}
