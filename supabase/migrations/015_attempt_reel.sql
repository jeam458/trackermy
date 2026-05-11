-- Plan de montaje tipo reel + URL del vídeo exportado (cuando exista worker FFmpeg).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'route_attempts' AND column_name = 'reel_plan_json'
  ) THEN
    ALTER TABLE public.route_attempts ADD COLUMN reel_plan_json JSONB;
    COMMENT ON COLUMN public.route_attempts.reel_plan_json IS
      'Plan de montaje (clips, playbackRate); generado en app; el worker puede consumirlo para exportar MP4.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'route_attempts' AND column_name = 'reel_status'
  ) THEN
    ALTER TABLE public.route_attempts ADD COLUMN reel_status TEXT;
    COMMENT ON COLUMN public.route_attempts.reel_status IS
      'none | plan_ready | encoding | encoded | failed — encoded cuando reel_output_url apunta a MP4 final.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'route_attempts' AND column_name = 'reel_output_url'
  ) THEN
    ALTER TABLE public.route_attempts ADD COLUMN reel_output_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'route_attempts' AND column_name = 'reel_error'
  ) THEN
    ALTER TABLE public.route_attempts ADD COLUMN reel_error TEXT;
  END IF;
END $$;
