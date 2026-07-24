-- Calculator reset: data only. Do not run as part of a schema migration.
-- Run this manually with database-owner/service-role privileges after making
-- a database export. It intentionally preserves the table and RLS schema.
begin;
delete from public.reference_formulas;
commit;
