import { neueDb, als, probiere, dbAdapter } from './helfer.mjs';
process.env.HANDBALL_API = 'http://localhost:8130/Umbraco/Api/MatchCenter/Query'; process.env.PAUSE_MS = '0'; process.env.MAX_MINUTEN = '300';
const { start, zaehler } = await import('./mock.mjs');
const { run } = await import('../scripts/import-db.mjs');
await start();
let fehl = 0; const pruefe = (name, ok, info = '') => { console.log((ok ? '  OK   ' : '  FEHLER ') + name + (info ? '  → ' + info : '')); if (!ok) fehl++; };
const pg = await neueDb(); console.log('Schema zweimal eingespielt: OK');
const db = dbAdapter(pg);
console.log('\n--- Import Lauf 1 ---'); const r1 = await run(db);
const stats1 = zaehler.stats;
console.log('--- Import Lauf 2 ---'); await run(db);
pruefe('2. Lauf holt nur den fehlgeschlagenen Spiel-Bericht erneut (nicht alles doppelt)', zaehler.stats - stats1 <= 2, `${zaehler.stats - stats1} Abrufe`);
const n = async (s) => Number((await pg.query(s)).rows[0].n);
pruefe('kommende Spiele sind gespeichert (ohne Resultat)', (await n("select count(*) n from games where home_score is null")) >= 1);
pruefe('mv_stats wurde vom Import berechnet', (await n('select count(*) n from mv_stats')) > 0);

// ---- Zugang ----
const ICH = 'ich@beispiel.test', FREMD = 'fremder@beispiel.test', LESER = 'leser@beispiel.test';
await pg.query("insert into zugang(email,name,rolle) values ($1,'Moreno Rossi','admin'),($2,'Gast','viewer')", [ICH, LESER]);
console.log('\n--- Zugriffsschutz ---');
const rpcs = ["optionen()", "suche('{}')", "profil(100)", "aehnliche(100,5)", "vergleich(array[100,200])", "entwicklung('{}')", "teams_suche('{}')", "team_profil(4)", "stafa_naechste()", "stafa_uebersicht()", "wl_liste()", "akte_log(100)", "wl_setzen(100,'{}')", "akte_speichern(100,'{}')", "wl_loeschen(100)"];
for (const wer of [null, FREMD]) {
  const bad = [];
  for (const f of rpcs) { const r = await als(pg, wer, () => probiere(() => pg.query('select ' + f))); if (r.ok) bad.push(f); }
  pruefe(`${wer === null ? 'ohne Anmeldung' : 'angemeldet, aber nicht auf der Liste'}: alle ${rpcs.length} Funktionen gesperrt`, bad.length === 0, bad.join(', '));
  for (const t of ['players', 'player_game_stats', 'games', 'zugang', 'watchlist', 'akten', 'mv_stats', 'sync_status']) {
    const r = await als(pg, wer, () => probiere(() => pg.query('select * from ' + t))); if (r.ok) pruefe('Tabelle direkt lesbar: ' + t, false);
  }
  const w = await als(pg, wer, () => probiere(() => pg.query("insert into zugang(email,rolle) values ('x@y.z','admin')"))); pruefe('Sich selbst auf die Liste setzen unmöglich', !w.ok);
  const rf = await als(pg, wer, () => probiere(() => pg.query('select refresh_stats()'))); pruefe('refresh_stats gesperrt', !rf.ok);
}
{ const bad = []; for (const t of ['players', 'player_game_stats', 'games', 'zugang', 'watchlist', 'akten', 'mv_stats']) { const r = await als(pg, ICH, () => probiere(() => pg.query('select * from ' + t))); if (r.ok) bad.push(t); }
  pruefe('auch du kannst Tabellen nicht direkt lesen (nur über die geprüften Funktionen)', bad.length === 0, bad.join(',')); }
const o = await als(pg, ICH, () => pg.query('select optionen() o')); pruefe('du (admin) kommst rein', o.rows[0].o.rolle === 'admin' && o.rows[0].o.name === 'Moreno Rossi');
pruefe('E-Mail Gross/Klein egal', (await als(pg, 'ICH@Beispiel.Test', () => probiere(() => pg.query('select optionen()')))).ok);
const lv = await als(pg, LESER, () => probiere(() => pg.query("select wl_setzen(100,'{\"stars\":3}')"))); pruefe('Leser darf nichts schreiben', !lv.ok, lv.fehler);
pruefe('Leser darf lesen', (await als(pg, LESER, () => probiere(() => pg.query("select suche('{}')")))).ok);

// ---- Funktionen auf Importdaten ----
console.log('\n--- Funktionen mit Import-Testdaten ---');
const S = (p) => als(pg, ICH, async () => (await pg.query('select suche($1::jsonb) r', [JSON.stringify(p)])).rows[0].r);
const opt = o.rows[0].o; const sNeu = opt.saisons[0].id;
let r = await S({ saisons: [sNeu], min_spiele: 1 }); pruefe('Suche Feldspieler liefert Zeilen', r.total > 0 && r.rows.length > 0, `${r.total} Treffer`);
pruefe('Sortierung Tore absteigend', r.rows.every((x, i, a) => i === 0 || a[i - 1].goals >= x.goals));
r = await S({ rolle: 'G', saisons: [sNeu] }); pruefe('Suche Torhüter', r.rows.length > 0 && r.rows.every((x) => x.role === 'G'));
r = await S({ name: 'rossi', saisons: [sNeu] }); pruefe('Namenssuche (ohne Gross/Klein)', r.rows.length > 0 && r.rows.every((x) => /rossi/i.test(x.name)));
r = await S({ name: 'luca rossi', saisons: [sNeu] }); pruefe('Namenssuche mehrere Wörter', r.rows.length > 0);
r = await S({ saisons: [sNeu], nachwuchs: true }); pruefe('Nachwuchs-Filter: nur Jugendklassen', r.rows.length > 0 && r.rows.every((x) => /^U\d\d$/.test(x.age_class)));
r = await S({ saisons: [sNeu], min_tore_pg: 3 }); pruefe('Filter Tore/Spiel', r.rows.every((x) => x.goals_pg >= 3), `${r.total} Treffer`);
r = await S({ saisons: [sNeu], min_quote: 40, max_strafen_pg: 0.5 }); pruefe('Filter Quote und Strafen', r.rows.every((x) => x.goal_pct >= 40 && x.min2_pg <= 0.5), `${r.total} Treffer`);
r = await S({ saisons: [sNeu], rolle: 'G', min_parade: 30 }); pruefe('Filter Paradenquote', r.rows.every((x) => x.save_pct >= 30), `${r.total} Treffer`);
pruefe('Positionsliste in optionen', Array.isArray(opt.positionen) && opt.positionen.length > 0, opt.positionen.join(', '));
r = await S({ saisons: [sNeu], nur_stafa: true }); pruefe('nur Stäfa', r.rows.length > 0 && r.rows.every((x) => /stäfa/i.test(x.team)), `${r.rows.length}`);
const gesamt = (await S({ saisons: [sNeu] })).total; r = await S({ saisons: [sNeu], umkreis: { lat: 47.3, lon: 8.5, km: 5 } });
pruefe('Umkreis-Filter: nur Vereine im Radius (Testverein 0 km entfernt, andere 11+ km)', r.total > 0 && r.total < gesamt && r.rows.every((x) => x.dist <= 5), `${r.total} von ${gesamt}`);
r = await S({ saisons: opt.saisons.map((s) => s.id), zusammen: true }); pruefe('alle Saisons zusammen: ein Spieler = eine Zeile', new Set(r.rows.map((x) => x.player_id)).size === r.rows.length);
r = await S({ saisons: [sNeu], sort: 'name; drop table players', dir: 'asc' }); pruefe('Sortierfeld kann nichts einschleusen', r.rows.length > 0 && Number((await pg.query('select count(*) n from players')).rows[0].n) > 0);
r = await S({ saisons: [sNeu], name: "x' or '1'='1" }); pruefe('Suchtext kann nichts einschleusen', r.total === 0);
const pr = await als(pg, ICH, async () => (await pg.query('select profil(100) p')).rows[0].p);
pruefe('Profil Spieler 100: Karriere über Saisons und Vereine', pr.saisons.length >= 2 && new Set(pr.saisons.map((s) => s.team)).size >= 2, pr.saisons.map((s) => s.season + ' ' + s.team).join(' | '));
pruefe('Profil enthält Einzelspiele', pr.spiele.length > 0);
const sw = await als(pg, ICH, async () => {
  await pg.query(`select wl_setzen(100,'{"status":"kontaktieren","stars":4,"notiz":"Test"}')`);
  await pg.query(`select akte_speichern(100,'{"talent_card":"A","ziele":"B"}')`);
  await pg.query(`select akte_speichern(401,'{"talent_card":"U17"}')`);
  return (await pg.query('select wl_liste() w, akte_log(100) l, stafa_uebersicht() s, stafa_naechste() nx, team_profil(4) t, teams_suche($1) ts', ['{}'])).rows[0]; });
pruefe('Watchlist speichern und lesen', sw.w.length === 1 && sw.w[0].stars === 4 && sw.w[0].status === 'kontaktieren');
pruefe('Akte mit Protokoll', sw.l.length === 1 && sw.l[0].wer === 'Moreno Rossi');
pruefe('Stäfa-Übersicht', sw.s.rows.length > 0 && sw.s.rows.some((x) => x.hat_akte));
pruefe('Stäfa nächste Spiele', sw.nx.length >= 1, JSON.stringify(sw.nx[0] || {}).slice(0, 90));
pruefe('Teamprofil', sw.t.kader.length > 0 && sw.t.spiele.length > 0);
pruefe('Teams-Suche', sw.ts.rows.length > 0);
const bad = await als(pg, ICH, () => probiere(() => pg.query("select wl_setzen(9999999,'{}')"))); pruefe('Watchlist für unbekannten Spieler abgelehnt', !bad.ok);
const bs = await als(pg, ICH, () => probiere(() => pg.query("select wl_setzen(100,'{\"status\":\"quatsch\"}')"))); pruefe('ungültiger Status abgelehnt', !bs.ok);
const ae = await als(pg, ICH, async () => (await pg.query('select aehnliche(100,5) a')).rows[0].a); pruefe('Ähnliche Spieler laufen', Array.isArray(ae));
const vg = await als(pg, ICH, async () => (await pg.query('select vergleich(array[100,200,300,400,500]) v')).rows[0].v); pruefe('Vergleich auf 4 Spieler begrenzt', vg.length === 4);
const en = await als(pg, ICH, async () => (await pg.query("select entwicklung('{\"min_spiele\":1}') e")).rows[0].e); pruefe('Entwicklung läuft', Array.isArray(en), `${en.length} Zeilen`);
console.log(fehl ? `\n${fehl} FEHLER` : '\nALLES BESTANDEN'); process.exit(fehl ? 1 : 0);
