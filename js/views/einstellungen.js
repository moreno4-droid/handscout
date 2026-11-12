// Einstellungen, Daten-Status, Backup, Über HandScout und Impressum.
import { esc, zahl, datum, toast, lsSet } from '../util.js';
import { rpc, logout, cacheLeeren, meineEmail } from '../api.js';
import { S, setzeTheme, speichereEinst, filterLoeschen } from '../state.js';
import { VERSION, HERSTELLER, NAME } from '../version.js';
import { icon } from '../ui.js';

const ROLLE = { admin: 'Administrator', trainer: 'Trainer (lesen und Notizen)', viewer: 'Nur lesen' };
let installEvent = null; window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

export async function render(ctx) {
  const o = S.opt, st = o.status; const z = S.einst.zentrum || window.HANDSCOUT?.STAFA || {};
  const t = S.einst.theme;
  ctx.root.innerHTML = `<div class="seitenkopf"><h1>Einstellungen</h1></div>
  <section class="box"><h2>Konto</h2><p><b>${esc(o.name || '')}</b><br><span class="muted">${esc(o.email || meineEmail())} · ${esc(ROLLE[o.rolle] || o.rolle)}</span></p><p class="muted klein">Nur Personen auf der Zugangsliste der Datenbank kommen in die App. Alle anderen sehen nichts.</p><button class="btn secondary" data-act="abmelden">Abmelden</button></section>
  <section class="box"><h2>Darstellung</h2><div class="seg" role="radiogroup" aria-label="Design">${[['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, n]) => `<label><input type="radio" name="theme" value="${v}" ${t === v ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
  ${standalone ? '' : `<h3 class="gruppe">App installieren</h3>${ios ? '<p class="muted">iPhone/iPad: unten auf «Teilen» tippen, dann «Zum Home-Bildschirm».</p>' : '<button class="btn" data-act="install">Auf dem Handy installieren</button><p class="muted klein">Falls nichts passiert: Im Browser-Menü «App installieren» oder «Zum Startbildschirm» wählen.</p>'}`}</section>
  <section class="box"><h2>Umkreis-Mittelpunkt</h2><p class="muted klein">Für «Umkreis in km» in der Suche. Voreinstellung: Handball Stäfa.</p><form id="zf" class="stack"><div class="grid"><label class="fld"><span>Name</span><input name="name" value="${esc(z.name || '')}"></label><label class="fld"><span>Breitengrad</span><input name="lat" inputmode="decimal" value="${esc(z.lat ?? '')}"></label><label class="fld"><span>Längengrad</span><input name="lon" inputmode="decimal" value="${esc(z.lon ?? '')}"></label></div><div class="fbtn"><button type="button" class="btn" data-act="zsave">Speichern</button><button type="button" class="btn secondary" data-act="zreset">Auf Stäfa zurück</button></div></form></section>
  <section class="box"><h2>Gespeicherte Filter</h2>${S.filter.length ? `<ul class="log">${S.filter.map((f) => `<li><a href="#/suche?f=${encodeURIComponent('')}" data-act="fopen" data-n="${esc(f.name)}">${esc(f.name)}</a> <button class="link warn" data-act="fdel" data-n="${esc(f.name)}">löschen</button></li>`).join('')}</ul>` : '<p class="muted">Noch keine. In der Suche auf «Filter speichern» tippen.</p>'}</section>
  <section class="box"><h2>Daten von handball.ch</h2>${st ? `<dl class="dl"><dt>Letzter Import</dt><dd>${st.last_run ? datum(st.last_run, true) : '–'}</dd><dt>Status</dt><dd>${esc(st.state || '–')}</dd><dt>Spiele in der Datenbank</dt><dd>${zahl(st.games_total)}</dd><dt>Saisons</dt><dd>${o.saisons.map((s) => esc(s.name)).join(', ') || '–'}</dd><dt>Hinweis</dt><dd>${esc(st.note || '–')}</dd></dl>` : '<p class="muted">Es wurde noch kein Import durchgeführt.</p>'}
  <p class="muted klein">Der Import läuft jeden Tag automatisch auf GitHub. Positionen liefert handball.ch nur in einigen Ligen (z. B. NLA/NLB), sonst bleibt das Feld leer. Nichts wird geschätzt.</p><button class="btn secondary" data-act="cache">Zwischenspeicher dieser App leeren</button></section>
  <section class="box"><h2>Backup</h2><p class="muted klein">Deine eigenen Eingaben (Watchlist, Akten) liegen in der Datenbank. Hier kannst du eine Sicherungskopie als Datei laden. Zusätzlich macht Supabase eigene Sicherungen (je nach Plan).</p><button class="btn secondary" data-act="backup">${icon('runter')} Watchlist und Akten sichern (JSON)</button></section>
  <section class="box" id="ueber"><h2>Über ${NAME}</h2><dl class="dl"><dt>Version</dt><dd>${VERSION}</dd><dt>Hersteller</dt><dd>${HERSTELLER}</dd><dt>Datenquelle</dt><dd>Swiss Handball Matchcenter (handball.ch)</dd></dl>
  <p class="muted klein">${NAME} ist ein privates Scouting-Werkzeug von ${HERSTELLER} und steht in keiner Verbindung zu Swiss Handball. Die Statistiken stammen aus den öffentlichen Spielberichten. Alle Angaben ohne Gewähr; fehlende Werte bleiben leer.</p></section>
  <section class="box"><h2>Datenschutz und Impressum</h2><p class="muted klein"><b>Impressum:</b> ${NAME} ${VERSION}, privates Werkzeug. Hersteller: ${HERSTELLER}.</p><p class="muted klein"><b>Zugriff:</b> Nur angemeldete Konten auf der Zugangsliste. Es gibt keine Werbung und keine Tracker. Gespeichert werden Spielstatistiken aus öffentlichen Spielberichten sowie deine Notizen.</p><p class="muted klein"><b>Minderjährige:</b> Für Nachwuchsspieler (U13–U19) nur sachliche, notwendige Angaben erfassen und nichts weitergeben (Schweizer Datenschutzgesetz DSG). Auf Wunsch der Betroffenen oder Eltern Einträge löschen.</p></section>`;
  ctx.root.addEventListener('change', (e) => { if (e.target.name === 'theme') { setzeTheme(e.target.value); toast('Design geändert'); } });
  ctx.on = {
    abmelden() { logout(); cacheLeeren(); location.hash = '#/'; location.reload(); },
    async install() { if (!installEvent) return toast('Dein Browser bietet die Installation gerade nicht an. Siehe Browser-Menü.'); installEvent.prompt(); installEvent = null; },
    zsave() { const d = Object.fromEntries(new FormData(ctx.root.querySelector('#zf')).entries()); const lat = Number(String(d.lat).replace(',', '.')), lon = Number(String(d.lon).replace(',', '.')); if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return toast('Bitte gültige Koordinaten eingeben (z. B. 47.2406 und 8.7283)', 'fehler'); S.einst.zentrum = { name: d.name || 'Mein Ort', lat, lon }; speichereEinst(); toast('Mittelpunkt gespeichert', 'ok'); },
    zreset() { delete S.einst.zentrum; speichereEinst(); toast('Zurück auf Stäfa'); render(ctx); },
    fopen(el, ev) { ev.preventDefault(); const f = S.filter.find((x) => x.name === el.dataset.n); if (f) import('../util.js').then(({ kodiere }) => { location.hash = '#/suche?f=' + kodiere(f.f); }); },
    fdel(el) { filterLoeschen(el.dataset.n); render(ctx); },
    cache() { cacheLeeren(); toast('Zwischenspeicher geleert', 'ok'); },
    async backup() {
      try {
        const wl = await rpc('wl_liste'); const ak = []; const sid = o.saisons[0]?.id; if (sid) { const u = await rpc('stafa_uebersicht', { sid }); u.rows.filter((x) => x.hat_akte).forEach((x) => ak.push({ player_id: x.player_id, name: x.name, talent_card: x.talent_card, schule_lehre: x.schule_lehre, trainingstage: x.trainingstage, ziele: x.ziele, notizen: x.notizen })); }
        const blob = new Blob([JSON.stringify({ app: NAME + ' ' + VERSION, hersteller: HERSTELLER, erstellt: new Date().toISOString(), watchlist: wl, akten_stafa: ak }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'handscout-backup-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('Backup gespeichert', 'ok');
      } catch (e) { toast(e.message, 'fehler'); }
    },
  };
}
