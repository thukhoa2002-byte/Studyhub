create table if not exists public.deck_members (
  deck_id uuid not null references public.decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);
alter table public.deck_members add column if not exists role text not null default 'member';
alter table public.deck_members add column if not exists access text not null default 'view';
alter table public.deck_members drop constraint if exists deck_members_role_check;
alter table public.deck_members add constraint deck_members_role_check check (role in ('admin', 'member'));
alter table public.deck_members drop constraint if exists deck_members_access_check;
alter table public.deck_members add constraint deck_members_access_check check (access in ('edit', 'view'));
alter table public.deck_members enable row level security;

create table if not exists public.deck_share_invites (
  deck_id uuid not null references public.decks(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (deck_id, email)
);
alter table public.deck_share_invites enable row level security;

create or replace function public.share_deck_with_email(p_deck_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from public.decks where id = p_deck_id and (owner_id = auth.uid() or exists (select 1 from public.deck_members dm where dm.deck_id = p_deck_id and dm.user_id = auth.uid() and dm.role = 'admin'))) then raise exception 'Only an administrator can share this deck'; end if;
  insert into public.deck_share_invites(deck_id, email)
  values (p_deck_id, lower(trim(p_email))) on conflict do nothing;
  insert into public.deck_members(deck_id, user_id)
  select p_deck_id, id from auth.users where lower(email) = lower(trim(p_email)) on conflict do nothing;
end; $$;
grant execute on function public.share_deck_with_email(uuid, text) to authenticated;

create or replace function public.claim_pending_deck_shares()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.deck_members(deck_id, user_id)
  select i.deck_id, auth.uid()
  from public.deck_share_invites i
  join auth.users u on u.id = auth.uid() and lower(u.email) = i.email
  on conflict do nothing;
end; $$;
grant execute on function public.claim_pending_deck_shares() to authenticated;

drop function if exists public.list_deck_members(uuid);
create or replace function public.list_deck_members(p_deck_id uuid)
returns table(user_id uuid, email text, role text, access text, is_owner boolean)
language sql security definer set search_path = public, auth as $$
  select d.owner_id, u.email::text, 'admin'::text, 'edit'::text, true
  from public.decks d join auth.users u on u.id = d.owner_id
  where d.id = p_deck_id and (d.owner_id = auth.uid() or exists (select 1 from public.deck_members x where x.deck_id = p_deck_id and x.user_id = auth.uid() and x.role = 'admin'))
  union
  select dm.user_id, i.email, dm.role, dm.access, false
  from public.deck_share_invites i
  join public.deck_members dm on dm.deck_id = i.deck_id
    and exists (select 1 from auth.users u where u.id = dm.user_id and lower(u.email) = i.email)
  where i.deck_id = p_deck_id
    and exists (select 1 from public.decks d where d.id = p_deck_id and (d.owner_id = auth.uid() or exists (select 1 from public.deck_members x where x.deck_id = p_deck_id and x.user_id = auth.uid() and x.role = 'admin')))
  union
  select dm.user_id, u.email::text, dm.role, dm.access, false
  from public.deck_members dm join auth.users u on u.id = dm.user_id
  where dm.deck_id = p_deck_id
    and exists (select 1 from public.decks d where d.id = p_deck_id and (d.owner_id = auth.uid() or exists (select 1 from public.deck_members x where x.deck_id = p_deck_id and x.user_id = auth.uid() and x.role = 'admin')))
    and not exists (select 1 from public.deck_share_invites i where i.deck_id = p_deck_id and i.email = lower(u.email))
  union
  select null::uuid, i.email, 'member'::text, 'view'::text, false
  from public.deck_share_invites i
  where i.deck_id = p_deck_id
    and exists (select 1 from public.decks d where d.id = p_deck_id and (d.owner_id = auth.uid() or exists (select 1 from public.deck_members x where x.deck_id = p_deck_id and x.user_id = auth.uid() and x.role = 'admin')))
    and not exists (select 1 from public.deck_members dm where dm.deck_id = i.deck_id and exists (select 1 from auth.users u where u.id = dm.user_id and lower(u.email) = i.email));
$$;
grant execute on function public.list_deck_members(uuid) to authenticated;

create or replace function public.remove_deck_share(p_deck_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from public.decks where id = p_deck_id and (owner_id = auth.uid() or exists (select 1 from public.deck_members dm where dm.deck_id = p_deck_id and dm.user_id = auth.uid() and dm.role = 'admin'))) then
    raise exception 'Only an administrator can stop sharing it';
  end if;
  delete from public.deck_share_invites where deck_id = p_deck_id and email = lower(trim(p_email));
  delete from public.deck_members dm using auth.users u
    where dm.deck_id = p_deck_id and dm.user_id = u.id and lower(u.email) = lower(trim(p_email));
end; $$;
grant execute on function public.remove_deck_share(uuid, text) to authenticated;

create or replace function public.remove_deck_member(p_deck_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from public.decks where id = p_deck_id and owner_id = auth.uid()) then
    raise exception 'Only the deck owner can stop sharing it';
  end if;
  delete from public.deck_members where deck_id = p_deck_id and user_id = p_user_id;
end; $$;
grant execute on function public.remove_deck_member(uuid, uuid) to authenticated;

create or replace function public.set_deck_member_role(p_deck_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if p_role not in ('admin', 'member') then raise exception 'Invalid deck role'; end if;
  if not exists (select 1 from public.decks where id = p_deck_id and (owner_id = auth.uid() or exists (select 1 from public.deck_members dm where dm.deck_id = p_deck_id and dm.user_id = auth.uid() and dm.role = 'admin'))) then
    raise exception 'Only an administrator can change member roles';
  end if;
  if p_user_id = auth.uid() then raise exception 'The owner role cannot be changed'; end if;
  update public.deck_members set role = p_role where deck_id = p_deck_id and user_id = p_user_id;
end; $$;
grant execute on function public.set_deck_member_role(uuid, uuid, text) to authenticated;

create or replace function public.set_deck_member_access(p_deck_id uuid, p_user_id uuid, p_access text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if p_access not in ('edit', 'view') then raise exception 'Invalid deck access'; end if;
  if not exists (select 1 from public.decks where id = p_deck_id and (owner_id = auth.uid() or exists (select 1 from public.deck_members dm where dm.deck_id = p_deck_id and dm.user_id = auth.uid() and dm.role = 'admin'))) then
    raise exception 'Only an administrator can change access';
  end if;
  if p_user_id = auth.uid() then raise exception 'The owner access cannot be changed'; end if;
  update public.deck_members set access = p_access where deck_id = p_deck_id and user_id = p_user_id and role = 'admin';
end; $$;
grant execute on function public.set_deck_member_access(uuid, uuid, text) to authenticated;

drop policy if exists "read shared or owned decks" on public.decks;
create policy "read shared or owned decks" on public.decks for select using (owner_id = auth.uid() or exists (select 1 from public.deck_members where deck_members.deck_id = decks.id and deck_members.user_id = auth.uid()));
drop policy if exists "read cards from visible decks" on public.cards;
create policy "read cards from visible decks" on public.cards for select using (exists (select 1 from public.decks where decks.id = cards.deck_id and (decks.owner_id = auth.uid() or exists (select 1 from public.deck_members where deck_members.deck_id = decks.id and deck_members.user_id = auth.uid()))));
drop policy if exists "owners manage deck members" on public.deck_members;
create policy "owners manage deck members" on public.deck_members for all using (user_id = auth.uid());
drop policy if exists "members can read membership" on public.deck_members;
create policy "members can read membership" on public.deck_members for select using (user_id = auth.uid());
