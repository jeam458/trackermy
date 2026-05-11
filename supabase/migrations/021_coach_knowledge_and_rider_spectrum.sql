-- Biblioteca de coaching (árbol multi-nivel, crece en BD) + espectro agregado por rider para personalización del guía.

-- ============================================
-- 1. Nodos de conocimiento (mismo esquema lógico que el seed JSON)
-- ============================================
CREATE TABLE IF NOT EXISTS public.coach_knowledge_nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES public.coach_knowledge_nodes (id) ON DELETE SET NULL,
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 8),
  title_es TEXT NOT NULL,
  summary_es TEXT NOT NULL,
  practice_cues JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  evidence_strength TEXT NOT NULL CHECK (
    evidence_strength IN ('literature_synthesis', 'practice_consensus', 'program_design_meta')
  ),
  citation_label_es TEXT NOT NULL,
  source_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_knowledge_nodes_parent ON public.coach_knowledge_nodes (parent_id)
WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coach_knowledge_nodes_active ON public.coach_knowledge_nodes (is_active)
WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_coach_knowledge_nodes_tags ON public.coach_knowledge_nodes USING gin (tags);

ALTER TABLE public.coach_knowledge_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_knowledge_nodes_select_auth" ON public.coach_knowledge_nodes;
CREATE POLICY "coach_knowledge_nodes_select_auth" ON public.coach_knowledge_nodes FOR
SELECT TO authenticated USING (is_active = true);

-- Inserción/actualización de nodos: usar service_role (Supabase) o SQL en migraciones desde herramientas admin.

-- ============================================
-- 2. Espectro / resumen coaching por rider (derivado de route_attempts)
-- ============================================
CREATE TABLE IF NOT EXISTS public.rider_coach_spectrum (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  spectrum JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggested_coach_level TEXT,
  attempts_in_window INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rider_coach_spectrum_computed ON public.rider_coach_spectrum (computed_at DESC);

ALTER TABLE public.rider_coach_spectrum ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rider_coach_spectrum_own_select" ON public.rider_coach_spectrum;
CREATE POLICY "rider_coach_spectrum_own_select" ON public.rider_coach_spectrum FOR
SELECT TO authenticated USING (auth.uid () = user_id);

DROP POLICY IF EXISTS "rider_coach_spectrum_own_upsert" ON public.rider_coach_spectrum;
CREATE POLICY "rider_coach_spectrum_own_upsert" ON public.rider_coach_spectrum FOR INSERT TO authenticated WITH CHECK (auth.uid () = user_id);

DROP POLICY IF EXISTS "rider_coach_spectrum_own_update" ON public.rider_coach_spectrum;
CREATE POLICY "rider_coach_spectrum_own_update" ON public.rider_coach_spectrum FOR
UPDATE TO authenticated USING (auth.uid () = user_id)
WITH CHECK (auth.uid () = user_id);

-- ============================================
-- 3. Seed inicial (mismo contenido base que coachKnowledgeTree.seed.json)
-- ============================================
INSERT INTO public.coach_knowledge_nodes (
    id,
    parent_id,
    level,
    title_es,
    summary_es,
    practice_cues,
    tags,
    evidence_strength,
    citation_label_es,
    source_url,
    sort_order
  )
VALUES (
    'gdh.linea',
    NULL,
    1,
    'Línea, visión y modulación de frenos',
    'Eje raíz: una intención clara por tramo, lectura temprana y frenos progresivos alineados a la pendiente y al grip disponible.',
    '[]'::jsonb,
    ARRAY['linea_freno', 'replay_coach', 'attempt_stats', 'record_coach']::TEXT[],
    'practice_consensus',
    'Síntesis de manuales técnicos DH/enduro y clínicas de skills (consenso de práctica, no estudio individual del rider).',
    NULL,
    10
  ),
  (
    'gdh.linea.anticipacion_visual',
    'gdh.linea',
    2,
    'Anticipación visual y referencias lejanas',
    'En deportes interceptivos, fijaciones estables y tempranas sobre la trayectoria deseada se asocian con mejor toma de decisión bajo tiempo limitado; en bajada se traduce en mirar la salida y el corredor, no el obstáculo inmediato bajo la rueda.',
    '["Elegí un punto de salida antes de encajar", "Evitá seguir con la vista solo el bulón delantero en la curva"]'::jsonb,
    ARRAY['linea_freno', 'replay_coach', 'attempt_stats']::TEXT[],
    'literature_synthesis',
    'Marco teórico alineado a revisiones sobre atención visual y acción interceptiva (p. ej. literatura tipo «quiet eye» en deportes de precisión); aplicación a MTB es inferencia práctica controlada.',
    NULL,
    11
  ),
  (
    'gdh.linea.freno_progresivo',
    'gdh.linea',
    2,
    'Freno progresivo y un gesto por pliegue',
    'Modulación larga reduce patinado y carga ciclica en el neumático; un bloque de freno claro antes del pliegue suele rendir mejor que varios pellizcos dentro de la curva cuando hay grip.',
    '["Una palanca de freno antes del ápice, soltar progresivo al salir", "Si el terreno suelta, acortá el bloque y repetí intención en el siguiente tramo"]'::jsonb,
    ARRAY['linea_freno', 'replay_coach', 'record_coach']::TEXT[],
    'practice_consensus',
    'Consenso técnico de instructores de gravity bike y biomecánica aplicada a tracción/frenado (síntesis interna).',
    NULL,
    12
  ),
  (
    'gdh.ritmo',
    NULL,
    1,
    'Ritmo, pendiente y carga de ruedas',
    'El ritmo efectivo integra lectura de pendiente, distribución de peso y velocidad de entrada; no es solo «más rápido», sino coincidir intención con el tramo.',
    '[]'::jsonb,
    ARRAY['ritmo_desnivel', 'replay_coach', 'attempt_stats']::TEXT[],
    'practice_consensus',
    'Síntesis de coaching de carrera DH/XC orientado a lectura de terreno (no prescripción médica).',
    NULL,
    20
  ),
  (
    'gdh.ritmo.pendiente_velocidad',
    'gdh.ritmo',
    2,
    'Pendiente y velocidad de entrada',
    'Trabajos sobre pacing en deportes de inercia sugieren ajustar la velocidad de entrada al radio visible y al margen de error del rider; en DH implica segmentar la bajada en bloques con objetivo explícito por curva o sección.',
    '["Nombrá en voz baja el objetivo del próximo bloque (ej. «suelto freno hasta el pino»)", "Si la pendiente cambia, recalibrá antes de que la curva te lo exija"]'::jsonb,
    ARRAY['ritmo_desnivel', 'replay_coach']::TEXT[],
    'literature_synthesis',
    'Marco de pacing y segmentación inspirado en literatura de control motor y deportes de velocidad; adaptación a trail es heurística GuardDH.',
    NULL,
    21
  ),
  (
    'gdh.postura',
    NULL,
    1,
    'Postura: base, manos y cadera',
    'Una base estable con carga en pies y manos ligeras mejora el rango útil de dirección y reduce sobre-freno por tensión en brazos.',
    '[]'::jsonb,
    ARRAY['postura_manos', 'replay_coach', 'attempt_stats', 'record_coach']::TEXT[],
    'practice_consensus',
    'Consenso de biomecánica aplicada a ciclismo de montaña (posición neutral atacable; síntesis interna).',
    NULL,
    30
  ),
  (
    'gdh.postura.manos_pies',
    'gdh.postura',
    2,
    'Manos sueltas y peso en pies',
    'Presión excesiva en manos limita sensibilidad delantero y favorece micro-frenos; el peso en pies permite micro-ajustes de ángulo de cadera sin bloquear codos.',
    '["Comprobá que podés flexionar un poco los dedos en el manillar al entrar", "Pensá en empujar el suelo con los pies en la curva, no en apretar el manillar"]'::jsonb,
    ARRAY['postura_manos', 'replay_coach', 'record_coach']::TEXT[],
    'practice_consensus',
    'Transferencia desde literatura de control postural en ciclismo y práctica de skills gravity (síntesis).',
    NULL,
    31
  ),
  (
    'gdh.habitos',
    NULL,
    1,
    'Constancia, volumen y aprendizaje',
    'La mejora sostenida combina volumen prudente, variación de estímulo y revisión de errores recurrentes; los riders con más horas suelen beneficiarse de focalizar un solo hábito por sesión.',
    '[]'::jsonb,
    ARRAY['habitos_constancia', 'replay_coach', 'activity_coach', 'attempt_stats']::TEXT[],
    'program_design_meta',
    'Principios de periodización y carga del entrenamiento deportivo (meta-análisis y guías generales; no sustituye plan individual con profesional).',
    NULL,
    40
  ),
  (
    'gdh.habitos.un_habito_por_sesion',
    'gdh.habitos',
    2,
    'Un hábito técnico por salida',
    'La evidencia de aprendizaje motor favorece la práctica deliberada con retroalimentación específica; en trail, repetir un solo foco (mirada, un solo dedo de freno, salida ancha) por vuelta aumenta retención frente a listas largas.',
    '["Elegí un solo foco antes de subir al shuttle o pedalear", "Al terminar, anotá si cumpliste el foco, no el tiempo"]'::jsonb,
    ARRAY['habitos_constancia', 'activity_coach', 'replay_coach']::TEXT[],
    'literature_synthesis',
    'Alineado a literatura de práctica deliberada y aprendizaje motor (síntesis; no evalúa tu progreso real sin datos).',
    NULL,
    41
  ),
  (
    'gdh.habitos.recuperacion',
    'gdh.habitos',
    2,
    'Fatiga y calidad de repeticiones',
    'Con fatiga alta, la coordinación fina empeora; en periodización moderna se prioriza calidad de pocas repeticiones vs volumen ciego cuando el riesgo de error aumenta.',
    '["Si repetís el mismo error cansado, cortá bloque técnico y volvé con frescura", "Intercalá días ligeros después de picos de impacto o muchas bajadas"]'::jsonb,
    ARRAY['habitos_constancia', 'activity_coach', 'attempt_stats']::TEXT[],
    'program_design_meta',
    'Referencias generales de gestión de fatiga y riesgo en deportes de impacto (síntesis; no es consejo médico).',
    NULL,
    42
  ),
  (
    'gdh.seguridad.margen',
    NULL,
    1,
    'Margen de error y lectura de riesgo',
    'Profesionales priorizan margen visual y de velocidad sobre el límite absoluto; el coach debe reflejar eso cuando los datos marcan velocidad o tramo comprometido.',
    '["Si no ves la salida, el margen correcto suele ser frenar antes, no «confiar»", "Aumentá radio de entrada cuando el grip o la visibilidad son dudosos"]'::jsonb,
    ARRAY['linea_freno', 'ritmo_desnivel', 'replay_coach', 'record_coach', 'attempt_stats']::TEXT[],
    'practice_consensus',
    'Protocolos de seguridad y coaching de alto rendimiento en gravity (síntesis interna).',
    NULL,
    50
  ) ON CONFLICT (id) DO NOTHING;
