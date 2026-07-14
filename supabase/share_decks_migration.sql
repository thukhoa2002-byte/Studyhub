create table if not exists public.deck_members (
  deck_id uuid not null references public.decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);
alter table public.deck_members enable row level security;

create or replace function public.share_deck_with_email(p_deck_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from public.decks where id = p_deck_id and owner_id = auth.uid()) then raise exception 'Only the deck owner can share it'; end if;
  insert into public.deck_members(deck_id, user_id)
  select p_deck_id, id from auth.users where lower(email) = lower(trim(p_email)) on conflict do nothing;
end; $$;
grant execute on function public.share_deck_with_email(uuid, text) to authenticated;

drop policy if exists "read shared or owned decks" on public.decks;
create policy "read shared or owned decks" on public.decks for select using (owner_id = auth.uid() or exists (select 1 from public.deck_members where deck_members.deck_id = decks.id and deck_members.user_id = auth.uid()));
drop policy if exists "read cards from visible decks" on public.cards;
create policy "read cards from visible decks" on public.cards for select using (exists (select 1 from public.decks where decks.id = cards.deck_id and (decks.owner_id = auth.uid() or exists (select 1 from public.deck_members where deck_members.deck_id = decks.id and deck_members.user_id = auth.uid()))));
drop policy if exists "owners manage deck members" on public.deck_members;
create policy "owners manage deck members" on public.deck_members for all using (exists (select 1 from public.decks where decks.id = deck_members.deck_id and decks.owner_id = auth.uid()));
drop policy if exists "members can read membership" on public.deck_members;
create policy "members can read membership" on public.deck_members for select using (user_id = auth.uid() or exists (select 1 from public.decks where decks.id = deck_members.deck_id and decks.owner_id = auth.uid()));
