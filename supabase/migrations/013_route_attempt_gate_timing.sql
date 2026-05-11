-- Desfase arranque (salida) y duración de aproximación a meta (QC de grabación de intentos)

ALTER TABLE public.route_attempts
  ADD COLUMN IF NOT EXISTS start_gate_offset_wall_ms INTEGER,
  ADD COLUMN IF NOT EXISTS start_gate_offset_gps_ms INTEGER,
  ADD COLUMN IF NOT EXISTS finish_approach_ms INTEGER;

COMMENT ON COLUMN public.route_attempts.start_gate_offset_wall_ms IS
  'ms desde armado de grabación hasta cruzar radio de salida (pared).';
COMMENT ON COLUMN public.route_attempts.start_gate_offset_gps_ms IS
  'ms desde armado hasta timestamp GPS del fix que abrió la salida.';
COMMENT ON COLUMN public.route_attempts.finish_approach_ms IS
  'ms desde último punto fuera del radio de meta hasta el cierre del track.';
