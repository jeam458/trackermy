-- Catálogo de bicis DH + extensión perfil / bike_setup
-- Ejecutar después de 001–003

-- ============================================
-- 1. Catálogo: marcas y modelos
-- ============================================
CREATE TABLE IF NOT EXISTS public.bike_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bike_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.bike_brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'downhill',
    thumbnail_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_brand_model_name UNIQUE (brand_id, name)
);

CREATE INDEX IF NOT EXISTS idx_bike_models_brand ON public.bike_models(brand_id);

ALTER TABLE public.bike_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bike_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bike_brands_select_all" ON public.bike_brands;
CREATE POLICY "bike_brands_select_all"
    ON public.bike_brands FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "bike_models_select_all" ON public.bike_models;
CREATE POLICY "bike_models_select_all"
    ON public.bike_models FOR SELECT
    USING (true);

-- ============================================
-- 2. Ampliar profiles y bike_setups
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'rider_weight_kg'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN rider_weight_kg NUMERIC(5,2);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bike_setups' AND column_name = 'brand_id'
    ) THEN
        ALTER TABLE public.bike_setups ADD COLUMN brand_id UUID REFERENCES public.bike_brands(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bike_setups' AND column_name = 'model_id'
    ) THEN
        ALTER TABLE public.bike_setups ADD COLUMN model_id UUID REFERENCES public.bike_models(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bike_setups' AND column_name = 'color_hex'
    ) THEN
        ALTER TABLE public.bike_setups ADD COLUMN color_hex TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bike_setups_brand ON public.bike_setups(brand_id);
CREATE INDEX IF NOT EXISTS idx_bike_setups_model ON public.bike_setups(model_id);

-- ============================================
-- 3. Datos semilla (DH)
-- ============================================
INSERT INTO public.bike_brands (id, name, sort_order)
SELECT * FROM (VALUES
    ('a1000000-0000-4000-8000-000000000001'::uuid, 'Santa Cruz', 10),
    ('a1000000-0000-4000-8000-000000000002'::uuid, 'Commencal', 20),
    ('a1000000-0000-4000-8000-000000000003'::uuid, 'YT Industries', 30),
    ('a1000000-0000-4000-8000-000000000004'::uuid, 'Specialized', 40),
    ('a1000000-0000-4000-8000-000000000005'::uuid, 'Trek', 50),
    ('a1000000-0000-4000-8000-000000000006'::uuid, 'Canyon', 60),
    ('a1000000-0000-4000-8000-000000000007'::uuid, 'Propain', 70),
    ('a1000000-0000-4000-8000-000000000008'::uuid, 'Norco', 80)
) AS v(id, name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.bike_brands b WHERE b.id = v.id);

INSERT INTO public.bike_models (id, brand_id, name, category, sort_order, thumbnail_url)
SELECT * FROM (VALUES
    ('b2000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'V10', 'downhill', 1, NULL::text),
    ('b2000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Nomad', 'downhill', 2, NULL::text),
    ('b2000000-0000-4000-8000-000000000003'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid, 'Supreme DH', 'downhill', 1, NULL::text),
    ('b2000000-0000-4000-8000-000000000004'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid, 'Furious', 'downhill', 2, NULL::text),
    ('b2000000-0000-4000-8000-000000000005'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid, 'Tues', 'downhill', 1, NULL::text),
    ('b2000000-0000-4000-8000-000000000006'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid, 'Capra', 'downhill', 2, NULL::text),
    ('b2000000-0000-4000-8000-000000000007'::uuid, 'a1000000-0000-4000-8000-000000000004'::uuid, 'Demo', 'downhill', 1, NULL::text),
    ('b2000000-0000-4000-8000-000000000008'::uuid, 'a1000000-0000-4000-8000-000000000004'::uuid, 'Status', 'downhill', 2, NULL::text),
    ('b2000000-0000-4000-8000-000000000009'::uuid, 'a1000000-0000-4000-8000-000000000005'::uuid, 'Session', 'downhill', 1, NULL::text),
    ('b2000000-0000-4000-8000-000000000010'::uuid, 'a1000000-0000-4000-8000-000000000006'::uuid, 'Sender', 'downhill', 1, NULL::text),
    ('b2000000-0000-4000-8000-000000000011'::uuid, 'a1000000-0000-4000-8000-000000000006'::uuid, 'Torque', 'downhill', 2, NULL::text),
    ('b2000000-0000-4000-8000-000000000012'::uuid, 'a1000000-0000-4000-8000-000000000007'::uuid, 'Rage', 'downhill', 1, NULL::text),
    ('b2000000-0000-4000-8000-000000000013'::uuid, 'a1000000-0000-4000-8000-000000000008'::uuid, 'Aurum', 'downhill', 1, NULL::text)
) AS v(id, brand_id, name, category, sort_order, thumbnail_url)
WHERE NOT EXISTS (SELECT 1 FROM public.bike_models m WHERE m.id = v.id);

-- ============================================
-- 4. RPC: perfil con bici y catálogo
-- ============================================
-- Postgres no permite cambiar RETURNS TABLE con CREATE OR REPLACE; hay que eliminar antes.
DROP FUNCTION IF EXISTS public.get_profile_with_bike(UUID);

CREATE OR REPLACE FUNCTION public.get_profile_with_bike(profile_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    has_crown BOOLEAN,
    rider_weight_kg NUMERIC,
    frame TEXT,
    fork TEXT,
    drivetrain TEXT,
    bike_image_url TEXT,
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
        p.has_crown,
        p.rider_weight_kg,
        b.frame,
        b.fork,
        b.drivetrain,
        COALESCE(NULLIF(trim(b.image_url), ''), mm.thumbnail_url) AS bike_image_url,
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
