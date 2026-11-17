-- ARCADE — schéma complet de la base (version 2)
-- Appliqué le 17/11/2026. À n'exécuter que pour repartir de zéro. ATTENTION : la première partie efface TOUT
-- (comptes, profils, matchs, statistiques, pièces) puis reconstruit la base de zéro.

-- 0. remise à zéro
drop function if exists public.arcade_shop_reward(text, boolean, integer);
drop function if exists public.arcade_shop_equip(text, text);
drop function if exists public.arcade_shop_buy(text, text);
drop function if exists public.arcade_shop_state();
drop function if exists public.arcade_wallet();
drop function if exists public.arcade_price(text, text);
drop function if exists public.arcade_report_match(uuid, boolean, boolean);
drop function if exists public.arcade_join_match(uuid);
drop function if exists public.arcade_create_match();
drop function if exists public.arcade_set_profile(text, text);
drop function if exists public.arcade_log_event(uuid, text, jsonb, jsonb);
drop table if exists public.inventory, public.wallets, public.events, public.matches, public.profiles cascade;
delete from auth.users;

-- ARCADE — schéma Supabase : profils, matchs classés et anti-triche.
-- Appliqué au projet le 17/11/2026 (reconstruction complète).
--
-- Principes de sécurité :
--   * les joueurs n'écrivent JAMAIS directement dans les tables : ils ne peuvent que lire le classement ;
--   * toute écriture passe par des fonctions qui vérifient l'identité (auth.uid()) et les règles du jeu ;
--   * une victoire ne compte que si les DEUX joueurs du match déclarent le même vainqueur.

-- ---------------------------------------------------------------- profils
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nick text not null check (nick ~ '^[A-Z0-9 _-]{1,12}$'),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  char text not null default 'bakari' check (char in ('bakari', 'malik', 'devan', 'sable', 'braza', 'tembo')),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_wins_idx on public.profiles (wins desc);
create unique index if not exists profiles_nick_key on public.profiles (nick); -- pas d'usurpation de pseudo

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;

drop policy if exists profiles_read_all on public.profiles;
create policy profiles_read_all on public.profiles for select to anon, authenticated using (true);
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

-- ---------------------------------------------------------------- matchs classés
-- boutique : pièces et objets débloqués (accès uniquement via les fonctions arcade_shop_*)
create table if not exists public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coins integer not null default 300 check (coins >= 0),
  fav text not null default 'bakari',
  tutorial boolean not null default false,
  earned_today integer not null default 0,
  earned_day date not null default current_date,
  updated_at timestamptz not null default now()
);
create table if not exists public.inventory (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('char', 'weapon')),
  item text not null,
  equipped_on text,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item)
);
alter table public.wallets enable row level security;
alter table public.inventory enable row level security;
revoke all on public.wallets, public.inventory from anon, authenticated;

-- catalogue (prix fixés par le serveur, pas par le client)
create or replace function public.arcade_price(p_kind text, p_id text) returns integer
language sql immutable set search_path = '' as $$
  select case
    when p_kind = 'char' then case p_id when 'bakari' then 0 when 'malik' then 0 when 'devan' then 700 when 'sable' then 900 when 'braza' then 1000 when 'tembo' then 1500 end
    when p_kind = 'weapon' then case p_id when 'lames' then 400 when 'silence' then 500 when 'ecarlate' then 800 when 'faucille' then 700 when 'dore' then 1200
      when 'sceaux' then 1000 when 'brasier' then 900 when 'jade' then 600 when 'emeraude' then 1100 end
  end
$$;

create or replace function public.arcade_wallet() returns public.wallets
language plpgsql security definer set search_path = public, pg_temp as $$
declare w public.wallets; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into wallets (user_id) values (uid) on conflict do nothing;
  select * into w from wallets where user_id = uid for update;
  if w.earned_day <> current_date then update wallets set earned_today = 0, earned_day = current_date where user_id = uid returning * into w; end if;
  return w;
end $$;

create or replace function public.arcade_shop_state() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare w public.wallets; uid uuid := auth.uid();
begin
  w := arcade_wallet();
  return jsonb_build_object(
    'coins', w.coins, 'fav', w.fav, 'tutorial', case when w.tutorial then 1 else 0 end,
    'chars', coalesce((select jsonb_agg(item) from inventory where user_id = uid and kind = 'char'), '[]'::jsonb),
    'weapons', coalesce((select jsonb_agg(item) from inventory where user_id = uid and kind = 'weapon'), '[]'::jsonb),
    'equip', coalesce((select jsonb_object_agg(equipped_on, item) from inventory where user_id = uid and kind = 'weapon' and equipped_on is not null), '{}'::jsonb));
end $$;

create or replace function public.arcade_shop_buy(p_kind text, p_id text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare w public.wallets; price integer := arcade_price(p_kind, p_id); uid uuid := auth.uid();
begin
  if price is null then raise exception 'unknown item'; end if;
  w := arcade_wallet();
  if exists (select 1 from inventory where user_id = uid and kind = p_kind and item = p_id) then return true; end if;
  if w.coins < price then return false; end if;
  update wallets set coins = coins - price, updated_at = now() where user_id = uid;
  insert into inventory (user_id, kind, item) values (uid, p_kind, p_id);
  return true;
end $$;

create or replace function public.arcade_shop_equip(p_char text, p_weapon text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  update inventory set equipped_on = null where user_id = uid and kind = 'weapon' and equipped_on = p_char;
  if p_weapon is not null then
    update inventory set equipped_on = p_char where user_id = uid and kind = 'weapon' and item = p_weapon;
  end if;
end $$;

-- gains : bonus de bienvenue une seule fois ; combats contre l'ordinateur plafonnés à 600 pièces par jour
create or replace function public.arcade_shop_reward(p_kind text, p_won boolean, p_level integer) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare w public.wallets; n integer := 0; uid uuid := auth.uid();
begin
  w := arcade_wallet();
  if p_kind = 'tutorial' then
    if w.tutorial then return 0; end if;
    update wallets set coins = coins + 250, tutorial = true where user_id = uid; return 250;
  elsif p_kind = 'cpu' then
    n := case when p_won then (array[30, 45, 60])[least(greatest(coalesce(p_level, 0), 0), 2) + 1] else 10 end;
    n := least(n, greatest(0, 600 - w.earned_today));
    update wallets set coins = coins + n, earned_today = earned_today + n where user_id = uid; return n;
  end if;
  return 0; -- les gains en ligne sont versés par arcade_report_match
end $$;

revoke execute on function public.arcade_wallet(), public.arcade_shop_state(), public.arcade_shop_buy(text, text),
  public.arcade_shop_equip(text, text), public.arcade_shop_reward(text, boolean, integer) from public, anon;
grant execute on function public.arcade_shop_state(), public.arcade_shop_buy(text, text),
  public.arcade_shop_equip(text, text), public.arcade_shop_reward(text, boolean, integer) to authenticated;
revoke execute on function public.arcade_wallet() from authenticated;
revoke execute on function public.arcade_price(text, text) from public, anon, authenticated;


create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  guest_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  host_claim uuid,      -- vainqueur déclaré par l'hôte
  guest_claim uuid,     -- vainqueur déclaré par l'invité
  host_fair boolean,    -- l'hôte n'a détecté aucune incohérence
  guest_fair boolean,
  status text not null default 'open' check (status in ('open', 'playing', 'done', 'disputed', 'capped', 'expired')),
  winner_id uuid,
  finished_at timestamptz,
  check (guest_id is null or guest_id <> host_id)
);
create index if not exists matches_host_idx on public.matches (host_id, created_at desc);
create index if not exists matches_guest_idx on public.matches (guest_id, created_at desc);

-- Aucune politique : la table est invisible et intouchable depuis le jeu.
alter table public.matches enable row level security;
revoke all on public.matches from anon, authenticated;

-- ---------------------------------------------------------------- fonctions
-- Crée ou met à jour le profil du joueur connecté (pseudo et ninja uniquement).
create or replace function public.arcade_set_profile(p_nick text, p_char text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_nick text := upper(btrim(coalesce(p_nick, '')));
  v_char text := case when p_char in ('bakari', 'malik', 'devan', 'sable', 'braza', 'tembo') then p_char else 'bakari' end;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_nick !~ '^[A-Z0-9 _-]{1,12}$' then raise exception 'bad_nick' using errcode = '22023'; end if;
  begin
    insert into public.profiles (id, nick, char) values (v_uid, v_nick, v_char)
    on conflict (id) do update set nick = excluded.nick, char = excluded.char, updated_at = now();
  exception when unique_violation then
    raise exception 'nick_taken' using errcode = '23505';
  end;
end $$;

-- L'hôte ouvre un match classé. Un seul match en cours par joueur, 40 créations par heure au plus.
create or replace function public.arcade_create_match()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then raise exception 'no_profile' using errcode = '22023'; end if;
  if (select count(*) from public.matches where host_id = v_uid and created_at > now() - interval '1 hour') >= 40 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;
  update public.matches set status = 'expired', finished_at = now()
    where status in ('open', 'playing') and (host_id = v_uid or guest_id = v_uid);
  insert into public.matches (host_id) values (v_uid) returning id into v_id;
  return v_id;
end $$;

-- L'invité rejoint le match ouvert par l'hôte.
create or replace function public.arcade_join_match(p_match uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_m public.matches%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then raise exception 'no_profile' using errcode = '22023'; end if;
  select * into v_m from public.matches where id = p_match for update;
  if not found or v_m.status <> 'open' or v_m.host_id = v_uid or v_m.created_at < now() - interval '10 minutes' then
    raise exception 'cannot_join' using errcode = '22023';
  end if;
  update public.matches set status = 'expired', finished_at = now()
    where status in ('open', 'playing') and id <> p_match and (host_id = v_uid or guest_id = v_uid);
  update public.matches set guest_id = v_uid, joined_at = now(), status = 'playing' where id = p_match;
end $$;

-- Chaque joueur déclare le résultat. Le classement ne bouge que si les deux déclarations concordent.
-- Renvoie l'état du match : 'playing' (en attente de l'adversaire), 'done', 'disputed', 'capped', 'expired'.
create or replace function public.arcade_report_match(p_match uuid, p_i_won boolean, p_fair boolean default true)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_m public.matches%rowtype;
  v_other uuid;
  v_claim uuid;
  v_status text;
  v_loser uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_i_won is null then raise exception 'bad_report' using errcode = '22023'; end if;
  select * into v_m from public.matches where id = p_match for update;
  if not found or v_uid not in (v_m.host_id, v_m.guest_id) then raise exception 'not_a_player' using errcode = '42501'; end if;
  if v_m.status <> 'playing' then return v_m.status; end if;
  if v_m.joined_at < now() - interval '30 minutes' then
    update public.matches set status = 'expired', finished_at = now() where id = p_match;
    return 'expired';
  end if;
  v_other := case when v_uid = v_m.host_id then v_m.guest_id else v_m.host_id end;
  v_claim := case when p_i_won then v_uid else v_other end;
  if v_uid = v_m.host_id then
    if v_m.host_claim is not null then return v_m.status; end if;
    v_m.host_claim := v_claim; v_m.host_fair := coalesce(p_fair, false);
  else
    if v_m.guest_claim is not null then return v_m.status; end if;
    v_m.guest_claim := v_claim; v_m.guest_fair := coalesce(p_fair, false);
  end if;
  v_status := 'playing';
  if v_m.host_claim is not null and v_m.guest_claim is not null then
    if v_m.host_claim <> v_m.guest_claim or not v_m.host_fair or not v_m.guest_fair
       or now() - v_m.joined_at < interval '15 seconds' then
      v_status := 'disputed';                      -- désaccord, incohérence ou match impossible à jouer si vite
    elsif (select count(*) from public.matches
           where status = 'done' and finished_at > now() - interval '24 hours'
             and least(host_id, guest_id) = least(v_m.host_id, v_m.guest_id)
             and greatest(host_id, guest_id) = greatest(v_m.host_id, v_m.guest_id)) >= 10 then
      v_status := 'capped';                        -- 10 matchs classés par jour entre les deux mêmes joueurs
    else
      v_status := 'done';
      v_loser := case when v_m.host_claim = v_m.host_id then v_m.guest_id else v_m.host_id end;
      update public.profiles set wins = wins + 1, updated_at = now() where id = v_m.host_claim;
      update public.profiles set losses = losses + 1, updated_at = now() where id = v_loser;
      -- pièces : 100 au vainqueur, 30 au perdant
      insert into public.wallets (user_id, coins) values (v_m.host_claim, 400)
        on conflict (user_id) do update set coins = public.wallets.coins + 100, updated_at = now();
      insert into public.wallets (user_id, coins) values (v_loser, 330)
        on conflict (user_id) do update set coins = public.wallets.coins + 30, updated_at = now();
    end if;
  end if;
  update public.matches set host_claim = v_m.host_claim, guest_claim = v_m.guest_claim,
    host_fair = v_m.host_fair, guest_fair = v_m.guest_fair, status = v_status,
    winner_id = case when v_status = 'done' then v_m.host_claim end,
    finished_at = case when v_status <> 'playing' then now() end
  where id = p_match;
  return v_status;
end $$;

-- Seuls les joueurs connectés peuvent appeler ces fonctions.
revoke execute on function public.arcade_set_profile(text, text) from public, anon;
revoke execute on function public.arcade_create_match() from public, anon;
revoke execute on function public.arcade_join_match(uuid) from public, anon;
revoke execute on function public.arcade_report_match(uuid, boolean, boolean) from public, anon;
grant execute on function public.arcade_set_profile(text, text) to authenticated;
grant execute on function public.arcade_create_match() to authenticated;
grant execute on function public.arcade_join_match(uuid) to authenticated;
grant execute on function public.arcade_report_match(uuid, boolean, boolean) to authenticated;

-- Fonction interne (déclencheur d'événement) : inutile et risquée à exposer via l'API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ---------------------------------------------------------------- journal d'activité
-- Statistiques anonymes : visites, parties, tentatives de connexion, type d'appareil.
-- Ni e-mail ni adresse IP. Illisible depuis le jeu ; écriture par une fonction qui filtre et limite le débit.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  visitor uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('visit', 'guest', 'signup', 'login', 'login_failed', 'cpu_end', 'online_end', 'room_create', 'cine_start', 'cine_replay', 'tuto_start', 'tuto_end')),
  device text,
  os text,
  browser text,
  brand text,
  model text,
  data jsonb not null default '{}'::jsonb
);
create index if not exists events_at_idx on public.events (at desc);
create index if not exists events_visitor_idx on public.events (visitor, at desc);
create index if not exists events_kind_idx on public.events (kind, at desc);

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;

create or replace function public.arcade_log_event(p_visitor uuid, p_kind text, p_device jsonb default '{}'::jsonb, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_dev jsonb := coalesce(p_device, '{}'::jsonb);
  v_in jsonb := coalesce(p_data, '{}'::jsonb);
  v_data jsonb;
begin
  if p_visitor is null or p_kind is null
     or p_kind not in ('visit', 'guest', 'signup', 'login', 'login_failed', 'cpu_end', 'online_end', 'room_create', 'cine_start', 'cine_replay', 'tuto_start', 'tuto_end') then
    return;
  end if;
  if jsonb_typeof(v_dev) <> 'object' then v_dev := '{}'::jsonb; end if;
  if jsonb_typeof(v_in) <> 'object' then v_in := '{}'::jsonb; end if;
  -- limites de débit : 120 événements par heure et par visiteur, 300 par minute au total
  if (select count(*) from public.events where visitor = p_visitor and at > now() - interval '1 hour') >= 120 then return; end if;
  if (select count(*) from public.events where at > now() - interval '1 minute') >= 300 then return; end if;
  v_data := jsonb_strip_nulls(jsonb_build_object(
    'char', nullif(left(regexp_replace(coalesce(v_in->>'char', ''), '[^a-z]', '', 'g'), 12), ''),
    'opp', nullif(left(regexp_replace(coalesce(v_in->>'opp', ''), '[^a-z]', '', 'g'), 12), ''),
    'stage', nullif(left(regexp_replace(coalesce(v_in->>'stage', ''), '[^a-z]', '', 'g'), 12), ''),
    'status', nullif(left(regexp_replace(coalesce(v_in->>'status', ''), '[^a-z]', '', 'g'), 12), ''),
    'level', case when (v_in->>'level') ~ '^[0-2]$' then (v_in->>'level')::int end,
    'secs', case when (v_in->>'secs') ~ '^[0-9]{1,4}$' then (v_in->>'secs')::int end,
    'won', case when (v_in->>'won') in ('true', 'false') then (v_in->>'won')::boolean end));
  insert into public.events (visitor, user_id, kind, device, os, browser, brand, model, data)
  values (
    p_visitor, (select auth.uid()), p_kind,
    case when (v_dev->>'device') in ('phone', 'tablet', 'desktop') then v_dev->>'device' end,
    nullif(left(regexp_replace(coalesce(v_dev->>'os', ''), '[^A-Za-z0-9 ._-]', '', 'g'), 24), ''),
    nullif(left(regexp_replace(coalesce(v_dev->>'browser', ''), '[^A-Za-z0-9 ._-]', '', 'g'), 24), ''),
    nullif(left(regexp_replace(coalesce(v_dev->>'brand', ''), '[^A-Za-z0-9 ._-]', '', 'g'), 24), ''),
    nullif(left(regexp_replace(coalesce(v_dev->>'model', ''), '[^A-Za-z0-9 ._+()/-]', '', 'g'), 40), ''),
    v_data);
end $$;

revoke execute on function public.arcade_log_event(uuid, text, jsonb, jsonb) from public;
grant execute on function public.arcade_log_event(uuid, text, jsonb, jsonb) to anon, authenticated;
