// HandScout V1 – Start, Anmeldung, Navigation. Hersteller: Moreno Rossi.
import { esc, $, $$, toast } from './util.js';
import { rpc, login, passwortVergessen, logout, konfigOk, eingeloggt, status, ApiFehler } from './api.js';
import { S, setzeTheme, vergleichUmschalten, imVergleich } from './state.js';
import { icon, sternIcon, vergleichsLeiste, fehlerBox } from './ui.js';
import { VERSION, HERSTELLER, NAME } from './version.js';

const app = document.getElementById('app');
const ANSICHTEN = { suche: 'suche', rankings: 'rankings', spieler: 'profil', team: 'team', vergleich: 'vergleich', watchlist: 'watchlist', stafa: 'stafa', einstellungen: 'einstellungen' };
const NAV = [['suche', 'Suche', 'suche'], ['rankings', 'Rankings', 'rank'], ['watchlist', 'Watchlist', 'stern'], ['stafa', 'Stäfa', 'stafa'], ['einstellungen', 'Einstellungen', 'zahnrad']];
const AKTIV = { spieler: 'suche', team: 'suche', vergleich: 'suche', info: 'einstellungen' };
let ctx = { on: {} };

const fuss = `<p class="fuss">${NAME} ${VERSION} · Hersteller: ${HERSTELLER} · Daten: <a href="https://www.handball.ch" target="_blank" rel="noopener noreferrer">handball.ch</a></p>`;
const brand = `<img src="icons/icon-192.png" alt="" width="36" height="36"><span class="bname">${NAME}</span><span class="ver">${VERSION}</span>`;

function einfach(inner) { app.innerHTML = `<main class="gast"><div class="gastbox"><div class="brand gross">${brand}</div>${inner}${fuss}</div></main>`; }

function loginAnsicht(meldung = '') {
  einfach(`<h1>Anmelden</h1><p class="muted">Persönlicher Zugang. Nur freigegebene Konten kommen herein.</p>
  <form id="lf" class="stack"><label class="fld"><span>E-Mail</span><input name="email" type="email" autocomplete="username" required autofocus></label>
  <label class="fld"><span>Passwort</span><input name="pw" type="password" autocomplete="current-password" required></label>
  <p id="lmeld" class="fehlertext" role="alert">${esc(meldung)}</p><button class="btn gross" type="submit">Anmelden</button><button class="link" type="button" id="vergessen">Passwort vergessen?</button></form>`);
  const f = $('#lf'), m = $('#lmeld');
  f.addEventListener('submit', async (e) => { e.preventDefault(); const d = new FormData(f); m.textContent = ''; const b = f.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Anmelden …';
    try { await login(d.get('email'), d.get('pw')); await start(); } catch (er) { m.textContent = er.art === 'login' ? 'E-Mail oder Passwort stimmt nicht.' : er.message; b.disabled = false; b.textContent = 'Anmelden'; } });
  $('#vergessen').addEventListener('click', async () => { const mail = f.elements.email.value; if (!mail) { m.textContent = 'Bitte zuerst oben die E-Mail eintragen.'; return; } try { await passwortVergessen(mail); m.textContent = ''; toast('Falls das Konto existiert, wurde eine E-Mail zum Zurücksetzen verschickt.', 'ok'); } catch (er) { m.textContent = er.message; } });
}
const konfigAnsicht = () => einfach(`<h1>Fast geschafft</h1><p>Die App ist noch nicht mit deiner Datenbank verbunden.</p><p class="muted">Öffne die Datei <b>config.js</b> und trage dort die zwei Werte aus Supabase ein (Project URL und anon public key). Die Schritte stehen in der Anleitung, Teil «App verbinden».</p>`);
const keinZugriff = () => einfach(`<h1>Kein Zugriff</h1><p>Dieses Konto steht nicht auf der Zugangsliste.</p><p class="muted">Die Daten bleiben für alle anderen gesperrt. Wenn du das selbst bist: Prüfe in Supabase die Tabelle «zugang» (E-Mail genau gleich schreiben).</p><button class="btn" id="aus">Abmelden</button>`);

function huelle() {
  const nav = NAV.map(([k, t, i]) => `<a href="#/${k}" data-nav="${k}">${icon(i)}<span>${t}</span></a>`).join('');
  app.innerHTML = `<div class="app"><header class="top"><a class="brand" href="#/suche" aria-label="${NAME} Startseite">${brand}</a><nav class="topnav" aria-label="Hauptnavigation">${nav}</nav><span id="offl" class="offl-pill" hidden>Offline-Stand</span></header>
  <main id="view" tabindex="-1"></main><div id="cmpbar" class="cmpbar" hidden></div>${fuss}<nav class="bottomnav" aria-label="Hauptnavigation">${nav}</nav></div>`;
}
function markiereNav(name) { const k = AKTIV[name] || name; $$('[data-nav]').forEach((a) => { const an = a.dataset.nav === k; a.classList.toggle('an', an); if (an) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }

async function route() {
  if (!$('#view')) return;
  const raw = location.hash.replace(/^#\/?/, ''); const [pfad, qs = ''] = raw.split('?'); const segs = pfad.split('/').filter(Boolean);
  const name = segs[0] || 'suche';
  if (name === 'info') { location.replace('#/einstellungen'); return; }
  const datei = ANSICHTEN[name]; markiereNav(name);
  const holder = document.createElement('div'); holder.className = 'seite'; $('#view').replaceChildren(holder);
  ctx = { root: holder, params: new URLSearchParams(qs), arg: segs.slice(1).join('/'), name, on: {} };
  const mein = ctx;
  if (!datei) { holder.innerHTML = fehlerBox('Diese Seite gibt es nicht.', false) + '<p><a class="btn" href="#/suche">Zur Suche</a></p>'; return; }
  try { const m = await import(`./views/${datei}.js`); await m.render(mein); }
  catch (e) { console.error(e); if (e instanceof ApiFehler && (e.art === 'login')) return void (logout(), loginAnsicht('Bitte neu anmelden.')); if (e instanceof ApiFehler && e.art === 'zugang') return void (keinZugriff(), $('#aus')?.addEventListener('click', abmelden)); holder.innerHTML = fehlerBox(e.message || 'Unbekannter Fehler'); }
  finally { if (mein === ctx) { $('#offl').hidden = !status.offline; window.scrollTo(0, 0); } }
  vergleichsLeiste();
}
const abmelden = () => { logout(); location.hash = '#/'; location.reload(); };

// Klicks zentral: gemeinsame Aktionen hier, seitenspezifische in ctx.on
const GLOBAL = {
  zurueck(el, e) { e.preventDefault(); if (history.length > 1) history.back(); else location.hash = '#/suche'; },
  async wl(el) {
    const id = Number(el.dataset.id), an = el.classList.contains('an');
    try {
      if (an) await rpc('wl_loeschen', { pid: id }); else await rpc('wl_setzen', { pid: id, daten: { status: 'beobachten' } });
      $$(`[data-act="wl"][data-id="${id}"]`).forEach((b) => { b.classList.toggle('an', !an); b.setAttribute('aria-pressed', String(!an)); b.innerHTML = sternIcon(!an); });
      toast(an ? 'Von Watchlist entfernt' : 'Zur Watchlist hinzugefügt', an ? '' : 'ok');
    } catch (e) { toast(e.message, 'fehler'); }
  },
  cmp(el) {
    const id = Number(el.dataset.id); if (!vergleichUmschalten(id, el.dataset.name)) toast('Maximal 4 Spieler im Vergleich', 'fehler');
    $$(`.iconbtn[data-act="cmp"][data-id="${id}"]`).forEach((b) => { b.classList.toggle('an', imVergleich(id)); b.setAttribute('aria-pressed', String(imVergleich(id))); }); vergleichsLeiste();
  },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return; const act = el.dataset.act;
  if (GLOBAL[act]) return void GLOBAL[act](el, e);
  const f = ctx.on?.[act]; if (f) { if (el.tagName === 'A' && act !== 'fopen') e.preventDefault(); Promise.resolve(f(el, e)).catch((er) => toast(er.message || 'Fehler', 'fehler')); } else if (act === 'neu') route();
});

async function start() {
  if (!konfigOk()) return konfigAnsicht();
  if (!eingeloggt()) return loginAnsicht();
  try { S.opt = await rpc('optionen'); }
  catch (e) { if (e.art === 'zugang') { keinZugriff(); $('#aus')?.addEventListener('click', abmelden); return; } if (e.art === 'login') return loginAnsicht(); if (e.art === 'netz') { einfach(`<h1>Keine Verbindung</h1><p class="muted">Der Server ist gerade nicht erreichbar und es gibt noch keinen gespeicherten Stand.</p><button class="btn" id="neuladen">Nochmals versuchen</button>`); $('#neuladen').addEventListener('click', () => location.reload()); return; } einfach(fehlerBox(e.message, false)); return; }
  huelle(); await route();
}
window.addEventListener('hashchange', () => { if (S.opt && $('#view')) route(); });
setzeTheme(S.einst.theme);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (S.einst.theme === 'system') setzeTheme('system'); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Offline-Hülle weiter */ });
start();
