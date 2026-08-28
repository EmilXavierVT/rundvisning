create extension if not exists pgcrypto;

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  tour_code text not null,
  question_key text not null,
  question_label text not null,
  answer_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists answers_tour_code_created_at_idx
  on public.answers (tour_code, created_at);

alter table public.answers enable row level security;

create policy "Anyone can read answers"
  on public.answers
  for select
  to anon
  using (true);

create policy "Anyone can insert answers"
  on public.answers
  for insert
  to anon
  with check (
    char_length(tour_code) between 1 and 60
    and char_length(question_key) between 1 and 80
    and char_length(question_label) between 1 and 500
    and char_length(answer_text) between 1 and 2000
  );

alter publication supabase_realtime add table public.answers;
