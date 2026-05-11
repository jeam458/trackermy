-- Ícono temático por ruta (fauna andina, motivos inspirados en arte prehispánico — claves de catálogo en app).
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS icon_symbol_key TEXT;

COMMENT ON COLUMN public.routes.icon_symbol_key IS 'Clave del catálogo routeThemedIcons (ej. condor, chakana).';
