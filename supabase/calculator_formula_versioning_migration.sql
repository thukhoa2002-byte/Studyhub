-- Calculator formula versioning foundation. Do not run automatically.
-- Prerequisite: calculator_foundation_migration.sql.
-- This is additive only; it does not alter legacy handler_key behavior.
begin;

alter table public.calculators
  add column if not exists calculator_topic_key text,
  add column if not exists default_method_key text,
  add column if not exists enabled_method_keys jsonb not null default '[]'::jsonb,
  add column if not exists comparison_enabled boolean not null default false;

create index if not exists calculators_topic_method_idx
  on public.calculators (calculator_topic_key, default_method_key)
  where calculator_topic_key is not null;

comment on column public.calculators.calculator_topic_key is
  'Stable source-code topic key. Formula executable logic remains in source code.';
comment on column public.calculators.default_method_key is
  'Stable source-code method key; changing it does not overwrite historical implementation versions.';
comment on column public.calculators.enabled_method_keys is
  'Display/configuration metadata only. Each executable method is resolved from source code.';

commit;

-- Rollback (run only after confirming no rows depend on these columns):
-- begin;
-- drop index if exists public.calculators_topic_method_idx;
-- alter table public.calculators
--   drop column if exists comparison_enabled,
--   drop column if exists enabled_method_keys,
--   drop column if exists default_method_key,
--   drop column if exists calculator_topic_key;
-- commit;
