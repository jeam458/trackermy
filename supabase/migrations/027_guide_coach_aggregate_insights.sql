-- Aprendizaje agregado del coach (sin PII obligatorio): frases cortas reutilizables por tipo de pantalla.
create table if not exists public.guide_coach_aggregate_insights (
  id uuid primary key default gen_random_uuid(),
  screen_kind text not null,
  insight_key text not null,
  insight_es text not null,
  score int not null default 1,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint guide_coach_aggregate_insights_screen_key unique (screen_kind, insight_key),
  constraint guide_coach_aggregate_insights_insight_len check (char_length(insight_es) <= 400),
  constraint guide_coach_aggregate_insights_score_pos check (score >= 1)
);

create index if not exists guide_coach_aggregate_insights_screen_score_idx
  on public.guide_coach_aggregate_insights (screen_kind, score desc);

alter table public.guide_coach_aggregate_insights enable row level security;

create policy "guide_coach_insights_select_auth"
  on public.guide_coach_aggregate_insights for select
  to authenticated
  using (true);

create policy "guide_coach_insights_insert_auth"
  on public.guide_coach_aggregate_insights for insert
  to authenticated
  with check (true);

create policy "guide_coach_insights_update_auth"
  on public.guide_coach_aggregate_insights for update
  to authenticated
  using (true)
  with check (true);
