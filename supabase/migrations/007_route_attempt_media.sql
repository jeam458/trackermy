-- Fotos / vídeos por intento de ruta + metadatos opcionales para replay 3D (futuro)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'route_attempts' AND column_name = 'video_gps_offset_ms'
    ) THEN
        ALTER TABLE public.route_attempts ADD COLUMN video_gps_offset_ms INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'route_attempts' AND column_name = 'replay_3d_meta'
    ) THEN
        ALTER TABLE public.route_attempts ADD COLUMN replay_3d_meta JSONB;
        COMMENT ON COLUMN public.route_attempts.replay_3d_meta IS 'Metadatos de visor 3D (p. ej. URL de malla, motor, estado); no es LingBot embebido en cliente.';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.route_attempt_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.route_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    public_url TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_attempt_media_attempt ON public.route_attempt_media(attempt_id);
CREATE INDEX IF NOT EXISTS idx_route_attempt_media_user ON public.route_attempt_media(user_id);

ALTER TABLE public.route_attempt_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "route_attempt_media_select" ON public.route_attempt_media;
CREATE POLICY "route_attempt_media_select"
    ON public.route_attempt_media FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.route_attempts ra
            WHERE ra.id = attempt_id AND (ra.is_public = true OR ra.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "route_attempt_media_insert" ON public.route_attempt_media;
CREATE POLICY "route_attempt_media_insert"
    ON public.route_attempt_media FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.route_attempts ra
            WHERE ra.id = attempt_id AND ra.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "route_attempt_media_delete" ON public.route_attempt_media;
CREATE POLICY "route_attempt_media_delete"
    ON public.route_attempt_media FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'attempt-media', 'attempt-media', true, 104857600,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'attempt-media');

DROP POLICY IF EXISTS "storage_attempt_media_select" ON storage.objects;
CREATE POLICY "storage_attempt_media_select"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'attempt-media');

DROP POLICY IF EXISTS "storage_attempt_media_insert" ON storage.objects;
CREATE POLICY "storage_attempt_media_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'attempt-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_attempt_media_update" ON storage.objects;
CREATE POLICY "storage_attempt_media_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'attempt-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_attempt_media_delete" ON storage.objects;
CREATE POLICY "storage_attempt_media_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'attempt-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
