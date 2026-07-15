-- Run this file once in Supabase > SQL Editor.
-- Raw visit records are never readable from the browser. Only the configured
-- analytics administrator can call the aggregate reporting function.

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visitor_key text not null check (char_length(visitor_key) between 8 and 128),
  user_id uuid references auth.users(id) on delete set null,
  visitor_label text,
  visited_at timestamptz not null default now()
);

alter table public.site_visits add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.site_visits add column if not exists visitor_label text;

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

  insert into public.site_visits (visitor_key, user_id, visitor_label)
  values (
    trim(p_visitor_key),
    auth.uid(),
    coalesce(
      nullif(lower(trim(auth.jwt() ->> 'email')), ''),
      'Khách • ' || upper(right(replace(trim(p_visitor_key), 'guest:', ''), 4))
    )
  );
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

create or replace function public.get_site_analytics_visitors()
returns table(visitor_key text, visitor_label text, visit_count bigint, last_visited_at timestamptz)
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
  select
    visits.visitor_key,
    coalesce(
      (array_agg(nullif(visits.visitor_label, '') order by visits.visited_at desc)
        filter (where nullif(visits.visitor_label, '') is not null))[1],
      max(users.email::text),
      case
        when visits.visitor_key like 'guest:%' then 'Khách • ' || upper(right(replace(visits.visitor_key, 'guest:', ''), 4))
        else 'Thành viên'
      end
    ) as visitor_label,
    count(*)::bigint as visit_count,
    max(visits.visited_at) as last_visited_at
  from public.site_visits visits
  left join auth.users users
    on users.id = visits.user_id
    or ('user:' || users.id::text) = visits.visitor_key
  group by visits.visitor_key
  order by max(visits.visited_at) desc;
end;
$$;

revoke all on function public.get_site_analytics_visitors() from public;
grant execute on function public.get_site_analytics_visitors() to authenticated;

create or replace function public.get_site_visit_history(p_limit integer default 100)
returns table(visit_id bigint, visitor_key text, visitor_label text, visited_at timestamptz)
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
  select
    visits.id,
    visits.visitor_key,
    coalesce(
      nullif(visits.visitor_label, ''),
      users.email::text,
      case
        when visits.visitor_key like 'guest:%' then 'Khách • ' || upper(right(replace(visits.visitor_key, 'guest:', ''), 4))
        else 'Thành viên'
      end
    ) as visitor_label,
    visits.visited_at
  from public.site_visits visits
  left join auth.users users
    on users.id = visits.user_id
    or ('user:' || users.id::text) = visits.visitor_key
  order by visits.visited_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.get_site_visit_history(integer) from public;
grant execute on function public.get_site_visit_history(integer) to authenticated;
