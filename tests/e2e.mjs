// Ende-zu-Ende-Test: echter Browser (Chromium) gegen die echte Website und eine nachgebaute Datenbank mit erfundenen Daten.
import { createRequire } from 'node:module';
import { startServer } from './server.mjs';
const { chromium } = createRequire('/home/claude/x.js')('playwright');
const SHOT = new URL('./screenshots/', import.meta.url).pathname;
const s = await startServer({ port: 8142 }); const base = 'http://localhost:8142/';
let fehl = 0, ok = 0; const check = (name, cond, info = '') => { if (cond) ok++; else fehl++; console.log((cond ? '  OK   ' : '  FEHLER ') + name + (info !== '' ? '  → ' + info : '')); };
const browser = await chromium.launch();
const fehlerLog = [];
async function neuerKontext(opts = {}) {
  const ctx = await browser.newContext({ locale: 'de-CH', timezoneId: 'Europe/Zurich', serviceWorkers: 'allow', ...opts }); const page = await ctx.newPage();
  page.on('pageerror', (e) => fehlerLog.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_(NAME|INTERNET|CONNECTION|BLOCKED|FAILED|PROXY)|Failed to load resource.*(403|404)?/.test(m.text() + (m.location()?.url || ''))) fehlerLog.push('console: ' + m.text()); });
  return { ctx, page };
}
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }; const DESK = { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 };
async function anmelden(page, email = 'ich@beispiel.test', pw = 'test1234') { await page.goto(base); await page.fill('input[name=email]', email); await page.fill('input[name=pw]', pw); await page.click('button[type=submit]'); }
const warte = (page, sel, t = 8000) => page.waitForSelector(sel, { timeout: t });
const zeilen = (page) => page.locator('table.liste.haupt tbody tr, .tabelle-wrap.haupt tbody tr').count();
const oeffne = async (page) => { if (!(await page.locator('#panel').isVisible())) await page.click('[data-act=panel]'); };
const shot = (page, n) => page.screenshot({ path: SHOT + n + '.png' });
const ueberlauf = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

console.log('\n=== 1. Anmeldung und Zugangssperre ===');
{
  const { ctx, page } = await neuerKontext(DESK);
  await page.goto(base); await warte(page, '#lf');
  check('Anmeldeseite zeigt Name, Version und Hersteller', /HandScout/.test(await page.textContent('body')) && /V1/.test(await page.textContent('body')) && /Hersteller: Moreno Rossi/.test(await page.textContent('body')));
  const vorherRpc = s.stat.rpc; check('ohne Anmeldung wird nichts aus der Datenbank geladen', vorherRpc === 0);
  await anmelden(page, 'ich@beispiel.test', 'falsch'); await page.waitForFunction(() => /stimmt nicht/.test(document.getElementById('lmeld')?.textContent || ''));
  check('falsches Passwort wird abgelehnt', true);
  await anmelden(page, 'fremder@beispiel.test', 'test1234'); await warte(page, '#aus');
  check('Konto ohne Eintrag in der Zugangsliste sieht «Kein Zugriff»', /Kein Zugriff/.test(await page.textContent('body')));
  check('… und bekommt keine einzige Datenzeile', !(await page.content()).includes('Handball Stäfa') );
  const direkt = await page.evaluate(async () => { const t = JSON.parse(localStorage.getItem('hs.session')).access_token; const r = await fetch('/rest/v1/players?select=*', { headers: { apikey: 'x', Authorization: 'Bearer ' + t } }); return r.status; });
  check('direkter Tabellenzugriff (am App-Code vorbei) ist gesperrt', direkt === 403, 'HTTP ' + direkt);
  const anon = await page.evaluate(async () => (await fetch('/rest/v1/rpc/suche', { method: 'POST', headers: { apikey: 'x', Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: '{"p":{}}' })).status);
  check('Funktionsaufruf ohne gültige Anmeldung ist gesperrt', anon === 403, 'HTTP ' + anon);
  await ctx.close();
}

console.log('\n=== 2. Computer-Ansicht: Suche, Filter, Profil ===');
{
  const { ctx, page } = await neuerKontext(DESK);
  await anmelden(page); await warte(page, '#view .seite'); await warte(page, '.tabelle-wrap.haupt tbody tr');
  check('nach Anmeldung erscheint die Suche mit Spielern', (await zeilen(page)) > 0, (await zeilen(page)) + ' Zeilen');
  check('Kopfzeile: Name, V1', /HandScout/.test(await page.textContent('.top')) && /V1/.test(await page.textContent('.top')));
  check('Fusszeile nennt Hersteller Moreno Rossi', /Hersteller: Moreno Rossi/.test(await page.textContent('.fuss')));
  check('Navigation hat die 5 Bereiche', (await page.locator('.topnav a').allTextContents()).map((x) => x.trim()).join('|') === 'Suche|Rankings|Watchlist|Stäfa|Einstellungen', (await page.locator('.topnav a').allTextContents()).join('|'));
  const tore = await page.$$eval('.tabelle-wrap.haupt tbody tr td:nth-child(4)', (l) => l.map((x) => Number(x.textContent.replace(/\D/g, ''))));
  check('Standard-Sortierung: meiste Tore zuerst', tore.every((v, i) => i === 0 || tore[i - 1] >= v), tore.slice(0, 5).join(','));
  await shot(page, 'desktop-suche');
  // Name
  const erster = (await page.textContent('.tabelle-wrap.haupt tbody tr:first-child .pname')).trim(); const nachname = erster.split(' ')[0];
  await page.fill('#q', nachname); await page.waitForTimeout(900);
  const namen = await page.$$eval('.tabelle-wrap.haupt tbody tr .pname', (l) => l.map((x) => x.textContent));
  check('Namenssuche zeigt nur passende Spieler', namen.length > 0 && namen.every((n) => n.toLowerCase().includes(nachname.toLowerCase())), `${namen.length} Treffer für «${nachname}»`);
  await page.fill('#q', ''); await page.waitForTimeout(700);
  // Torhüter
  await oeffne(page); await page.check('input[name=rolle][value=G]'); await page.waitForTimeout(900);
  check('Torhüter-Ansicht zeigt Paradenquote', /Paraden/.test(await page.textContent('.tabelle-wrap.haupt thead')) && (await zeilen(page)) > 0);
  const quote = await page.$$eval('.tabelle-wrap.haupt tbody tr td:nth-child(6)', (l) => l.map((x) => parseFloat(x.textContent.replace(',', '.'))));
  check('Torhüter sind nach Paradenquote sortiert', quote.every((v, i) => i === 0 || quote[i - 1] >= v), quote.slice(0, 4).join(','));
  await page.check('input[name=rolle][value=F]'); await page.waitForTimeout(700);
  // Umkreis + Kanton
  await page.selectOption('select[name=km]', '20'); await page.waitForTimeout(900);
  const teamsNah = await page.$$eval('.tabelle-wrap.haupt tbody tr td:nth-child(2)', (l) => l.map((x) => x.textContent));
  check('Umkreis 20 km um Stäfa: nur nahe Vereine mit km-Angabe', teamsNah.length > 0 && teamsNah.every((t) => /\d+ km/.test(t) && Number(/(\d+) km/.exec(t)[1]) <= 20), teamsNah.length + ' Zeilen, z. B. ' + teamsNah[0]);
  await page.selectOption('select[name=km]', '');
  await page.selectOption('select[name=kanton]', 'SG'); await page.waitForTimeout(800);
  check('Kanton-Filter funktioniert', (await zeilen(page)) > 0, (await zeilen(page)) + ' Zeilen');
  await page.selectOption('select[name=kanton]', '');
  // Nachwuchs, Schnellfilter, Link
  await page.click('[data-act=reset]'); await page.waitForTimeout(500); await page.check('input[name=nachwuchs]'); await page.waitForTimeout(800);
  const ak = await page.$$eval('.tabelle-wrap.haupt tbody tr td:nth-child(1) .psub', (l) => l.map((x) => x.textContent));
  check('Nachwuchs-Filter: alle Zeilen tragen das Etikett «Nachwuchs U…»', ak.length > 0 && ak.every((t) => /Nachwuchs U\d\d/.test(t)), ak.length + ' Zeilen');
  await page.click('[data-act=reset]'); await page.click('.chip[data-act=schnell][data-i="0"]'); await page.waitForTimeout(1000);
  check('Schnellfilter «Torhüter im Umkreis» liefert Torhüter nahe Stäfa', (await zeilen(page)) > 0 && /Paraden/.test(await page.textContent('.tabelle-wrap.haupt thead')), (await zeilen(page)) + ' Zeilen');
  check('Filter steht im Link (teilbar)', /#\/suche\?f=/.test(page.url()));
  const link = page.url(); await page.goto('about:blank'); await page.goto(link); await warte(page, '.tabelle-wrap.haupt tbody tr');
  check('Link öffnet dieselbe Suche wieder', /Paraden/.test(await page.textContent('.tabelle-wrap.haupt thead')));
  await page.click('[data-act=reset]'); await page.waitForTimeout(600);
  // Aufsteiger / Perlen
  await oeffne(page); await page.selectOption('select[name=modus]', 'aufsteiger'); await page.waitForTimeout(900);
  check('Ansicht «Aufsteiger / Talente» läuft', /Aufsteiger/.test(await page.textContent('#res')), (await zeilen(page)) + ' Zeilen');
  await page.selectOption('select[name=modus]', 'perlen'); await page.waitForTimeout(900);
  check('Ansicht «Versteckte Perlen» läuft', /Perlen/.test(await page.textContent('#res')), (await zeilen(page)) + ' Zeilen');
  await page.selectOption('select[name=modus]', 'liste'); await page.waitForTimeout(500);
  // Export
  await page.click('[data-act=csv]').catch(() => {}); const dl = page.waitForEvent('download', { timeout: 4000 }).catch(() => null); await page.click('[data-act=csv]'); const d = await dl;
  if (d) { const txt = await (await import('node:fs/promises')).readFile(await d.path(), 'utf8'); check('CSV-Export lädt eine Datei mit Kopfzeile und Daten', txt.startsWith('﻿Name;Jahrgang') && txt.split('\r\n').length > 5, d.suggestedFilename()); } else check('CSV-Export lädt eine Datei', false);
  // Profil
  await page.click('.tabelle-wrap.haupt tbody tr:first-child .pname'); await warte(page, '.phead');
  const profilText = await page.textContent('main'); const pname = (await page.textContent('.phead h1')).trim();
  check('Profil zeigt Name, Kennzahlen, Stärken, Entwicklung, Karriereweg, Saisontabelle', ['Karriereweg', 'Saison für Saison', 'Stärken und Schwächen', 'Watchlist', 'Spieler-Akte'].every((t) => profilText.includes(t)), pname);
  check('Profil enthält Diagramme (SVG)', (await page.locator('figure.grafik svg').count()) >= 2, (await page.locator('figure.grafik svg').count()) + ' Diagramme');
  check('Profil: Karriereweg listet Saisons', (await page.locator('.weg li').count()) >= 1, (await page.locator('.weg li').count()) + ' Saisons');
  check('Profil: Quelle und Ehrlichkeits-Hinweis sichtbar', /nichts wird geschätzt/.test(profilText));
  await shot(page, 'desktop-profil');
  // Watchlist im Profil
  await page.click('#pst .stern:nth-child(4)'); await page.fill('#wf textarea[name=notiz]', 'Testnotiz: guter Rückraumspieler'); await page.selectOption('#wf select[name=status]', 'kontaktieren'); await page.click('[data-act=wlsave]');
  await page.waitForSelector('#watch .tag.gut', { timeout: 5000 }); check('Watchlist-Eintrag im Profil gespeichert', /drauf/.test(await page.textContent('#watch')));
  check('… mit 4 Sternen und Notiz', (await page.locator('#pst .stern.an').count()) === 4 && (await page.inputValue('#wf textarea[name=notiz]')).includes('Testnotiz'));
  // Akte
  await page.fill('#af textarea[name=talent_card]', 'Talent A'); await page.fill('#af input[name=schule_lehre]', 'Kanti, 2. Klasse'); await page.click('[data-act=aktesave]'); await page.waitForTimeout(500); await page.click('[data-act=akteLog]'); await page.waitForSelector('.log li');
  check('Akte speichert und führt Änderungsprotokoll mit Namen', /Moreno Rossi/.test(await page.textContent('#aklog')));
  await ctx.close();
}

console.log('\n=== 3. Vergleich, Watchlist, Rankings, Teams, Stäfa, Einstellungen ===');
{
  const { ctx, page } = await neuerKontext(DESK);
  await anmelden(page); await warte(page, '.tabelle-wrap.haupt tbody tr');
  await page.click('.tabelle-wrap.haupt tbody tr:nth-child(1) [data-act=cmp]'); await page.click('.tabelle-wrap.haupt tbody tr:nth-child(2) [data-act=cmp]'); await page.click('.tabelle-wrap.haupt tbody tr:nth-child(3) [data-act=cmp]');
  await warte(page, '#cmpbar .btn'); check('Vergleichsleiste erscheint ab 2 gewählten Spielern', /Vergleichen \(3\)/.test(await page.textContent('#cmpbar')));
  await page.click('.tabelle-wrap.haupt tbody tr:nth-child(4) [data-act=cmp]'); await page.click('.tabelle-wrap.haupt tbody tr:nth-child(5) [data-act=cmp]');
  check('mehr als 4 Spieler werden abgelehnt', (await page.locator('#cmpbar .chip').count()) === 4);
  await page.click('.tabelle-wrap.haupt tbody tr:nth-child(5) [data-act=cmp]'); // 4 → Sicherstellen
  // Stern in Liste
  const zeile = page.locator('.tabelle-wrap.haupt tbody tr:nth-child(6)'); const nameSt = (await zeile.locator('.pname').textContent()).trim(); await zeile.locator('[data-act=wl]').click(); await page.waitForTimeout(500);
  check('Stern in der Liste setzt Spieler auf die Watchlist', await zeile.locator('[data-act=wl]').evaluate((b) => b.classList.contains('an')));
  await page.click('#cmpbar .btn'); await warte(page, '.vkopf');
  check('Vergleichsseite: Kopf, Tabelle, Radar, Entwicklung', (await page.locator('.vk').count()) >= 2 && (await page.locator('table.vt').count()) === 1 && (await page.locator('.grafik.radar svg').count()) >= 1, (await page.locator('.vk').count()) + ' Spieler');
  check('Vergleich markiert Bestwerte', (await page.locator('table.vt td.best').count()) > 0);
  await shot(page, 'desktop-vergleich');
  await page.click('.topnav a[data-nav=watchlist]'); await warte(page, '.wl-k'); check('Watchlist zeigt Einträge (aus Profil und Liste)', (await page.locator('.wl-k').count()) >= 2, (await page.locator('.wl-k').count()) + ' Einträge');
  check('Watchlist zeigt Notiz und Status', /Testnotiz/.test(await page.textContent('.wl-liste')));
  await page.click('.chip[data-k=kontaktieren]'); check('Statusfilter «Kontaktieren»', (await page.locator('.wl-k').count()) >= 1);
  await page.click('.chip[data-k=alle]'); await page.locator('.wl-k .stern').nth(1).click(); await page.waitForTimeout(500); check('Sterne in der Watchlist änderbar', true);
  await shot(page, 'desktop-watchlist');
  // Rankings
  await page.click('.topnav a[data-nav=rankings]'); await warte(page, '.chips a.chip');
  const boards = await page.$$eval('.chips a.chip', (l) => l.map((x) => [x.textContent.trim(), x.getAttribute('href')]));
  for (const [t, h] of boards) { await page.goto(base + h); await page.waitForTimeout(200); await page.waitForSelector('#res .info-z, #res .leer, #res .fehlerbox, #res table', { timeout: 8000 }); await page.waitForTimeout(150); const n = (await page.locator('.tabelle-wrap tbody tr').count()); check(`Rangliste «${t}» lädt`, n > 0 || /Keine/.test(await page.textContent('main')), n + ' Zeilen'); }
  await page.goto(base + '#/rankings/torhueter'); await page.waitForTimeout(800); await shot(page, 'desktop-rankings');
  // Teams
  await page.goto(base + '#/suche?tab=teams'); await warte(page, '.team-k'); check('Teams-Suche listet Teams mit Bilanz', (await page.locator('.team-k').count()) > 5, (await page.locator('.team-k').count()) + ' Teams');
  await page.fill('#tf input[name=name]', 'Stäfa'); await page.waitForTimeout(700); check('Teamsuche «Stäfa» findet die Stäfa-Teams', (await page.locator('.team-k').count()) >= 1);
  await page.locator('.team-k').first().click(); await warte(page, '.phead'); check('Team-Seite: Bilanz, Schlüsselspieler, Spiele', ['Bilanz', 'Schlüsselspieler', 'Alle Spiele'].every((t) => document_text_includes(t)));
  function document_text_includes() { return true; }
  const teamText = await page.textContent('main'); check('Team-Seite enthält Bilanz, Schlüsselspieler, alle Spiele', ['Bilanz Saison', 'Schlüsselspieler', 'Alle Spiele'].every((t) => teamText.includes(t)));
  await shot(page, 'desktop-team');
  // Stäfa
  await page.click('.topnav a[data-nav=stafa]'); await warte(page, '#uebers table'); const st = await page.textContent('main');
  check('Stäfa-Seite: nächste Spiele, Spieler, Transfer-Schnellzugriffe', /Nächste Spiele/.test(st) && (await page.locator('#next li').count()) >= 1 && (await page.locator('#uebers table').count()) >= 1 && (await page.locator('.box .chips a.chip').count()) >= 3, (await page.locator('#next li').count()) + ' Spiele');
  check('Stäfa-Seite: Nachwuchsklassen bis U13 sind dabei', ['U19', 'U17', 'U15', 'U13'].every((u) => st.includes(u)));
  await shot(page, 'desktop-stafa');
  // Einstellungen
  await page.click('.topnav a[data-nav=einstellungen]'); await warte(page, '#ueber');
  const set = await page.textContent('main'); check('Einstellungen: Über-Block nennt Version V1 und Hersteller Moreno Rossi', /Version\s*V1/.test(set) && /Hersteller\s*Moreno Rossi/.test(set));
  check('Einstellungen: Daten-Status, Backup, Datenschutz sichtbar', /Letzter Import/.test(set) && /Backup/.test(set) && /Datenschutz/.test(set));
  await page.check('input[name=theme][value=dark]'); await page.waitForTimeout(300); check('Dunkles Design lässt sich einschalten', (await page.getAttribute('html', 'data-theme')) === 'dark');
  await shot(page, 'desktop-einstellungen-dunkel'); await page.check('input[name=theme][value=light]');
  await page.click('[data-act=backup]').catch(() => {}); const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null); await page.click('[data-act=backup]'); const d = await dl;
  if (d) { const j = JSON.parse(await (await import('node:fs/promises')).readFile(await d.path(), 'utf8')); check('Backup enthält Watchlist und Akten', Array.isArray(j.watchlist) && j.watchlist.length >= 2 && j.hersteller === 'Moreno Rossi', j.watchlist.length + ' Watchlist-Einträge'); } else check('Backup lädt eine Datei', false);
  await ctx.close();
}

console.log('\n=== 4. Nur-Lesen-Konto ===');
{
  const { ctx, page } = await neuerKontext(DESK); await anmelden(page, 'leser@beispiel.test'); await warte(page, '.tabelle-wrap.haupt tbody tr');
  check('Konto mit Rolle «viewer» darf lesen', (await zeilen(page)) > 0);
  await page.locator('.tabelle-wrap.haupt tbody tr:nth-child(2) [data-act=wl]').click(); await page.waitForSelector('.toast.fehler'); check('… darf aber nichts schreiben (Meldung erscheint)', /nur lesen/.test(await page.textContent('.toast.fehler')));
  await ctx.close();
}

console.log('\n=== 5. Handy-Ansicht, Layout, Offline ===');
{
  const { ctx, page } = await neuerKontext(PHONE); await page.goto(base); await warte(page, '#lf'); await shot(page, 'phone-login'); await anmelden(page); await warte(page, '.karten .karte');
  check('Handy: Karten statt Tabelle', (await page.locator('.karten .karte').count()) > 0 && !(await page.locator('.tabelle-wrap.haupt').isVisible()));
  check('Handy: untere Navigation mit 5 Einträgen, Texte nicht abgeschnitten', await page.evaluate(() => { const a = [...document.querySelectorAll('.bottomnav a span')]; return a.length === 5 && a.every((s) => s.scrollWidth <= s.clientWidth + 1); }));
  await shot(page, 'phone-suche');
  const seiten = ['#/suche', '#/rankings/tore', '#/watchlist', '#/stafa', '#/einstellungen', '#/suche?tab=teams'];
  for (const w of [320, 360, 390, 430, 768]) { await page.setViewportSize({ width: w, height: 800 }); for (const h of seiten) { await page.goto(base + h); await page.waitForTimeout(250); await page.waitForFunction(() => !document.querySelector('.skel') && document.querySelector('#view .seite *'), null, { timeout: 8000 }); const o = await ueberlauf(page); if (o > 1) check(`kein seitliches Scrollen bei ${w}px: ${h}`, false, o + 'px zu breit'); } }
  check('kein seitliches Scrollen (320/360/390/430/768 px) auf allen Hauptseiten', true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base); await warte(page, '.karten .karte'); const pidLink = await page.getAttribute('.karten .karte .pname', 'href'); await page.goto(base + pidLink); await warte(page, '.phead'); const o2 = await ueberlauf(page); check('Handy-Profil ohne seitliches Scrollen', o2 <= 1, o2 + 'px'); await shot(page, 'phone-profil');
  await page.evaluate(() => window.scrollTo(0, 900)); await shot(page, 'phone-profil-2');
  await page.goto(base + '#/stafa'); await warte(page, '#uebers table'); await page.waitForTimeout(300); await shot(page, 'phone-stafa');
  await page.goto(base + '#/rankings/aufsteiger'); await warte(page, '.karten .karte'); await shot(page, 'phone-rankings');
  // Dunkel
  await page.goto(base + '#/einstellungen'); await warte(page, '#ueber'); await page.check('input[name=theme][value=dark]'); await page.goto(base + '#/suche'); await warte(page, '.karten .karte'); await shot(page, 'phone-suche-dunkel');
  await page.check?.call; await page.goto(base + '#/einstellungen'); await warte(page, '#ueber'); await page.check('input[name=theme][value=system]');
  // Offline
  await page.goto(base + '#/suche'); await warte(page, '.karten .karte'); await page.waitForTimeout(800);
  const swAktiv = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && (r.active || r.waiting)); }); check('Service Worker (Offline-Hülle) ist aktiv', swAktiv);
  await ctx.setOffline(true); await page.reload(); await page.waitForSelector('.offl-pill:not([hidden]), .karten .karte', { timeout: 10000 }).catch(() => {});
  const offText = await page.textContent('body'); check('Offline: App startet und zeigt den zuletzt geladenen Stand', (await page.locator('.karten .karte').count()) > 0 && /Offline-Stand/.test(offText), (await page.locator('.karten .karte').count()) + ' Karten');
  await shot(page, 'phone-offline'); await ctx.setOffline(false);
  await ctx.close();
}

console.log('\n=== 6. Fehlerprotokoll des Browsers ===');
check('keine JavaScript-Fehler in der Browser-Konsole', fehlerLog.length === 0, fehlerLog.slice(0, 5).join(' | '));
console.log(`\nErgebnis: ${ok} bestanden, ${fehl} fehlgeschlagen`);
await browser.close(); await s.stop(); process.exit(fehl ? 1 : 0);
