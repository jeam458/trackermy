-- Tipo de trazado: guía el algoritmo de aproximación (OSM vía, senda, o mixto).
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS track_type TEXT NOT NULL DEFAULT 'trail'
    CHECK (track_type IN ('pavement', 'trail', 'mixed'));

COMMENT ON COLUMN public.routes.track_type IS
  'pavement = carretera; trail = senda/trocha/DH; mixed = tramos de ambos.';

CREATE INDEX IF NOT EXISTS idx_routes_track_type ON public.routes (track_type);
