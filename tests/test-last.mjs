// Lasttest mit erfundenen Daten in realistischer Grössenordnung: 5 Saisons, ~10'000 Spiele, ~250'000 Spielerzeilen.
import { neueDb, als } from './helfer.mjs';
const pg = await neueDb(); const ICH = 'ich@beispiel.test';
await pg.query("insert into zugang(email,name,rolle) values ($1,'Moreno Rossi','admin')", [ICH]);
const t = async (name, f) => { const t0 = performance.now(); const r = await f(); console.log(`${name}: ${Math.round(performance.now() - t0)} ms`); return r; };
await t('Testdaten erzeugen', async () => {
  await pg.exec(`
    insert into seasons select s, (2020+s)||'/'||(21+s), s=4 from generate_series(0,4) s;
    insert into clubs select c, 'Club '||c, '8000', 'Ort '||c, (array['ZH','SG','BE','LU','AG','TG'])[1+c%6], 46.5+random()*1.5, 6.5+random()*3 from generate_series(1,150) c;
    insert into teams select t, 1+t%150, case when t%150=0 then 'Handball Stäfa '||t else 'Team '||t end from generate_series(1,600) t;
    insert into groups select g, g%5, (array['NLA Herren','NLB Herren','1. Liga Herren','2. Liga Herren','U17 Elite Herren','U15 Elite Damen','1. Liga Damen','U19 Inter Herren'])[1+g%8], 'Gr '||g,
      case when (array['NLA Herren','NLB Herren','1. Liga Herren','2. Liga Herren','U17 Elite Herren','U15 Elite Damen','1. Liga Damen','U19 Inter Herren'])[1+g%8] like '%Damen' then 'W' else 'M' end,
      case when g%8=4 then 'U17' when g%8=5 then 'U15' when g%8=7 then 'U19' end, true from generate_series(0,199) g;
    insert into players select p, 'Name'||p||' Vorname', 1985+(p%22), case when p%3=0 then 'Rückraum' end, 'R' from generate_series(1,12000) p;
    insert into games select gm, gm%200, now() - (gm%900||' days')::interval, 1+gm%600, 'H', 20+gm%15, 1+(gm*7)%600, 'A', 18+gm%12, true from generate_series(1,10000) gm;
    insert into player_game_stats (game_id, player_id, team_id, name, role, goals, shots, goals7, shots7, tf, min2, saves, shots_gk, saves7, shots7_gk)
      select gm, 1+((gm*13 + k*977) % 12000), case when k<12 then 1+gm%600 else 1+(gm*7)%600 end, 'x', case when k%12=0 then 'G' else 'F' end,
             (random()*7)::int, 3+(random()*8)::int, 0,0, (random()*3)::int, (random()*2)::int,
             case when k%12=0 then (random()*12)::int else 0 end, case when k%12=0 then 15+(random()*15)::int else 0 end, 0,0
      from generate_series(1,10000) gm, generate_series(0,23) k
      on conflict do nothing;
  `);
});
const n = (await pg.query('select count(*)::int n from player_game_stats')).rows[0].n; console.log('Spielerzeilen:', n);
await t('mv_stats berechnen (macht der Import 1x pro Lauf)', () => pg.query('select refresh_stats()'));
console.log('Zeilen in mv_stats:', (await pg.query('select count(*)::int n from mv_stats')).rows[0].n);
const S = (p) => als(pg, ICH, async () => (await pg.query('select suche($1::jsonb) r', [JSON.stringify(p)])).rows[0].r);
const grenze = 1500; let langsam = 0;
const mess = async (name, f) => { const t0 = performance.now(); const r = await f(); const ms = Math.round(performance.now() - t0); console.log(`  ${ms > grenze ? 'LANGSAM' : 'ok'}  ${name}: ${ms} ms`); if (ms > grenze) langsam++; return r; };
console.log('\nAntwortzeiten (Ziel unter 1.5 s, hier in WebAssembly-Postgres, echtes Supabase ist meist schneller):');
await mess('Suche aktuelle Saison, Tore', () => S({ saisons: [4] }));
await mess('Suche Name "name77"', () => S({ saisons: [4], name: 'name77' }));
await mess('Suche alle 5 Saisons einzeln', () => S({ saisons: [0, 1, 2, 3, 4] }));
await mess('Suche alle 5 Saisons zusammengefasst', () => S({ saisons: [0, 1, 2, 3, 4], zusammen: true }));
await mess('Torhüter nach Paradenquote', () => S({ saisons: [4], rolle: 'G', sort: 'save_pct', min_wuerfe: 30 }));
await mess('Aufsteiger', () => S({ saisons: [4], modus: 'aufsteiger' }));
await mess('Versteckte Perlen', () => S({ saisons: [4], modus: 'perlen' }));
await mess('Umkreis 30 km um Stäfa', () => S({ saisons: [4], umkreis: { lat: 47.24, lon: 8.73, km: 30 } }));
await mess('Nachwuchs U15', () => S({ saisons: [4], altersklasse: 'U15' }));
const pid = (await S({ saisons: [4] })).rows[0].player_id;
await mess('Spielerprofil', () => als(pg, ICH, () => pg.query('select profil($1)', [pid])));
await mess('Ähnliche Spieler', () => als(pg, ICH, () => pg.query('select aehnliche($1,6)', [pid])));
await mess('Entwicklung', () => als(pg, ICH, () => pg.query("select entwicklung('{}')")));
await mess('Teams-Suche', () => als(pg, ICH, () => pg.query("select teams_suche('{\"saison\":4}')")));
await mess('Team-Profil', () => als(pg, ICH, () => pg.query('select team_profil(150,4)')));
await mess('Stäfa-Übersicht', () => als(pg, ICH, () => pg.query('select stafa_uebersicht(4)')));
console.log(langsam ? `\n${langsam} zu langsam` : '\nAlles unter 1.5 Sekunden'); process.exit(0);
