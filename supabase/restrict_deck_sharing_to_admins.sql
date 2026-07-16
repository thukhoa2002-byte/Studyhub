-- Run once in Supabase > SQL Editor.
-- Editing cards does not grant permission to invite other members.
-- Only the deck owner or a member with role = 'admin' can share the deck.

create or replace function public.share_deck_with_email(p_deck_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to share a deck' using errcode = '42501';
  end if;

  if v_email = '' then
    raise exception 'Email is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.decks d
    where d.id = p_deck_id
      and (
        d.owner_id = auth.uid()
        or exists (
          select 1
          from public.deck_members dm
          where dm.deck_id = p_deck_id
            and dm.user_id = auth.uid()
            and dm.role = 'admin'
        )
      )
  ) then
    raise exception 'Only the deck owner or an administrator can invite members'
      using errcode = '42501';
  end if;

  insert into public.deck_share_invites(deck_id, email)
  values (p_deck_id, v_email)
  on conflict do nothing;

  insert into public.deck_members(deck_id, user_id)
  select p_deck_id, u.id
  from auth.users u
  where lower(u.email) = v_email
  on conflict do nothing;
end;
$$;

revoke all on function public.share_deck_with_email(uuid, text) from public;
grant execute on function public.share_deck_with_email(uuid, text) to authenticated;
