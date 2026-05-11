-- Iconos para mapas, storage RLS, marcas/modelos añadidos por usuarios, más marcas catálogo
-- Requiere 004 aplicada

-- ============================================
-- 1. Columnas perfil / bici / catálogo
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'map_avatar_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN map_avatar_url TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bike_setups' AND column_name = 'map_icon_url'
    ) THEN
        ALTER TABLE public.bike_setups ADD COLUMN map_icon_url TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bike_brands' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.bike_brands ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bike_models' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.bike_models ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bike_brands_created_by ON public.bike_brands(created_by);

-- ============================================
-- 2. RLS: usuarios autenticados pueden añadir marcas/modelos
-- ============================================
DROP POLICY IF EXISTS "bike_brands_insert_authenticated" ON public.bike_brands;
CREATE POLICY "bike_brands_insert_authenticated"
    ON public.bike_brands FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "bike_models_insert_authenticated" ON public.bike_models;
CREATE POLICY "bike_models_insert_authenticated"
    ON public.bike_models FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- ============================================
-- 3. Buckets de storage (públicos lectura)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'avatars', 'avatars', true, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'bike-photos', 'bike-photos', true, 10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'bike-photos');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 'map-icons', 'map-icons', true, 1048576,
    ARRAY['image/png', 'image/webp']::text[]
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'map-icons');

-- Políticas storage.objects (primera carpeta del path = user id)
DROP POLICY IF EXISTS "storage_avatars_select" ON storage.objects;
CREATE POLICY "storage_avatars_select"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "storage_avatars_insert" ON storage.objects;
CREATE POLICY "storage_avatars_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_avatars_update" ON storage.objects;
CREATE POLICY "storage_avatars_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_avatars_delete" ON storage.objects;
CREATE POLICY "storage_avatars_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_bike_select" ON storage.objects;
CREATE POLICY "storage_bike_select"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'bike-photos');

DROP POLICY IF EXISTS "storage_bike_insert" ON storage.objects;
CREATE POLICY "storage_bike_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'bike-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_bike_update" ON storage.objects;
CREATE POLICY "storage_bike_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'bike-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_bike_delete" ON storage.objects;
CREATE POLICY "storage_bike_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'bike-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_map_icons_select" ON storage.objects;
CREATE POLICY "storage_map_icons_select"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'map-icons');

DROP POLICY IF EXISTS "storage_map_icons_insert" ON storage.objects;
CREATE POLICY "storage_map_icons_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'map-icons'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_map_icons_update" ON storage.objects;
CREATE POLICY "storage_map_icons_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'map-icons'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "storage_map_icons_delete" ON storage.objects;
CREATE POLICY "storage_map_icons_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'map-icons'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ============================================
-- 4. Más marcas de mercado (MTB / DH / enduro)
-- ============================================
INSERT INTO public.bike_brands (name, sort_order) VALUES
    ('Pivot', 105),
    ('Yeti Cycles', 106),
    ('Transition Bikes', 107),
    ('Evil Bikes', 108),
    ('Ibis', 109),
    ('Rocky Mountain', 110),
    ('Mondraker', 111),
    ('Nukeproof', 112),
    ('Scott', 113),
    ('Giant', 114),
    ('Kona', 115),
    ('GT Bicycles', 116),
    ('Polygon', 117),
    ('Marin', 118),
    ('Devinci', 119),
    ('Saracen', 120),
    ('Orange Bikes', 121),
    ('NS Bikes', 122),
    ('Dartmoor', 123),
    ('Rose Bikes', 124),
    ('Radon', 125),
    ('Cube', 126),
    ('Focus', 127),
    ('Lapierre', 128),
    ('Orbea', 129),
    ('Ghost', 130),
    ('Forbidden Bike Co.', 131),
    ('Revel Bikes', 132),
    ('Intense', 133),
    ('Banshee Bikes', 134),
    ('Knolly', 135),
    ('Turner', 136),
    ('Nicolai', 137),
    ('Liteville', 138),
    ('Raaw', 139),
    ('Starling Cycles', 140),
    ('Cotic', 141),
    ('Stanton', 142),
    ('Commencal Meta', 143),
    ('Wilier Triestina', 144),
    ('BMC', 145),
    ('Cannondale', 146),
    ('Merida', 147),
    ('BH Bikes', 148),
    ('Felt', 149)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 5. RPC perfil: URLs de iconos mapa
-- ============================================
DROP FUNCTION IF EXISTS public.get_profile_with_bike(UUID);

CREATE OR REPLACE FUNCTION public.get_profile_with_bike(profile_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    map_avatar_url TEXT,
    has_crown BOOLEAN,
    rider_weight_kg NUMERIC,
    frame TEXT,
    fork TEXT,
    drivetrain TEXT,
    bike_image_url TEXT,
    bike_map_icon_url TEXT,
    bike_brand_id UUID,
    bike_model_id UUID,
    bike_brand_name TEXT,
    bike_model_name TEXT,
    bike_model_thumbnail_url TEXT,
    color_hex TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        p.bio,
        p.avatar_url,
        p.map_avatar_url,
        p.has_crown,
        p.rider_weight_kg,
        b.frame,
        b.fork,
        b.drivetrain,
        COALESCE(NULLIF(trim(b.image_url), ''), mm.thumbnail_url) AS bike_image_url,
        b.map_icon_url AS bike_map_icon_url,
        b.brand_id AS bike_brand_id,
        b.model_id AS bike_model_id,
        br.name AS bike_brand_name,
        mm.name AS bike_model_name,
        mm.thumbnail_url AS bike_model_thumbnail_url,
        b.color_hex
    FROM public.profiles p
    LEFT JOIN public.bike_setups b ON p.id = b.user_id AND b.is_primary = true
    LEFT JOIN public.bike_brands br ON b.brand_id = br.id
    LEFT JOIN public.bike_models mm ON b.model_id = mm.id
    WHERE p.id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_profile_with_bike(UUID) TO anon, authenticated;
