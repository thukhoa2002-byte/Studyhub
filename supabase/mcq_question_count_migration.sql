-- Keep the MCQ library list lightweight while exposing the real question count.
alter table public.mcq_banks
  add column if not exists question_count integer
  generated always as (jsonb_array_length(questions)) stored;
