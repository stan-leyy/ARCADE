-- ARCADE — boutique côté serveur (PAS ENCORE APPLIQUÉ)
-- À exécuter dans Supabase > SQL Editor, puis mettre shopServer: true dans js/config.js.
-- Les joueurs ne peuvent ni lire ni écrire ces tables directement : tout passe par les fonctions ci-dessous.

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
language sql immutable as $$
  select case
    when p_kind = 'char' then case p_id when 'bakari' then 0 when 'malik' then 0 when 'devan' then 700 when 'sable' then 900 when 'braza' then 1000 when 'tembo' then 1500 end
    when p_kind = 'weapon' then case p_id when 'lames' then 400 when 'silence' then 500 when 'ecarlate' then 800 when 'faucille' then 700 when 'dore' then 1200
      when 'sceaux' then 1000 when 'brasier' then 900 when 'jade' then 600 when 'emeraude' then 1100 end
  end
$$;

create or replace function public.arcade_wallet() returns public.wallets
language plpgsql security definer set search_path = public as $$
declare w public.wallets; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into wallets (user_id) values (uid) on conflict do nothing;
  select * into w from wallets where user_id = uid for update;
  if w.earned_day <> current_date then update wallets set earned_today = 0, earned_day = current_date where user_id = uid returning * into w; end if;
  return w;
end $$;

create or replace function public.arcade_shop_state() returns jsonb
language plpgsql security definer set search_path = public as $$
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
language plpgsql security definer set search_path = public as $$
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
language plpgsql security definer set search_path = public as $$
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
language plpgsql security definer set search_path = public as $$
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

-- À AJOUTER dans arcade_report_match, à l'endroit où un match passe à « done » (les deux joueurs d'accord) :
--   update wallets set coins = coins + 100 where user_id = <vainqueur>;
--   update wallets set coins = coins + 30  where user_id = <perdant>;
-- (dans la limite des 10 matchs classés par jour déjà en place)
