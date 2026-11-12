// Testserver: liefert die Website aus UND spielt Supabase nach (Anmeldung + Funktionsaufrufe) auf einer Datenbank im Speicher.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neueDb } from './helfer.mjs';
import { seed } from './seed.mjs';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const SIG = { suche: [['p', 'jsonb']], aehnliche: [['pid', 'int'], ['n', 'int']], profil: [['pid', 'int'], ['voll', 'boolean']], vergleich: [['pids', 'int[]']], entwicklung: [['p', 'jsonb']], teams_suche: [['p', 'jsonb']], team_profil: [['tid', 'int'], ['sid', 'int']], stafa_naechste: [], stafa_uebersicht: [['sid', 'int']], wl_liste: [], wl_setzen: [['pid', 'int'], ['daten', 'jsonb']], wl_loeschen: [['pid', 'int']], akte_speichern: [['pid', 'int'], ['daten', 'jsonb']], akte_log: [['pid', 'int']], optionen: [] };
const USERS = { 'ich@beispiel.test': 'test1234', 'leser@beispiel.test': 'test1234', 'fremder@beispiel.test': 'test1234' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export async function startServer({ port = 8140, mitSeed = true } = {}) {
  const pg = await neueDb(); const info = mitSeed ? await seed(pg) : {};
  let kette = Promise.resolve(); const seriell = (f) => (kette = kette.then(f, f));
  const refresh = new Map(); const stat = { rpc: 0, abgelehnt: 0, log: [] };
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'); const body = await new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); });
    const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(o === undefined ? '' : JSON.stringify(o)); };
    try {
      if (u.pathname === '/auth/v1/token') {
        const b = JSON.parse(body || '{}'); let email;
        if (u.searchParams.get('grant_type') === 'password') { if (USERS[b.email] && USERS[b.email] === b.password) email = b.email; else return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }); }
        else { email = refresh.get(b.refresh_token); if (!email) return json(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' }); }
        const rt = 'r' + Math.random().toString(36).slice(2); refresh.set(rt, email);
        return json(200, { access_token: `${b64({ alg: 'none' })}.${b64({ email, role: 'authenticated', exp: Date.now() / 1000 + 3600 })}.x`, refresh_token: rt, expires_in: 3600, user: { email } });
      }
      if (u.pathname === '/auth/v1/recover') return json(200, {});
      if (u.pathname.startsWith('/rest/v1/rpc/')) {
        const fn = u.pathname.split('/').pop(); const sig = SIG[fn]; if (!sig) return json(404, { message: 'unbekannte Funktion' });
        const tok = (req.headers.authorization || '').replace(/^Bearer /, ''); let claims = null; try { claims = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); } catch {}
        const args = JSON.parse(body || '{}'); stat.rpc++;
        const out = await seriell(async () => {
          const rolle = claims?.email ? 'authenticated' : 'anon';
          await pg.exec(`set role ${rolle}`); await pg.query("select set_config('request.jwt.claims', $1, false)", [claims ? JSON.stringify(claims) : '']);
          try {
            const named = sig.filter(([n]) => n in args); const ps = named.map(([n, t], i) => (t === 'int[]' ? `${n} := array(select jsonb_array_elements_text($${i + 1}::jsonb))::int[]` : t === 'jsonb' ? `${n} := $${i + 1}::jsonb` : `${n} := $${i + 1}::${t}`));
            const r = await pg.query(`select ${fn}(${ps.join(', ')}) as v`, named.map(([n, t]) => (t === 'int[]' || t === 'jsonb' ? JSON.stringify(args[n]) : args[n])));
            return { ok: true, v: r.rows[0].v };
          } catch (e) { return { ok: false, code: e.code, message: e.message }; } finally { await pg.exec('reset role'); await pg.query("select set_config('request.jwt.claims','',false)"); }
        });
        if (!out.ok) { stat.abgelehnt++; return json(out.code === '42501' ? 403 : 400, { code: out.code, message: out.message }); }
        if (out.v === null && ['wl_loeschen'].includes(fn)) return json(204);
        return json(200, out.v);
      }
      if (u.pathname.startsWith('/rest/v1/')) { // direkter Tabellenzugriff: muss für alle gesperrt sein
        const tok = (req.headers.authorization || '').replace(/^Bearer /, ''); let claims = null; try { claims = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); } catch {}
        const t = u.pathname.split('/')[3]; const r = await seriell(async () => { await pg.exec(`set role ${claims?.email ? 'authenticated' : 'anon'}`); try { await pg.query(`select * from ${t.replace(/[^a-z_]/g, '')} limit 1`); return 200; } catch (e) { return 403; } finally { await pg.exec('reset role'); } });
        return json(r, r === 200 ? [] : { code: '42501', message: 'permission denied' });
      }
      let p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname); p = normalize(p).replace(/^(\.\.[/\\])+/, '');
      if (p === '/config.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(`window.HANDSCOUT={SUPABASE_URL:'http://localhost:${port}',SUPABASE_ANON_KEY:'test-anon',STAFA:{name:'Handball Stäfa',lat:47.2406,lon:8.7283}};`); }
      const data = await readFile(join(ROOT, p)); res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data);
    } catch (e) { res.writeHead(e.code === 'ENOENT' ? 404 : 500); res.end(String(e.message)); }
  });
  await new Promise((ok) => srv.listen(port, ok));
  return { srv, pg, info, stat, port, stop: () => new Promise((ok) => srv.close(ok)) };
}
if (import.meta.url === `file://${process.argv[1]}`) { const s = await startServer(); console.log('Läuft auf http://localhost:' + s.port, s.info); }
