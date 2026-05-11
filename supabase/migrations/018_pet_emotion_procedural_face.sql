-- Expresión procedural (SVG) por emoción: JSON con lista blanca en app (`parseProceduralFacePartial`).
ALTER TABLE public.pet_emotion_definitions
  ADD COLUMN IF NOT EXISTS procedural_face jsonb;

ALTER TABLE public.pet_emotion_proposals
  ADD COLUMN IF NOT EXISTS procedural_face jsonb;

COMMENT ON COLUMN public.pet_emotion_definitions.procedural_face IS
  'Opcional: { brow, mouth, accents[], brow_tilt, mouth_open, intensity } merge sobre builtin por slug.';
