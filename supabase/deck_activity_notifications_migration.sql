-- Notify members when another member adds a shared flashcard.
create table if not exists public.deck_activity_notifications (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text not null default 'Một thành viên',
  event_type text not null default 'card_added' check (event_type in ('card_added')),
  created_at timestamptz not null default now()
);

create table if not exists public.deck_activity_notification_reads (
  notification_id uuid not null references public.deck_activity_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists public.deck_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists deck_activity_notifications_deck_created_idx
  on public.deck_activity_notifications(deck_id, created_at desc);
create index if not exists deck_activity_notification_reads_user_idx
  on public.deck_activity_notification_reads(user_id, notification_id);

alter table public.deck_activity_notifications enable row level security;
alter table public.deck_activity_notification_reads enable row level security;
alter table public.deck_notification_preferences enable row level security;

drop policy if exists "members read shared deck activity" on public.deck_activity_notifications;
create policy "members read shared deck activity" on public.deck_activity_notifications for select using (
  actor_id is distinct from auth.uid()
  and exists (
    select 1 from public.decks d
    where d.id = deck_activity_notifications.deck_id
      and (d.owner_id = auth.uid() or exists (
        select 1 from public.deck_members dm
        where dm.deck_id = d.id and dm.user_id = auth.uid()
      ))
  )
);

drop policy if exists "users read own notification state" on public.deck_activity_notification_reads;
create policy "users read own notification state" on public.deck_activity_notification_reads for select using (user_id = auth.uid());
drop policy if exists "users mark own notifications read" on public.deck_activity_notification_reads;
create policy "users mark own notifications read" on public.deck_activity_notification_reads for insert with check (user_id = auth.uid());
drop policy if exists "users update own notification state" on public.deck_activity_notification_reads;
create policy "users update own notification state" on public.deck_activity_notification_reads for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users read own notification preference" on public.deck_notification_preferences;
create policy "users read own notification preference" on public.deck_notification_preferences for select using (user_id = auth.uid());
drop policy if exists "users insert own notification preference" on public.deck_notification_preferences;
create policy "users insert own notification preference" on public.deck_notification_preferences for insert with check (user_id = auth.uid());
drop policy if exists "users update own notification preference" on public.deck_notification_preferences;
create policy "users update own notification preference" on public.deck_notification_preferences for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.create_shared_card_notification()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_visibility text;
  v_actor uuid;
  v_actor_label text;
begin
  if coalesce(to_jsonb(new)->>'scope', 'shared') <> 'shared' then return new; end if;
  select visibility into v_visibility from public.decks where id = new.deck_id;
  if v_visibility <> 'shared' then return new; end if;
  -- Initial cards are inserted before a deck is shared. Only create activity
  -- after at least one member has joined, otherwise a new recipient would see
  -- a flood of old "card added" messages on first login.
  if not exists (select 1 from public.deck_members dm where dm.deck_id = new.deck_id) then return new; end if;

  v_actor := auth.uid();
  v_actor_label := coalesce(nullif(to_jsonb(new)->>'creator_label', ''), auth.jwt()->>'email', 'Một thành viên');
  insert into public.deck_activity_notifications(deck_id, card_id, actor_id, actor_label)
  values (new.deck_id, new.id, v_actor, v_actor_label);
  return new;
end;
$$;

drop trigger if exists notify_shared_card_added on public.cards;
create trigger notify_shared_card_added
after insert on public.cards
for each row execute function public.create_shared_card_notification();

grant select on public.deck_activity_notifications to authenticated;
grant select, insert, update on public.deck_activity_notification_reads to authenticated;
grant select, insert, update on public.deck_notification_preferences to authenticated;
