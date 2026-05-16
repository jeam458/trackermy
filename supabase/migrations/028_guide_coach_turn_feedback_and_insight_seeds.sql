-- Feedback discreto del rider sobre turnos del coach (sin almacenar el texto completo del mensaje).
create table if not exists public.guide_coach_turn_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  screen_kind text not null,
  sentiment smallint not null check (sentiment in (-1, 1)),
  created_at timestamptz not null default now()
);

create index if not exists guide_coach_turn_feedback_user_created_idx
  on public.guide_coach_turn_feedback (user_id, created_at desc);

alter table public.guide_coach_turn_feedback enable row level security;

create policy "guide_coach_turn_feedback_own_insert"
  on public.guide_coach_turn_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "guide_coach_turn_feedback_own_select"
  on public.guide_coach_turn_feedback for select
  to authenticated
  using (auth.uid() = user_id);

-- Semillas opcionales para aggregate_insights (mejor arranque del tono por pantalla).
insert into public.guide_coach_aggregate_insights (screen_kind, insight_key, insight_es, score)
values
  (
    'dashboard_home',
    'seed_volumen_semana',
    'Muchxs riders miran primero el volumen de la semana y después eligen ruta.',
    3
  ),
  (
    'profile',
    'seed_bici_contexto',
    'Anotar marca, modelo y kilometraje aproximado ayuda a calibrar mantenimiento y próximos retos.',
    2
  ),
  (
    'activity',
    'seed_constancia',
    'Un mínimo semanal modesto que se cumple varias semanas seguidas suele rendir más que picos sueltos.',
    3
  ),
  (
    'route_detail',
    'seed_ficha_ruta',
    'En ficha: combinar desnivel, dificultad y tu historial reciente en la zona suele decidir mejor que el nombre solo.',
    2
  )
on conflict (screen_kind, insight_key) do update
set
  insight_es = excluded.insight_es,
  score = greatest(public.guide_coach_aggregate_insights.score, excluded.score),
  last_seen_at = now();
