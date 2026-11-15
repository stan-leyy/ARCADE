-- ARCADE — schéma Supabase : profils, matchs classés et anti-triche.
-- Déjà appliqué au projet ; ce fichier sert de référence et permet de recréer la base.
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
