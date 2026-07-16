create table if not exists public.mcq_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_key text not null,
  current_index integer not null default 0 check (current_index >= 0),
  answers jsonb not null default '{}'::jsonb,
  checked jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_key)
);

alter table public.mcq_progress enable row level security;

drop policy if exists "users read own mcq progress" on public.mcq_progress;
create policy "users read own mcq progress" on public.mcq_progress
  for select using (user_id = auth.uid());

drop policy if exists "users create own mcq progress" on public.mcq_progress;
create policy "users create own mcq progress" on public.mcq_progress
  for insert with check (user_id = auth.uid());

drop policy if exists "users update own mcq progress" on public.mcq_progress;
create policy "users update own mcq progress" on public.mcq_progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
