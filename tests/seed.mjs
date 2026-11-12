// ERFUNDENE Testdaten (nichts davon ist echt): 5 Saisons, mehrere Ligen, Vereine, Spieler mit Vereinswechseln, Stäfa-Teams inkl. Nachwuchs.
const rnd = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const R = rnd(20260101); const pick = (a) => a[Math.floor(R() * a.length)]; const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const VN = ['Luca', 'Noah', 'Elias', 'Nico', 'Jonas', 'Enzo', 'Timo', 'Silas', 'Levin', 'Dario', 'Fabio', 'Joel', 'Ben', 'Marc', 'Yanick', 'Reto', 'Simon', 'Patrick', 'Lars', 'Dominik', 'Aurel', 'Gian', 'Mattia', 'Julian'];
const VF = ['Lena', 'Mia', 'Sara', 'Lea', 'Nina', 'Julia', 'Anja', 'Selina', 'Elin', 'Alina', 'Jana', 'Livia', 'Noemi', 'Fiona', 'Carla'];
const NN = ['Meier', 'Keller', 'Frei', 'Bianchi', 'Weber', 'Huber', 'Steiner', 'Gerber', 'Brunner', 'Baumann', 'Fischer', 'Zimmermann', 'Moser', 'Graf', 'Schmid', 'Egli', 'Rossi', 'Ferrari', 'Marti', 'Lüthi', 'Imhof', 'Kunz', 'Wyss', 'Hug', 'Bucher', 'Looser', 'Vogel', 'Ammann', 'Roth', 'Peter'];
const ORTE = [['Stäfa', 'ZH', 47.2406, 8.7283], ['Zürich', 'ZH', 47.3769, 8.5417], ['Winterthur', 'ZH', 47.4988, 8.7241], ['Uster', 'ZH', 47.3470, 8.7210], ['Rapperswil', 'SG', 47.2266, 8.8223], ['St. Gallen', 'SG', 47.4245, 9.3767], ['Kreuzlingen', 'TG', 47.6500, 9.1750], ['Luzern', 'LU', 47.0502, 8.3093], ['Zug', 'ZG', 47.1724, 8.5170], ['Bern', 'BE', 46.9480, 7.4474], ['Basel', 'BS', 47.5596, 7.5886], ['Lausanne', 'VD', 46.5197, 6.6323], ['Chur', 'GR', 46.8499, 9.5329], ['Schaffhausen', 'SH', 47.6970, 8.6349], ['Aarau', 'AG', 47.3925, 8.0442], ['Suhr', 'AG', 47.3700, 8.0800], ['Horgen', 'ZH', 47.2590, 8.5970], ['Wädenswil', 'ZH', 47.2300, 8.6700], ['Einsiedeln', 'SZ', 47.1270, 8.7460], ['Pfadi-Dorf', 'TG', 47.5560, 8.8980]];
export const TESTMAIL = 'ich@beispiel.test';
export async function seed(pg) {
  const clubs = ORTE.map((o, i) => ({ id: i + 1, name: i === 0 ? 'Handball Stäfa' : `HC ${o[0]}`, zip: '8000', city: o[0], canton: o[1], lat: o[2], lon: o[3] }));
  for (const c of clubs) await pg.query('insert into clubs values ($1,$2,$3,$4,$5,$6,$7)', [c.id, c.name, c.zip, c.city, c.canton, c.lat, c.lon]);
  // Teams: je Verein 1 Team; Stäfa zusätzlich U19/U17/U15/U13
  const teams = []; let tid = 100;
  const mk = (club, name) => { teams.push({ id: ++tid, club, name }); return tid; };
  clubs.forEach((c) => mk(c.id, c.id === 1 ? 'Handball Stäfa' : c.name));
  const stafa = { u19: mk(1, 'Handball Stäfa U19'), u17: mk(1, 'Handball Stäfa U17'), u15: mk(1, 'Handball Stäfa U15'), u13: mk(1, 'Handball Stäfa U13') };
  for (const t of teams) await pg.query('insert into teams values ($1,$2,$3)', [t.id, t.club, t.name]);
  const byClub = (i) => teams.find((t) => t.club === i && !/U\d\d/.test(t.name)).id;
  const saisons = [[22, '2021/22'], [23, '2022/23'], [24, '2023/24'], [25, '2024/25'], [26, '2025/26']];
  for (const [id, n] of saisons) await pg.query('insert into seasons values ($1,$2,$3)', [id, n, id === 26]);
  const LIGEN = [
    { l: 'NLA Herren', g: 'M', ak: null, teams: [1, 2, 3, 4, 5, 6, 7, 8].map(byClub), jg: [1994, 2004], pos: true },
    { l: 'NLB Herren', g: 'M', ak: null, teams: [9, 10, 11, 12, 13, 14, 15, 16].map(byClub), jg: [1992, 2005], pos: true },
    { l: '1. Liga Herren', g: 'M', ak: null, teams: [17, 18, 19, 20, 1, 3, 5, 7].map(byClub), jg: [1990, 2006], pos: false },
    { l: 'NLA Damen', g: 'W', ak: null, teams: [2, 4, 6, 8, 10, 12, 14, 16].map(byClub), jg: [1995, 2005], pos: true },
    { l: 'U19 Inter Herren', g: 'M', ak: 'U19', teams: [stafa.u19, byClub(2), byClub(3), byClub(5), byClub(7), byClub(9)], jg: [2007, 2009], pos: false },
    { l: 'U17 Elite Herren', g: 'M', ak: 'U17', teams: [stafa.u17, byClub(2), byClub(3), byClub(5), byClub(7), byClub(9)], jg: [2009, 2011], pos: false },
    { l: 'U15 Elite Herren', g: 'M', ak: 'U15', teams: [stafa.u15, byClub(2), byClub(3), byClub(5), byClub(7), byClub(9)], jg: [2011, 2013], pos: false },
    { l: 'U13 Herren', g: 'M', ak: 'U13', teams: [stafa.u13, byClub(2), byClub(3), byClub(5), byClub(7), byClub(9)], jg: [2013, 2015], pos: false },
  ];
  const POS = ['Rückraum links', 'Rückraum mitte', 'Rückraum rechts', 'Flügel links', 'Flügel rechts', 'Kreis', 'Abwehr'];
  const players = new Map(); let pid = 1000; const kader = new Map(); // key liga|team|saison → [pid]
  const neu = (gk, jg, g) => { const id = ++pid; players.set(id, { id, name: `${pick(NN)} ${g === 'W' ? pick(VF) : pick(VN)}`, birth: ri(jg[0], jg[1]), pos: gk ? 'Torhüter' : pick(POS), gk, hand: R() < 0.8 ? 'R' : 'L', g }); return id; };
  let gid = 5000, grpid = 700; const jetzt = Date.now(), tag = 864e5; const kaderVor = new Map();
  for (const [sid] of saisons) {
    for (const L of LIGEN) {
      const grp = ++grpid; await pg.query('insert into groups values ($1,$2,$3,$4,$5,$6,$7)', [grp, sid, L.l, 'Hauptrunde', L.g, L.ak, sid < 26]);
      // Kader je Team, Spieler aus Vorsaison weiterführen (mit Wechseln)
      for (const t of L.teams) {
        const k = `${L.l}|${t}`; const vor = (kaderVor.get(k) || []).filter(() => R() < 0.7); const ids = [...vor];
        while (ids.filter((x) => !players.get(x).gk).length < 11) ids.push(neu(false, L.jg, L.g)); while (ids.filter((x) => players.get(x).gk).length < 2) ids.push(neu(true, L.jg, L.g));
        kader.set(k + '|' + sid, ids);
      }
      for (const t of L.teams) kaderVor.set(`${L.l}|${t}`, kader.get(`${L.l}|${t}|${sid}`));
      const gh = []; const n = L.teams.length;
      for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) gh.push(r ? [L.teams[j], L.teams[i]] : [L.teams[i], L.teams[j]]);
      gh.sort(() => R() - 0.5);
      const anzahl = sid === 26 ? Math.round(gh.length * 0.6) : gh.length; // aktuelle Saison: Rest sind kommende Spiele
      for (let m = 0; m < gh.length; m++) {
        const [h, a] = gh[m]; const id = ++gid; const gespielt = m < anzahl;
        const tageOffset = sid === 26 ? (m - anzahl) * 3.2 : -((26 - sid) * 365 - 30) + m * 3; const dt = new Date(jetzt + tageOffset * tag - (sid === 26 ? 2 * tag : 0)).toISOString();
        const hs = gespielt ? ri(18, 34) : null, as = gespielt ? ri(16, 32) : null;
        await pg.query('insert into games values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id, grp, dt, h, teams.find((x) => x.id === h).name, hs, a, teams.find((x) => x.id === a).name, as, gespielt]);
        if (!gespielt) continue;
        for (const [t, tore] of [[h, hs], [a, as]]) {
          const ids = kader.get(`${L.l}|${t}|${sid}`); const feld = ids.filter((x) => !players.get(x).gk).sort(() => R() - 0.5).slice(0, ri(9, 12)); const tw = ids.filter((x) => players.get(x).gk);
          const gewicht = feld.map(() => R() ** 2 + 0.05); const sum = gewicht.reduce((x, y) => x + y, 0); let rest = tore;
          for (let i = 0; i < feld.length; i++) {
            const p = players.get(feld[i]); const gt = i === feld.length - 1 ? rest : Math.min(rest, Math.round((tore * gewicht[i]) / sum)); rest -= gt; const wuerfe = gt + ri(1, 5);
            await pg.query('insert into player_game_stats values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)', [id, p.id, t, p.name, ri(2, 30), 'F', gt, wuerfe, gt > 3 ? ri(0, 2) : 0, gt > 3 ? ri(1, 3) : 0, ri(0, 3), R() < 0.3 ? ri(1, 2) : 0, R() < 0.06 ? 1 : 0, 0, 0, 0, 0, 0].slice(0, 17));
          }
          const g = players.get(tw[ri(0, tw.length - 1)]); const gegner = t === h ? as : hs; const gw = gegner + ri(10, 18); const pa = Math.min(gw - gegner, Math.round(gw * (0.22 + R() * 0.16)));
          await pg.query('insert into player_game_stats values ($1,$2,$3,$4,$5,$6,0,0,0,0,0,0,0,0,$7,$8,$9,$10)', [id, g.id, t, g.name, 1, 'G', pa, gw, ri(0, 2), ri(1, 4)]);
        }
      }
    }
  }
  for (const p of players.values()) await pg.query('insert into players values ($1,$2,$3,$4,$5)', [p.id, p.name, p.birth, /Torhüter/.test(p.pos) || R() < 0.45 || p.birth > 2005 ? (p.pos === 'Torhüter' ? 'Torhüter' : (p.birth > 2005 ? null : p.pos)) : p.pos, p.hand]);
  await pg.query("insert into sync_status values (1, now() - interval '5 hours', now() - interval '5 hours', 'ok', (select count(*) from games where has_stats), 'Testdaten (erfunden)')");
  await pg.query("insert into zugang(email,name,rolle) values ($1,'Moreno Rossi','admin'),('leser@beispiel.test','Gast','viewer')", [TESTMAIL]);
  await pg.query('select refresh_stats()');
  return { spieler: players.size, stafa };
}
