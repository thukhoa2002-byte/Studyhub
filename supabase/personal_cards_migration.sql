-- Personal cards inside a shared deck.
-- Shared content remains common, while cards with scope = 'personal' are only
-- visible to the account that created them.

alter table public.cards add column if not exists scope text not null default 'shared';
alter table public.cards add column if not exists personal_owner_id uuid references auth.users(id) on delete cascade;
alter table public.cards drop constraint if exists cards_scope_check;
alter table public.cards add constraint cards_scope_check check (scope in ('shared', 'personal'));
alter table public.cards drop constraint if exists cards_personal_owner_check;
alter table public.cards add constraint cards_personal_owner_check check (
  (scope = 'shared' and personal_owner_id is null)
  or (scope = 'personal' and personal_owner_id is not null)
);

alter table public.cards enable row level security;

drop policy if exists "read cards from visible decks" on public.cards;
create policy "read cards from visible decks" on public.cards for select using (
  (scope = 'shared' or personal_owner_id = auth.uid())
  and exists (
    select 1 from public.decks d
    where d.id = cards.deck_id
      and (
        d.owner_id = auth.uid()
        or exists (
          select 1 from public.deck_members dm
          where dm.deck_id = d.id and dm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "create cards in own decks" on public.cards;
drop policy if exists "update cards in own decks" on public.cards;
drop policy if exists "delete cards in own decks" on public.cards;
drop policy if exists "edit cards in shared decks" on public.cards;
drop policy if exists "manage shared cards" on public.cards;
drop policy if exists "manage own personal cards" on public.cards;

create policy "manage shared cards" on public.cards for all using (
  scope = 'shared'
  and exists (
    select 1 from public.decks d
    where d.id = cards.deck_id
      and (
        d.owner_id = auth.uid()
        or exists (
          select 1 from public.deck_members dm
          where dm.deck_id = d.id and dm.user_id = auth.uid()
            and (dm.role = 'admin' or dm.access = 'edit')
        )
      )
  )
) with check (
  scope = 'shared' and personal_owner_id is null
  and exists (
    select 1 from public.decks d
    where d.id = cards.deck_id
      and (
        d.owner_id = auth.uid()
        or exists (
          select 1 from public.deck_members dm
          where dm.deck_id = d.id and dm.user_id = auth.uid()
            and (dm.role = 'admin' or dm.access = 'edit')
        )
      )
  )
);

create policy "manage own personal cards" on public.cards for all using (
  scope = 'personal' and personal_owner_id = auth.uid()
) with check (
  scope = 'personal' and personal_owner_id = auth.uid()
  and exists (
    select 1 from public.decks d
    where d.id = cards.deck_id
      and (
        d.owner_id = auth.uid()
        or exists (
          select 1 from public.deck_members dm
          where dm.deck_id = d.id and dm.user_id = auth.uid()
        )
      )
  )
);
