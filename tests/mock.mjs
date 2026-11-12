// Nachgebauter handball.ch-Server mit ERFUNDENEN Testdaten (nur für den Test, nichts davon ist echt).
import http from 'node:http';
const now = Date.now(), day = 864e5;
const iso = (d) => new Date(now + d * day).toISOString().slice(0, 19);
const teams = { 1: ['HV Alpha', 10], 2: ['SC Beta', 11], 3: ['TV Gamma', 12], 4: ['Handball Stäfa', 13] };
const groups = { 501: { season: 26, league: 'U17 Elite Herren', name: 'Hauptrunde', t: [1, 2, 4], offset: -20 }, 502: { season: 26, league: 'NLA Damen', name: 'Hauptrunde', t: [3, 4], offset: -10 }, 401: { season: 25, league: 'U17 Elite Herren', name: 'Hauptrunde', t: [3, 4], offset: -400 } };
const seasons = [{ objectId: 26, isActual: true }, { objectId: 25, isActual: false }, { objectId: 24, isActual: false }];
const games = {}; let gid = 1000;
for (const [g, d] of Object.entries(groups)) {
  const list = []; const t = d.t;
  for (let i = 0; i < 6; i++) { const h = t[i % t.length], a = t[(i + 1) % t.length]; const future = i === 5 && d.season === 26; const zero = i === 4 && d.season === 26 && g === '501';
    list.push({ objectId: ++gid, homeTeamId: h, homeTeamName: teams[h][0], homeTeamClubId: teams[h][1], homeTeamScore: future || zero ? 0 : 24 + i, awayTeamId: a, awayTeamName: teams[a][0], awayTeamClubId: teams[a][1], awayTeamScore: future || zero ? 0 : 21 + i, gameDateTime: iso(d.offset + i * (future ? 40 : 2)) }); }
  games[g] = list;
}
const FAIL = 1003; // ein Spiel in Saison 25, dessen Abruf immer fehlschlägt (Fehlerpfad)
const roster = (team) => [0, 1, 2, 3, 4].map((i) => ({ id: team * 100 + i, name: `${['MEIER', 'KELLER', 'ROSSI', 'BIANCHI', 'FREI'][i]} ${['Silas', 'Noah', 'Luca', 'Enzo', 'Jonas'][i]}` }));
roster.gk = (team) => ({ id: team * 100 + 9, name: `TORWART Tim${team}` });
const players = []; // Vereinswechsel: Spieler 400 (Meier Silas) spielt 25 bei Stäfa(4) und 26 bei Alpha(1)
function stat(game, team, season) {
  const rows = roster(team).map((p, i) => ({ gameId: game, teamId: team, playerId: (season === 25 && team === 4 && p.id === 400) ? 100 : p.id, dressNr: i + 1, playerName: p.name, totalScore: (game + i) % 7, totalShots: 8, totalScore7m: i === 0 ? 1 : 0, totalShots7m: i === 0 ? 2 : 0, technicalErrors: (game + i) % 3, total2Minutes: i === 4 ? 1 : 0, totalSuspension: 0, totalWarnings: i === 3 ? 1 : 0, function: 'player', totalSaves: 0, totalShotsGK: 0, totalSaves7m: 0, totalShots7mGK: 0 }));
  const k = roster.gk(team); rows.push({ gameId: game, teamId: team, playerId: k.id, dressNr: 1, playerName: k.name, totalScore: 0, totalShots: 0, totalScore7m: 0, totalShots7m: 0, technicalErrors: 0, total2Minutes: 0, totalSuspension: 0, totalWarnings: 0, function: 'goalkeeper', totalSaves: 8 + (game % 4), totalShotsGK: 22, totalSaves7m: 1, totalShots7mGK: 2 });
  rows.push({ gameId: game, teamId: team, playerId: 5, dressNr: 0, playerName: 'TRAINER Tom', function: 'official' });
  return rows;
}
export const zaehler = { stats: 0 };
const srv = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
  const { operationName: op, variables: v = {}, query = '' } = JSON.parse(b || '{}'); let data = {};
  if (query.includes('season {')) data = { season: seasons };
  else if (op === 'getMenu') data = { menuItem: [{ objectId: 1, name: 'Saison', objectType: 'season', menuItem: Object.entries(groups).filter(([, d]) => d.season === v.s).map(([g, d]) => ({ objectId: 90 + Number(g), name: d.league, objectType: 'league', menuItem: [{ objectId: Number(g), name: d.name, objectType: 'group' }] })) }] };
  else if (op === 'getGroupNavigationDetail') { const d = groups[v.groupId]; data = { groupNavigationDetail: d ? [{ groupId: v.groupId, groupName: d.name, categoryName: d.league, seasonName: `20${d.season - 1}/${d.season}` }] : [] }; }
  else if (op === 'getGames') data = { games: games[v.groupId] || [] };
  else if (query.includes('club {')) data = { club: Object.values(teams).map(([n, id], i) => ({ clubId: id, name: n, zipCode: '8000', city: 'Zürich', canton: 'ZH', latitude: 47.3 + i / 10, longitude: 8.5 })) };
  else if (op === 'getPlayerStats') { const d = groups[v.groupId]; data = { playerStats: d ? d.t.flatMap((t) => roster(t).map((p, i) => ({ playerId: p.id, playerYear: 2007 + (i % 4), position: d.league.startsWith('NLA') ? ['Kreis', 'Rückraum links', 'Flügel links', 'Rückraum mitte', 'Abwehr'][i] : '', hand: 'R' }))) : [] }; }
  else if (op === 'getPlayerStaff') data = { playerStaff: [] };
  else if (op === 'getGamePlayerStats') { if (v.gameId === FAIL) { res.statusCode = 500; return res.end('{}'); } zaehler.stats++;
    const g = Object.values(games).flat().find((x) => x.objectId === v.gameId); const season = Object.entries(groups).find(([k]) => games[k].includes(g))[1].season;
    data = { gamePlayerStats: g ? [...stat(g.objectId, g.homeTeamId, season), ...stat(g.objectId, g.awayTeamId, season)] : [] }; }
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data })); }); });
export const start = () => new Promise((r) => srv.listen(8130, () => r(srv)));
