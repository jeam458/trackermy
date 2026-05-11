-- Galería extra de fotos de bicicleta (además de image_url en bike_setups)
ALTER TABLE public.bike_setups
ADD COLUMN IF NOT EXISTS photo_gallery jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.bike_setups.photo_gallery IS 'Array JSON de URLs públicas (Supabase storage) de fotos adicionales de la bici';

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
    color_hex TEXT,
    bike_photo_gallery jsonb
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
        b.color_hex,
        COALESCE(b.photo_gallery, '[]'::jsonb) AS bike_photo_gallery
    FROM public.profiles p
    LEFT JOIN public.bike_setups b ON p.id = b.user_id AND b.is_primary = true
    LEFT JOIN public.bike_brands br ON b.brand_id = br.id
    LEFT JOIN public.bike_models mm ON b.model_id = mm.id
    WHERE p.id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_profile_with_bike(UUID) TO anon, authenticated;
