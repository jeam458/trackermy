-- Registro de emociones del pet + recetas de animación (JSON interpretado en cliente con lista blanca).
-- Las filas aprobadas complementan / sustituyen animaciones embebidas en código.
-- Propuestas (IA / usuario) entran en cola hasta merge manual o futuro flujo admin.

CREATE TABLE IF NOT EXISTS public.pet_emotion_definitions (
  slug TEXT PRIMARY KEY CHECK (char_length(trim(slug)) BETWEEN 2 AND 64),
  label_es TEXT NOT NULL DEFAULT '',
  atlas_slot INTEGER CHECK (atlas_slot IS NULL OR (atlas_slot >= 0 AND atlas_slot < 200)),
  focus_x DOUBLE PRECISION CHECK (focus_x IS NULL OR (focus_x >= 0 AND focus_x <= 100)),
  focus_y DOUBLE PRECISION CHECK (focus_y IS NULL OR (focus_y >= 0 AND focus_y <= 100)),
  zoom DOUBLE PRECISION CHECK (zoom IS NULL OR (zoom >= 0.5 AND zoom <= 4)),
  ambient_animations JSONB NOT NULL DEFAULT '[]'::jsonb,
  enter_animation JSONB,
  is_system BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_emotion_definitions_approved ON public.pet_emotion_definitions (approved, is_system);

CREATE TABLE IF NOT EXISTS public.pet_emotion_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL CHECK (char_length(trim(slug)) BETWEEN 2 AND 64),
  label_es TEXT NOT NULL DEFAULT '',
  focus_x DOUBLE PRECISION CHECK (focus_x IS NULL OR (focus_x >= 0 AND focus_x <= 100)),
  focus_y DOUBLE PRECISION CHECK (focus_y IS NULL OR (focus_y >= 0 AND focus_y <= 100)),
  zoom DOUBLE PRECISION CHECK (zoom IS NULL OR (zoom >= 0.5 AND zoom <= 4)),
  atlas_slot INTEGER CHECK (atlas_slot IS NULL OR (atlas_slot >= 0 AND atlas_slot < 200)),
  ambient_animations JSONB NOT NULL DEFAULT '[]'::jsonb,
  enter_animation JSONB,
  proposed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'rejected')),
  reviewer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_emotion_proposals_user ON public.pet_emotion_proposals (proposed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pet_emotion_proposals_status ON public.pet_emotion_proposals (status);

ALTER TABLE public.pet_emotion_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_emotion_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pet_emotion_definitions_select_approved" ON public.pet_emotion_definitions;
CREATE POLICY "pet_emotion_definitions_select_approved"
ON public.pet_emotion_definitions FOR SELECT
USING (auth.uid() IS NOT NULL AND approved = true);

DROP POLICY IF EXISTS "pet_emotion_definitions_insert_none" ON public.pet_emotion_definitions;
CREATE POLICY "pet_emotion_definitions_insert_none"
ON public.pet_emotion_definitions FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "pet_emotion_definitions_update_none" ON public.pet_emotion_definitions;
CREATE POLICY "pet_emotion_definitions_update_none"
ON public.pet_emotion_definitions FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "pet_emotion_definitions_delete_none" ON public.pet_emotion_definitions;
CREATE POLICY "pet_emotion_definitions_delete_none"
ON public.pet_emotion_definitions FOR DELETE
USING (false);

DROP POLICY IF EXISTS "pet_emotion_proposals_select_own" ON public.pet_emotion_proposals;
CREATE POLICY "pet_emotion_proposals_select_own"
ON public.pet_emotion_proposals FOR SELECT
USING (auth.uid() = proposed_by);

DROP POLICY IF EXISTS "pet_emotion_proposals_insert_own" ON public.pet_emotion_proposals;
CREATE POLICY "pet_emotion_proposals_insert_own"
ON public.pet_emotion_proposals FOR INSERT
WITH CHECK (auth.uid() = proposed_by);

DROP POLICY IF EXISTS "pet_emotion_proposals_update_own_pending" ON public.pet_emotion_proposals;
CREATE POLICY "pet_emotion_proposals_update_own_pending"
ON public.pet_emotion_proposals FOR UPDATE
USING (auth.uid() = proposed_by AND status = 'pending')
WITH CHECK (auth.uid() = proposed_by);

COMMENT ON TABLE public.pet_emotion_definitions IS 'Emociones del pet + recetas JSON de animación (animejs vía runner con lista blanca en app).';
COMMENT ON TABLE public.pet_emotion_proposals IS 'Sugerencias de nuevas emociones/recetas; merge a definitions vía SQL/Admin.';

-- Ejemplo (tras aplicar migración, ejecutar manualmente si querés probar animación desde BD):
-- INSERT INTO public.pet_emotion_definitions (slug, label_es, ambient_animations, is_system, approved)
-- VALUES (
--   'principal',
--   'Principal',
--   '{"tracks":[{"target":"wrap","tween":{"prop":"y","keyframes":[0,-6.5,0],"duration":2000,"ease":"inOutSine","loop":true}},{"target":"wrap","tween":{"prop":"scale","keyframes":[1,1.05,1],"duration":1980,"ease":"inOutSine","loop":true}}]}'::jsonb,
--   true,
--   true
-- ) ON CONFLICT (slug) DO NOTHING;
