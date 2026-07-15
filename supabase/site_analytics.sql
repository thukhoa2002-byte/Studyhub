-- Run this file once in Supabase > SQL Editor.
-- Raw visit records are never readable from the browser. Only the configured
-- analytics administrator can call the aggregate reporting function.

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visitor_key text not null check (char_length(visitor_key) between 8 and 128),
  visited_at timestamptz not null default now()
);

create index if not exists site_visits_visited_at_idx on public.site_visits (visited_at desc);
create index if not exists site_visits_visitor_key_idx on public.site_visits (visitor_key);

alter table public.site_visits enable row level security;
revoke all on table public.site_visits from anon, authenticated;

create or replace function public.record_site_visit(p_visitor_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor_key is null or char_length(trim(p_visitor_key)) not between 8 and 128 then
    raise exception 'Invalid visitor key';
  end if;

  insert into public.site_visits (visitor_key)
  values (trim(p_visitor_key));
end;
$$;

revoke all on function public.record_site_visit(text) from public;
grant execute on function public.record_site_visit(text) to anon, authenticated;

create or replace function public.get_site_analytics()
returns table(total_visits bigint, unique_visitors bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null
     or lower(coalesce(auth.jwt() ->> 'email', '')) <> 'thukhoa2002@gmail.com' then
    raise exception 'Analytics access denied' using errcode = '42501';
  end if;

  return query
  select count(*)::bigint, count(distinct site_visits.visitor_key)::bigint
  from public.site_visits;
end;
$$;

revoke all on function public.get_site_analytics() from public;
grant execute on function public.get_site_analytics() to authenticated;
