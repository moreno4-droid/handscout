-- HandScout V1: Datenbank mit Zugangssperre. Hersteller: Moreno Rossi.
-- Einspielen: Supabase → SQL Editor → New query → alles einfügen → Run. Darf beliebig oft wiederholt werden.
-- Prinzip: Die Tabellen sind für Browser komplett gesperrt. Die App ruft nur die Funktionen unten auf,
-- und jede Funktion prüft zuerst, ob die angemeldete E-Mail in der Tabelle «zugang» steht. Alle anderen sehen nichts.

-- ============ Tabellen ============
create table if not exists seasons (season_id int primary key, name text not null, is_actual boolean not null default false);
create table if not exists clubs (club_id int primary key, name text, zip text, city text, canton text, lat double precision, lon double precision);
create table if not exists teams (team_id int primary key, club_id int, name text);
create table if not exists groups (
  group_id int primary key, season_id int not null references seasons(season_id),
  league text, name text, gender text check (gender in ('M','W')), age_class text, done boolean not null default false);
create table if not exists players (player_id int primary key, name text, birth_year int, position text, hand text);
create table if not exists games (
  game_id int primary key, group_id int not null references groups(group_id), game_date timestamptz,
  home_team_id int, home_name text, home_score int, away_team_id int, away_name text, away_score int, has_stats boolean not null default false);
create table if not exists player_game_stats (
  game_id int not null, player_id int not null, team_id int, name text, shirt_no int,
  role text not null check (role in ('F','G')),
  goals int not null default 0, shots int not null default 0, goals7 int not null default 0, shots7 int not null default 0,
  tf int not null default 0, min2 int not null default 0, warnings int not null default 0, disq int not null default 0,
  saves int not null default 0, shots_gk int not null default 0, saves7 int not null default 0, shots7_gk int not null default 0,
  primary key (game_id, player_id));
create table if not exists sync_status (id int primary key default 1 check (id = 1), last_run timestamptz, last_success timestamptz, state text, games_total int, note text);

create index if not exists groups_season_idx on groups(season_id);
create index if not exists games_group_idx on games(group_id, game_date);
create index if not exists games_home_idx on games(home_team_id);
create index if not exists games_away_idx on games(away_team_id);
create index if not exists pgs_player_idx on player_game_stats(player_id);

-- Wer darf rein? Nur Personen in dieser Tabelle. Rollen: admin (alles), trainer (lesen und Notizen schreiben), viewer (nur lesen)
create table if not exists zugang (email text primary key, name text, rolle text not null default 'viewer' check (rolle in ('admin','trainer','viewer')));

-- Einstufung der Ligen (1 = oberste Stufe). Kann im Table Editor angepasst werden. Passt eine Liga auf nichts, bleibt die Stufe leer.
create table if not exists liga_stufen (muster text primary key, stufe int not null);
insert into liga_stufen(muster, stufe) values
  ('\mNLA\M', 1), ('\mNLB\M', 2), ('\mSPL', 1), ('1\.?\s*Liga|Erstliga', 3), ('2\.?\s*Liga', 4), ('3\.?\s*Liga', 5), ('4\.?\s*Liga', 6), ('5\.?\s*Liga', 7),
  ('Elite', 1), ('Premium', 2), ('Promotion|Regional', 3)
on conflict (muster) do nothing;

create table if not exists watchlist (
  player_id int primary key, status text not null default 'beobachten' check (status in ('beobachten','kontaktieren','abgesagt')),
  stars int not null default 0 check (stars between 0 and 5), notiz text not null default '', erinnerung date,
  erstellt_von text, erstellt_am timestamptz not null default now(), geaendert_von text, geaendert_am timestamptz not null default now());
create table if not exists akten (
  player_id int primary key, talent_card text not null default '', schule_lehre text not null default '', trainingstage text not null default '',
  ziele text not null default '', notizen text not null default '', geaendert_von text, geaendert_am timestamptz not null default now());
create table if not exists akten_log (id bigserial primary key, player_id int not null, wer text, zeit timestamptz not null default now(), aenderungen jsonb);

-- ============ Hilfsfunktionen: Zugang ============
create or replace function auth_email() returns text language sql stable as $$
  select lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''))
$$;
create or replace function meine_rolle() returns text language sql stable security definer set search_path = public as $$
  select rolle from zugang where lower(email) = auth_email()
$$;
create or replace function mein_name() returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(name, ''), email) from zugang where lower(email) = auth_email()
$$;
create or replace function pruefe_zugang(schreiben boolean default false) returns void language plpgsql stable security definer set search_path = public as $$
declare r text := meine_rolle();
begin
  if r is null then raise exception 'Kein Zugriff' using errcode = '42501'; end if;
  if schreiben and r = 'viewer' then raise exception 'Nur Lesezugriff' using errcode = '42501'; end if;
end $$;
create or replace function liga_stufe(l text) returns int language sql stable set search_path = public as $$
  select min(stufe) from liga_stufen where l ~* muster
$$;
create or replace function ist_stafa(tid int) returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from teams t left join clubs c on c.club_id = t.club_id
                 where t.team_id = tid and (coalesce(t.name,'') ~* 'st(ä|ae|a)fa' or coalesce(c.name,'') ~* 'st(ä|ae|a)fa'))
$$;
create or replace function haversine(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision) returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)))
$$;

-- ============ Saison-Statistik (vorberechnet für schnelle Suche) ============
drop view if exists player_season_stats;
drop materialized view if exists mv_stats cascade;
create materialized view mv_stats as
with base as (
  select s.player_id, s.role, g.season_id, g.league, g.gender, g.age_class, coalesce(s.team_id, 0) as team_id,
         (count(*) filter (where s.role = 'F' or s.shots_gk > 0))::int as games,
         sum(s.goals)::int as goals, sum(s.shots)::int as shots, sum(s.goals7)::int as goals7, sum(s.shots7)::int as shots7,
         sum(s.tf)::int as tf, sum(s.min2)::int as min2, sum(s.warnings)::int as warnings, sum(s.disq)::int as disq,
         sum(s.saves)::int as saves, sum(s.shots_gk)::int as shots_gk, sum(s.saves7)::int as saves7, sum(s.shots7_gk)::int as shots7_gk
  from player_game_stats s join games gm on gm.game_id = s.game_id join groups g on g.group_id = gm.group_id
  group by s.player_id, s.role, g.season_id, g.league, g.gender, g.age_class, coalesce(s.team_id, 0)
), x as (
  select b.*, p.name, p.birth_year, p.position, t.name as team_name, (coalesce(t.name,'') ~* 'st(ä|ae|a)fa' or coalesce(c.name,'') ~* 'st(ä|ae|a)fa') as stafa, c.canton, c.lat as club_lat, c.lon as club_lon, se.name as season_name,
         b.goals::numeric / nullif(b.games, 0) as goals_pg, b.shots::numeric / nullif(b.games, 0) as shots_pg,
         b.tf::numeric / nullif(b.games, 0) as tf_pg, b.min2::numeric / nullif(b.games, 0) as min2_pg,
         b.saves::numeric / nullif(b.games, 0) as saves_pg,
         b.goals::numeric * 100 / nullif(b.shots, 0) as goal_pct, b.saves::numeric * 100 / nullif(b.shots_gk, 0) as save_pct,
         ((b.role = 'F' and b.games >= 3 and b.shots >= 15) or (b.role = 'G' and b.games >= 3 and b.shots_gk >= 30)) as qual
  from base b left join players p on p.player_id = b.player_id left join teams t on t.team_id = b.team_id left join clubs c on c.club_id = t.club_id left join seasons se on se.season_id = b.season_id
), w as (
  select x.*,
    avg(goals_pg) filter (where qual) over lg as a_t, stddev_pop(goals_pg) filter (where qual) over lg as s_t,
    avg(goal_pct) filter (where qual) over lg as a_q, stddev_pop(goal_pct) filter (where qual) over lg as s_q,
    avg(tf_pg) filter (where qual) over lg as a_f, stddev_pop(tf_pg) filter (where qual) over lg as s_f,
    avg(save_pct) filter (where qual) over lg as a_p, stddev_pop(save_pct) filter (where qual) over lg as s_p
  from x window lg as (partition by season_id, league, role)
), med as (
  select season_id, league, percentile_cont(0.5) within group (order by birth_year) as median_jahr
  from x where birth_year is not null and games > 0 group by season_id, league
)
select w.player_id, w.name, w.birth_year, w.position, w.role, w.season_id, w.season_name, w.team_name, w.stafa, w.canton, w.club_lat, w.club_lon, w.league, w.gender, w.age_class, w.team_id,
       w.games, w.goals, w.shots, w.goals7, w.shots7, w.tf, w.min2, w.warnings, w.disq, w.saves, w.shots_gk, w.saves7, w.shots7_gk,
       round(w.goals_pg, 2) as goals_pg, round(w.shots_pg, 2) as shots_pg, round(w.tf_pg, 2) as tf_pg, round(w.min2_pg, 2) as min2_pg, round(w.saves_pg, 1) as saves_pg,
       round(w.goal_pct, 1) as goal_pct, round(w.save_pct, 1) as save_pct, w.qual,
       liga_stufe(w.league) as stufe, round(m.median_jahr::numeric, 1) as liga_median_jahr,
       case when w.birth_year is not null and m.median_jahr is not null then round((m.median_jahr - w.birth_year)::numeric, 1) end as jahr_vorsprung,
       case when not w.qual then null
            when w.role = 'F' then round(((0.6 * (w.goals_pg - w.a_t) / nullif(w.s_t, 0) + 0.4 * (w.goal_pct - w.a_q) / nullif(w.s_q, 0) - 0.3 * (w.tf_pg - w.a_f) / nullif(w.s_f, 0)) * w.games / (w.games + 5.0))::numeric, 2)
            else round((((w.save_pct - w.a_p) / nullif(w.s_p, 0)) * w.games / (w.games + 5.0))::numeric, 2) end as score
from w left join med m on m.season_id = w.season_id and m.league = w.league;
create index mv_stats_player_idx on mv_stats(player_id);
create index mv_stats_sel_idx on mv_stats(season_id, role, league);
create index mv_stats_team_idx on mv_stats(team_id, season_id);

create or replace function refresh_stats() returns void language plpgsql security definer set search_path = public as $$
begin refresh materialized view mv_stats; end $$;
alter function refresh_stats() set statement_timeout = '15min';

-- ============ Funktionen für die App ============
create or replace function optionen() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform pruefe_zugang();
  return jsonb_build_object(
    'rolle', meine_rolle(), 'name', mein_name(), 'email', auth_email(),
    'saisons', coalesce((select jsonb_agg(jsonb_build_object('id', season_id, 'name', name, 'aktuell', is_actual) order by season_id desc) from seasons), '[]'),
    'ligen', coalesce((select jsonb_agg(to_jsonb(l) order by l.league) from (select distinct league, gender, age_class, liga_stufe(league) as stufe from groups where league is not null) l), '[]'),
    'positionen', coalesce((select jsonb_agg(distinct position order by position) from players where coalesce(position, '') <> ''), '[]'),
    'kantone', coalesce((select jsonb_agg(distinct canton order by canton) from clubs where coalesce(canton, '') <> ''), '[]'),
    'status', (select to_jsonb(s) from sync_status s where id = 1));
end $$;

create or replace function suche(p jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_rolle text := case when p->>'rolle' = 'G' then 'G' else 'F' end;
  v_saisons int[];
  v_modus text := coalesce(nullif(p->>'modus', ''), 'liste');
  v_zus boolean := coalesce((p->>'zusammen')::boolean, false);
  v_limit int := least(greatest(coalesce(nullif(p->>'limit', '')::int, 50), 1), 500);
  v_offset int := greatest(coalesce(nullif(p->>'offset', '')::int, 0), 0);
  v_sort text := coalesce(nullif(p->>'sort', ''), case when coalesce(nullif(p->>'modus', ''), 'liste') in ('aufsteiger', 'perlen') then 'score' when p->>'rolle' = 'G' then 'save_pct' else 'goals' end);
  v_dir text := case when lower(coalesce(p->>'dir', 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_words text[] := coalesce((select array_agg(w) from regexp_split_to_table(trim(coalesce(p->>'name', '')), '\s+') w where w <> ''), '{}');
  v_liga text := nullif(p->>'liga', '');
  v_team text := nullif(p->>'team', '');
  v_clat double precision := nullif(p#>>'{umkreis,lat}', '')::double precision;
  v_clon double precision := nullif(p#>>'{umkreis,lon}', '')::double precision;
  v_km double precision := nullif(p#>>'{umkreis,km}', '')::double precision;
  q text; res jsonb;
begin
  perform pruefe_zugang();
  select coalesce(array_agg(x::int), '{}') into v_saisons from jsonb_array_elements_text(coalesce(p->'saisons', '[]'::jsonb)) x;
  if cardinality(v_saisons) = 0 then v_saisons := array[(select coalesce((select season_id from seasons where is_actual order by season_id desc limit 1), (select max(season_id) from seasons)))]; end if;
  if v_sort not in ('name','birth_year','team','league','season','games','goals','shots','goal_pct','goals_pg','goals7','tf','tf_pg','min2','min2_pg','warnings','disq','saves','shots_gk','save_pct','saves_pg','dist','score','jahr_vorsprung') then v_sort := 'goals'; end if;
  q := format($f$
    with r as (
      select m.player_id, m.name, m.birth_year, m.position, m.season_id, m.season_name as season, m.league, m.gender, m.age_class, m.team_id, m.team_name as team, m.canton, m.role,
             m.games, m.goals, m.shots, m.goals7, m.shots7, m.tf, m.min2, m.warnings, m.disq, m.saves, m.shots_gk, m.saves7, m.shots7_gk,
             m.score, m.jahr_vorsprung, m.stufe, m.liga_median_jahr, m.qual,
             case when $12 is not null and m.club_lat is not null then haversine($12, $13, m.club_lat, m.club_lon) end as dist
      from mv_stats m
      where m.season_id = any($1) and m.role = $2
        and ($3::text is null or m.league ilike '%%' || $3 || '%%')
        and ($4::text is null or m.gender = $4) and ($5::text is null or m.age_class = $5)
        and ($6::int is null or m.birth_year >= $6) and ($7::int is null or m.birth_year <= $7)
        and ($8::text is null or m.position = $8) and ($9::text is null or m.team_name ilike '%%' || $9 || '%%')
        and ($10::text is null or m.canton = $10) and (not $21 or m.age_class is not null)
        and not exists (select 1 from unnest($11::text[]) w where coalesce(m.name, '') not ilike '%%' || w || '%%')
        and (not $17 or m.stafa)
        and ($18 <> 'aufsteiger' or (m.qual and m.jahr_vorsprung >= 1 and m.score >= 0.3 and (m.stufe is null or m.stufe <= 2)))
        and ($18 <> 'perlen' or (m.qual and m.stufe >= 3 and m.score >= 1 and m.games >= 8))
    ), x0 as (
      %s
    ), x1 as (
      select x0.*, round(goals::numeric / nullif(games, 0), 2) as goals_pg, round(goals * 100.0 / nullif(shots, 0), 1) as goal_pct,
             round(tf::numeric / nullif(games, 0), 2) as tf_pg, round(min2::numeric / nullif(games, 0), 2) as min2_pg,
             round(saves * 100.0 / nullif(shots_gk, 0), 1) as save_pct, round(saves::numeric / nullif(games, 0), 1) as saves_pg
      from x0
    ), x as (
      select * from x1
      where games >= $14 and (case when $2 = 'F' then shots else shots_gk end) >= $15
        and ($22::numeric is null or goals_pg >= $22) and ($23::numeric is null or goal_pct >= $23) and ($24::numeric is null or min2_pg <= $24) and ($25::numeric is null or save_pct >= $25)
        and ($12 is null or $16 is null or (dist is not null and dist <= $16))
    )
    select jsonb_build_object('total', (select count(*) from x), 'rows', coalesce((select jsonb_agg(to_jsonb(y)) from (
        select x.*, (w.player_id is not null) as on_watchlist, w.status as wl_status, w.stars as wl_stars, (x.games < 5) as wenig_spiele
        from x left join watchlist w on w.player_id = x.player_id order by x.%I %s nulls last, x.name limit $19 offset $20) y), '[]'::jsonb))
  $f$,
  case when v_zus then $s$
      select player_id, max(name) as name, max(birth_year) as birth_year, max(position) as position, role, null::int as season_id, string_agg(distinct season, ', ') as season,
             string_agg(distinct league, ', ') as league, max(gender) as gender, max(age_class) as age_class, null::int as team_id, string_agg(distinct team, ', ') as team, max(canton) as canton,
             sum(games)::int as games, sum(goals)::int as goals, sum(shots)::int as shots, sum(goals7)::int as goals7, sum(shots7)::int as shots7, sum(tf)::int as tf, sum(min2)::int as min2,
             sum(warnings)::int as warnings, sum(disq)::int as disq, sum(saves)::int as saves, sum(shots_gk)::int as shots_gk, sum(saves7)::int as saves7, sum(shots7_gk)::int as shots7_gk,
             (array_agg(score order by games desc))[1] as score, (array_agg(jahr_vorsprung order by games desc))[1] as jahr_vorsprung, min(stufe) as stufe,
             (array_agg(liga_median_jahr order by games desc))[1] as liga_median_jahr, bool_or(qual) as qual, min(dist) as dist
      from r group by player_id, role $s$
  else 'select * from r' end,
  v_sort, v_dir);
  execute q into res using v_saisons, v_rolle, v_liga, nullif(p->>'geschlecht', ''), nullif(p->>'altersklasse', ''), nullif(p->>'jahr_von', '')::int, nullif(p->>'jahr_bis', '')::int,
    nullif(p->>'position', ''), v_team, nullif(p->>'kanton', ''), v_words, v_clat, v_clon, greatest(coalesce(nullif(p->>'min_spiele', '')::int, 1), 0),
    greatest(coalesce(nullif(p->>'min_wuerfe', '')::int, 0), 0), v_km, coalesce((p->>'nur_stafa')::boolean, false), v_modus, v_limit, v_offset,
    coalesce((p->>'nachwuchs')::boolean, false), nullif(p->>'min_tore_pg', '')::numeric, nullif(p->>'min_quote', '')::numeric, nullif(p->>'max_strafen_pg', '')::numeric, nullif(p->>'min_parade', '')::numeric;
  return res;
end $$;

create or replace function aehnliche(pid int, n int default 6) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me record;
begin
  perform pruefe_zugang();
  select * into me from mv_stats where player_id = pid and qual order by season_id desc, games desc limit 1;
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(z)) from (
    with pool as (select * from mv_stats where season_id = me.season_id and role = me.role and qual and gender is not distinct from me.gender),
    f as (select avg(goals_pg) a1, nullif(stddev_pop(goals_pg), 0) s1, avg(goal_pct) a2, nullif(stddev_pop(goal_pct), 0) s2, avg(shots_pg) a3, nullif(stddev_pop(shots_pg), 0) s3,
                 avg(tf_pg) a4, nullif(stddev_pop(tf_pg), 0) s4, avg(min2_pg) a5, nullif(stddev_pop(min2_pg), 0) s5, avg(save_pct) a6, nullif(stddev_pop(save_pct), 0) s6, avg(saves_pg) a7, nullif(stddev_pop(saves_pg), 0) s7 from pool),
    d as (
      select pl.*, sqrt(
        case when me.role = 'F' then
          power(coalesce((pl.goals_pg - me.goals_pg) / f.s1, 0), 2) + power(coalesce((pl.goal_pct - me.goal_pct) / f.s2, 0), 2) + power(coalesce((pl.shots_pg - me.shots_pg) / f.s3, 0), 2) +
          power(coalesce((pl.tf_pg - me.tf_pg) / f.s4, 0), 2) + power(coalesce((pl.min2_pg - me.min2_pg) / f.s5, 0), 2)
        else power(coalesce((pl.save_pct - me.save_pct) / f.s6, 0), 2) + power(coalesce((pl.saves_pg - me.saves_pg) / f.s7, 0), 2) end
        + power(coalesce(pl.birth_year - me.birth_year, 0) / 2.0, 2)) as dist
      from pool pl, f where pl.player_id <> pid)
    select d.player_id, d.name, d.birth_year, t.name as team, d.league, d.games, d.goals_pg, d.goal_pct, d.save_pct, d.saves_pg, d.score, round(100 / (1 + d.dist))::int as aehnlichkeit
    from d left join teams t on t.team_id = d.team_id order by d.dist limit greatest(least(n, 20), 1)) z), '[]'::jsonb);
end $$;

create or replace function profil(pid int, voll boolean default true) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sp jsonb; sa jsonb; st jsonb; gm jsonb; lat record;
begin
  perform pruefe_zugang();
  select to_jsonb(p) into sp from players p where player_id = pid;
  if sp is null then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(z) order by z.season_id desc, z.games desc), '[]') into sa from (
    select m.season_id, se.name as season, m.league, m.gender, m.age_class, m.team_id, t.name as team, c.canton, c.lat, c.lon, m.role, m.games, m.goals, m.shots, m.goals7, m.shots7, m.tf, m.min2, m.warnings, m.disq,
           m.saves, m.shots_gk, m.saves7, m.shots7_gk, m.goals_pg, m.shots_pg, m.tf_pg, m.min2_pg, m.saves_pg, m.goal_pct, m.save_pct, m.score, m.qual, m.liga_median_jahr, m.jahr_vorsprung, m.stufe
    from mv_stats m join seasons se on se.season_id = m.season_id left join teams t on t.team_id = m.team_id left join clubs c on c.club_id = t.club_id where m.player_id = pid) z;
  select * into lat from mv_stats where player_id = pid order by season_id desc, games desc limit 1;
  if found then
    select to_jsonb(r) into st from (
      select q.*, (select count(*) from mv_stats k where k.season_id = lat.season_id and k.league = lat.league and k.role = lat.role and k.qual) as vergleichsspieler, lat.season_id as season_id, lat.league as league, lat.role as role, lat.qual as qual
      from (select player_id, percent_rank() over (order by goals_pg) as pr_tore, percent_rank() over (order by goal_pct) as pr_quote, percent_rank() over (order by tf_pg desc) as pr_fehler,
                   percent_rank() over (order by min2_pg desc) as pr_strafen, percent_rank() over (order by shots_pg) as pr_wuerfe, percent_rank() over (order by save_pct) as pr_paraden, percent_rank() over (order by saves_pg) as pr_paraden_pg
            from mv_stats where season_id = lat.season_id and league = lat.league and role = lat.role and (qual or (player_id = pid and team_id = lat.team_id))) q where q.player_id = pid limit 1) r;
  end if;
  if not voll then
    return jsonb_build_object('spieler', sp, 'saisons', sa, 'staerken', st);
  end if;
  select coalesce(jsonb_agg(to_jsonb(z) order by z.game_date desc), '[]') into gm from (
    select gm.game_id, gm.game_date, se.name as season, g.league, s.role, (s.team_id = gm.home_team_id) as heim,
           case when s.team_id = gm.home_team_id then gm.away_name else gm.home_name end as gegner,
           case when s.team_id = gm.home_team_id then gm.home_score else gm.away_score end as eigen,
           case when s.team_id = gm.home_team_id then gm.away_score else gm.home_score end as fremd,
           s.goals, s.shots, s.goals7, s.shots7, s.tf, s.min2, s.warnings, s.disq, s.saves, s.shots_gk, s.saves7, s.shots7_gk
    from player_game_stats s join games gm on gm.game_id = s.game_id join groups g on g.group_id = gm.group_id join seasons se on se.season_id = g.season_id
    where s.player_id = pid order by gm.game_date desc limit 80) z;
  return jsonb_build_object('spieler', sp, 'saisons', sa, 'staerken', st, 'spiele', gm, 'aehnlich', aehnliche(pid, 6),
    'watch', (select to_jsonb(w) from watchlist w where w.player_id = pid), 'akte', (select to_jsonb(a) from akten a where a.player_id = pid));
end $$;

create or replace function vergleich(pids int[]) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform pruefe_zugang();
  return coalesce((select jsonb_agg(profil(x, false) order by ord) from unnest(pids[1:4]) with ordinality as t(x, ord)), '[]'::jsonb);
end $$;

create or replace function entwicklung(p jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_rolle text := case when p->>'rolle' = 'G' then 'G' else 'F' end; v_cur int; v_prev int; v_min int := greatest(coalesce(nullif(p->>'min_spiele', '')::int, 8), 1);
        v_g text := nullif(p->>'geschlecht', ''); v_a text := nullif(p->>'altersklasse', ''); res jsonb;
begin
  perform pruefe_zugang();
  v_cur := coalesce(nullif(p->>'saison', '')::int, (select max(season_id) from seasons));
  select max(season_id) into v_prev from seasons where season_id < v_cur;
  select coalesce(jsonb_agg(to_jsonb(z)), '[]') into res from (
    with c as (select distinct on (player_id) * from mv_stats where season_id = v_cur and role = v_rolle and games >= v_min and (v_g is null or gender = v_g) and (v_a is null or age_class = v_a) order by player_id, games desc),
         v as (select distinct on (player_id) * from mv_stats where season_id = v_prev and role = v_rolle and games >= v_min order by player_id, games desc)
    select c.player_id, c.name, c.birth_year, t.name as team, c.league, c.games, v.games as games_vorher, c.goals_pg, v.goals_pg as goals_pg_vorher, c.goal_pct, v.goal_pct as goal_pct_vorher,
           c.save_pct, v.save_pct as save_pct_vorher, round(c.goals_pg - v.goals_pg, 2) as d_tore, round(c.goal_pct - v.goal_pct, 1) as d_quote, round(c.save_pct - v.save_pct, 1) as d_paraden,
           c.score, v.score as score_vorher, round(c.score - v.score, 2) as d_score
    from c join v using (player_id) left join teams t on t.team_id = c.team_id where c.score is not null and v.score is not null
    order by (c.score - v.score) desc limit 100) z;
  return res;
end $$;

-- Teams: Suche und Profil (Gegner-Scouting)
create or replace function teams_suche(p jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_s int; res jsonb;
begin
  perform pruefe_zugang();
  v_s := coalesce(nullif(p->>'saison', '')::int, (select coalesce((select season_id from seasons where is_actual order by season_id desc limit 1), max(season_id)) from seasons));
  select coalesce(jsonb_agg(to_jsonb(z)), '[]') into res from (
    select t.team_id, t.name, c.city, c.canton, g.league, g.group_id,
           count(*) filter (where gm.home_score is not null)::int as spiele,
           sum(case when gm.home_team_id = t.team_id then gm.home_score else gm.away_score end)::int as tore_fuer,
           sum(case when gm.home_team_id = t.team_id then gm.away_score else gm.home_score end)::int as tore_gegen,
           count(*) filter (where gm.home_score is not null and ((gm.home_team_id = t.team_id and gm.home_score > gm.away_score) or (gm.away_team_id = t.team_id and gm.away_score > gm.home_score)))::int as siege,
           count(*) filter (where gm.home_score is not null and gm.home_score = gm.away_score)::int as unentschieden
    from teams t join games gm on (gm.home_team_id = t.team_id or gm.away_team_id = t.team_id) join groups g on g.group_id = gm.group_id and g.season_id = v_s
    left join clubs c on c.club_id = t.club_id
    where (nullif(p->>'name', '') is null or t.name ilike '%' || (p->>'name') || '%')
      and (nullif(p->>'liga', '') is null or g.league ilike '%' || (p->>'liga') || '%')
      and (nullif(p->>'kanton', '') is null or c.canton = p->>'kanton')
    group by t.team_id, t.name, c.city, c.canton, g.league, g.group_id
    order by siege desc, (sum(case when gm.home_team_id = t.team_id then gm.home_score else gm.away_score end) - sum(case when gm.home_team_id = t.team_id then gm.away_score else gm.home_score end)) desc nulls last
    limit 300) z;
  return jsonb_build_object('saison', v_s, 'rows', res);
end $$;

create or replace function team_profil(tid int, sid int default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_s int; v_t jsonb; v_g jsonb; v_k jsonb;
begin
  perform pruefe_zugang();
  v_s := coalesce(sid, (select max(g.season_id) from games gm join groups g on g.group_id = gm.group_id where gm.home_team_id = tid or gm.away_team_id = tid));
  select to_jsonb(z) into v_t from (select t.team_id, t.name, c.name as verein, c.city, c.zip, c.canton, c.lat, c.lon, ist_stafa(t.team_id) as stafa from teams t left join clubs c on c.club_id = t.club_id where t.team_id = tid) z;
  if v_t is null then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(z) order by z.game_date), '[]') into v_g from (
    select gm.game_id, gm.game_date, g.league, (gm.home_team_id = tid) as heim,
           case when gm.home_team_id = tid then gm.away_name else gm.home_name end as gegner,
           case when gm.home_team_id = tid then gm.away_team_id else gm.home_team_id end as gegner_id,
           case when gm.home_team_id = tid then gm.home_score else gm.away_score end as eigen,
           case when gm.home_team_id = tid then gm.away_score else gm.home_score end as fremd
    from games gm join groups g on g.group_id = gm.group_id where g.season_id = v_s and (gm.home_team_id = tid or gm.away_team_id = tid)) z;
  select coalesce(jsonb_agg(to_jsonb(z)), '[]') into v_k from (
    select m.player_id, m.name, m.birth_year, m.position, m.role, m.games, m.goals, m.shots, m.goals_pg, m.goal_pct, m.tf, m.min2, m.saves, m.shots_gk, m.save_pct, m.score, m.qual
    from mv_stats m where m.team_id = tid and m.season_id = v_s order by m.goals desc, m.saves desc limit 40) z;
  return jsonb_build_object('team', v_t, 'saison', v_s, 'spiele', v_g, 'kader', v_k,
    'saisons', coalesce((select jsonb_agg(distinct g.season_id order by g.season_id desc) from games gm join groups g on g.group_id = gm.group_id where gm.home_team_id = tid or gm.away_team_id = tid), '[]'));
end $$;

-- Stäfa: nächste Spiele und Spielerübersicht (alle Stäfa-Teams inkl. U13)
create or replace function stafa_naechste() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform pruefe_zugang();
  return coalesce((select jsonb_agg(to_jsonb(z) order by z.game_date) from (
    select gm.game_id, gm.game_date, g.league, gm.home_team_id, gm.home_name, gm.away_team_id, gm.away_name
    from games gm join groups g on g.group_id = gm.group_id
    where gm.home_score is null and gm.game_date >= now() - interval '3 hours' and (ist_stafa(gm.home_team_id) or ist_stafa(gm.away_team_id))
    order by gm.game_date limit 30) z), '[]'::jsonb);
end $$;

create or replace function stafa_uebersicht(sid int default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_s int;
begin
  perform pruefe_zugang();
  v_s := coalesce(sid, (select coalesce((select season_id from seasons where is_actual order by season_id desc limit 1), max(season_id)) from seasons));
  return jsonb_build_object('saison', v_s, 'rows', coalesce((select jsonb_agg(to_jsonb(z)) from (
    select m.player_id, m.name, m.birth_year, m.position, m.role, m.team_id, t.name as team, m.league, m.age_class, m.games, m.goals, m.shots, m.goals_pg, m.goal_pct, m.tf, m.min2, m.saves, m.save_pct, m.score, m.qual,
           (a.player_id is not null) as hat_akte, a.talent_card, a.schule_lehre, a.trainingstage, a.ziele, a.notizen
    from mv_stats m join teams t on t.team_id = m.team_id left join akten a on a.player_id = m.player_id
    where m.season_id = v_s and m.stafa order by m.age_class nulls first, t.name, m.goals desc) z), '[]'::jsonb));
end $$;

-- Watchlist
create or replace function wl_liste() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform pruefe_zugang();
  return coalesce((select jsonb_agg(to_jsonb(z) order by z.stars desc, z.geaendert_am desc) from (
    select w.*, p.name, p.birth_year, p.position, l.team, l.league, l.season, l.games, l.goals_pg, l.goal_pct, l.save_pct, l.role, l.score
    from watchlist w left join players p on p.player_id = w.player_id
    left join lateral (select t.name as team, m.league, se.name as season, m.games, m.goals_pg, m.goal_pct, m.save_pct, m.role, m.score from mv_stats m join seasons se on se.season_id = m.season_id
                       left join teams t on t.team_id = m.team_id where m.player_id = w.player_id order by m.season_id desc, m.games desc limit 1) l on true) z), '[]'::jsonb);
end $$;

create or replace function wl_setzen(pid int, daten jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare r watchlist;
begin
  perform pruefe_zugang(true);
  if not exists (select 1 from players where player_id = pid) then raise exception 'Spieler unbekannt'; end if;
  insert into watchlist(player_id, status, stars, notiz, erinnerung, erstellt_von, geaendert_von)
  values (pid, coalesce(nullif(daten->>'status', ''), 'beobachten'), coalesce(nullif(daten->>'stars', '')::int, 0), coalesce(daten->>'notiz', ''), nullif(daten->>'erinnerung', '')::date, mein_name(), mein_name())
  on conflict (player_id) do update set
    status = coalesce(nullif(daten->>'status', ''), watchlist.status),
    stars = coalesce(nullif(daten->>'stars', '')::int, watchlist.stars),
    notiz = coalesce(daten->>'notiz', watchlist.notiz),
    erinnerung = case when daten ? 'erinnerung' then nullif(daten->>'erinnerung', '')::date else watchlist.erinnerung end,
    geaendert_von = mein_name(), geaendert_am = now()
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function wl_loeschen(pid int) returns void language plpgsql security definer set search_path = public as $$
begin perform pruefe_zugang(true); delete from watchlist where player_id = pid; end $$;

-- Spieler-Akte (Talent Card, Schule/Lehre, Trainingstage, Ziele, Notizen) mit Änderungsprotokoll
create or replace function akte_speichern(pid int, daten jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare r akten;
begin
  perform pruefe_zugang(true);
  if not exists (select 1 from players where player_id = pid) then raise exception 'Spieler unbekannt'; end if;
  insert into akten(player_id, talent_card, schule_lehre, trainingstage, ziele, notizen, geaendert_von)
  values (pid, coalesce(daten->>'talent_card', ''), coalesce(daten->>'schule_lehre', ''), coalesce(daten->>'trainingstage', ''), coalesce(daten->>'ziele', ''), coalesce(daten->>'notizen', ''), mein_name())
  on conflict (player_id) do update set
    talent_card = coalesce(daten->>'talent_card', akten.talent_card), schule_lehre = coalesce(daten->>'schule_lehre', akten.schule_lehre),
    trainingstage = coalesce(daten->>'trainingstage', akten.trainingstage), ziele = coalesce(daten->>'ziele', akten.ziele),
    notizen = coalesce(daten->>'notizen', akten.notizen), geaendert_von = mein_name(), geaendert_am = now()
  returning * into r;
  insert into akten_log(player_id, wer, aenderungen) values (pid, mein_name(), daten);
  return to_jsonb(r);
end $$;

create or replace function akte_log(pid int) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform pruefe_zugang();
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.zeit desc) from (select wer, zeit, aenderungen from akten_log where player_id = pid order by zeit desc limit 30) l), '[]'::jsonb);
end $$;

-- ============ Sperren und Freigaben ============
alter table seasons enable row level security;  alter table clubs enable row level security;   alter table teams enable row level security;
alter table groups enable row level security;   alter table players enable row level security; alter table games enable row level security;
alter table player_game_stats enable row level security; alter table sync_status enable row level security; alter table zugang enable row level security;
alter table liga_stufen enable row level security; alter table watchlist enable row level security; alter table akten enable row level security; alter table akten_log enable row level security;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

grant execute on function optionen(), suche(jsonb), aehnliche(int, int), profil(int, boolean), vergleich(int[]), entwicklung(jsonb), teams_suche(jsonb), team_profil(int, int),
  stafa_naechste(), stafa_uebersicht(int), wl_liste(), wl_setzen(int, jsonb), wl_loeschen(int), akte_speichern(int, jsonb), akte_log(int) to authenticated;
-- refresh_stats() bleibt dem service_role (Import) vorbehalten
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on all tables in schema public to service_role;
    grant usage, select on all sequences in schema public to service_role;
    grant execute on function refresh_stats() to service_role;
  end if;
end $$;

-- ============ Dein Zugang (EINMAL anpassen!) ============
-- Ersetze DEINE@EMAIL.CH durch die E-Mail, mit der du dich in der App anmeldest, und lasse nur diese Zeile laufen, wenn du den Block unten brauchst:
-- insert into zugang(email, name, rolle) values (lower('DEINE@EMAIL.CH'), 'Moreno Rossi', 'admin') on conflict (email) do update set rolle = 'admin';
