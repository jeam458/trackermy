-- Vista previa de ruta: imagen, GIF o clip corto (WebM) para listados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'preview_media_url'
    ) THEN
        ALTER TABLE public.routes ADD COLUMN preview_media_url TEXT;
    END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'route-previews', 'route-previews', true, 8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/webm', 'video/mp4']::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'route-previews');

DROP POLICY IF EXISTS "storage_route_previews_select" ON storage.objects;
CREATE POLICY "storage_route_previews_select"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'route-previews');

DROP POLICY IF EXISTS "storage_route_previews_insert" ON storage.objects;
CREATE POLICY "storage_route_previews_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'route-previews'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_route_previews_update" ON storage.objects;
CREATE POLICY "storage_route_previews_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'route-previews'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_route_previews_delete" ON storage.objects;
CREATE POLICY "storage_route_previews_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'route-previews'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
