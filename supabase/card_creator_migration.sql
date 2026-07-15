-- Record and display who added each flashcard in a shared deck.

alter table public.cards add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.cards add column if not exists creator_label text;

-- Existing cards belong to the original deck owner.
update public.cards c
set created_by = d.owner_id,
    creator_label = coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      u.email,
      'Chủ bộ thẻ'
    )
from public.decks d
left join auth.users u on u.id = d.owner_id
where c.deck_id = d.id
  and (c.created_by is null or c.creator_label is null);

create or replace function public.set_card_creator()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.created_by := auth.uid();
  new.creator_label := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    nullif(auth.jwt() ->> 'email', ''),
    'Thành viên'
  );
  return new;
end;
$$;

drop trigger if exists set_card_creator_before_insert on public.cards;
create trigger set_card_creator_before_insert
before insert on public.cards
for each row execute function public.set_card_creator();
