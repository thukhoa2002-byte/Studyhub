drop policy if exists "owners manage deck members" on public.deck_members;
drop policy if exists "members can read membership" on public.deck_members;
create policy "owners manage deck members" on public.deck_members for all using (user_id = auth.uid());
create policy "members can read membership" on public.deck_members for select using (user_id = auth.uid());