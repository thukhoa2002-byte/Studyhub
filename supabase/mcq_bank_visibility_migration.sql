-- MCQ visibility metadata. This lets clients hide a private/removed built-in bank
-- without exposing the private questions themselves.
alter table public.mcq_banks drop constraint if exists mcq_banks_status_check;
alter table public.mcq_banks
  add constraint mcq_banks_status_check check (status in ('draft', 'published', 'archived'));

create or replace function public.list_mcq_bank_states()
returns table(id uuid, status text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select bank.id, bank.status
  from public.mcq_banks bank
  where bank.status in ('draft', 'published', 'archived');
$$;

revoke all on function public.list_mcq_bank_states() from public;
grant execute on function public.list_mcq_bank_states() to authenticated;
