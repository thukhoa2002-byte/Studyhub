create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cardsnày ảh (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  front text not null,
  back text not null,
  category text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.card_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  rating integer not null check (rating between 1 and 4),
  due_at timestamptz,
  last_reviewed_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table if not exists public.deck_members (
  deck_id uuid not null references public.decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);

create or replace function public.share_deck_with_email(p_deck_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from public.decks where id = p_deck_id and owner_id = auth.uid()) then
    raise exception 'Only the deck owner can share it';
  end if;
  insert into public.deck_members(deck_id, user_id)
  select p_deck_id, id from auth.users where lower(email) = lower(trim(p_email))
  on conflict do nothing;
end;
$$;
grant execute on function public.share_deck_with_email(uuid, text) to authenticated;

alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.card_reviews enable row level security;
alter table public.deck_members enable row level security;

create policy "read shared or owned decks" on public.decks for select using (owner_id = auth.uid() or exists (select 1 from public.deck_members where deck_members.deck_id = decks.id and deck_members.user_id = auth.uid()));
create policy "create own decks" on public.decks for insert with check (owner_id = auth.uid());
create policy "update own decks" on public.decks for update using (owner_id = auth.uid());
create policy "delete own decks" on public.decks for delete using (owner_id = auth.uid());

create policy "read cards from visible decks" on public.cards for select using (exists (select 1 from public.decks where decks.id = cards.deck_id and (decks.owner_id = auth.uid() or exists (select 1 from public.deck_members where deck_members.deck_id = decks.id and deck_members.user_id = auth.uid()))));
create policy "create cards in own decks" on public.cards for insert with check (exists (select 1 from public.decks where decks.id = cards.deck_id and decks.owner_id = auth.uid()));
create policy "update cards in own decks" on public.cards for update using (exists (select 1 from public.decks where decks.id = cards.deck_id and decks.owner_id = auth.uid()));
create policy "delete cards in own decks" on public.cards for delete using (exists (select 1 from public.decks where decks.id = cards.deck_id and decks.owner_id = auth.uid()));

create policy "read own reviews" on public.card_reviews for select using (user_id = auth.uid());
create policy "create own reviews" on public.card_reviews for insert with check (user_id = auth.uid());
create policy "update own reviews" on public.card_reviews for update using (user_id = auth.uid());
create policy "owners manage deck members" on public.deck_members for all using (exists (select 1 from public.decks where decks.id = deck_members.deck_id and decks.owner_id = auth.uid()));
create policy "members can read membership" on public.deck_members for select using (user_id = auth.uid() or exists (select 1 from public.decks where decks.id = deck_members.deck_id and decks.owner_id = auth.uid()));
