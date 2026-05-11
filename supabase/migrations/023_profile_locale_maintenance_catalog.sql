-- Perfil: idioma preferido (UI ES/EN)
-- Catálogo inicial de componentes + intervalos de mantenimiento (semillas orientativas; verificar siempre con el manual del fabricante)

-- ---------------------------------------------------------------------------
-- 1) profiles.preferred_language
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'es';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_language_check
  CHECK (preferred_language IN ('es', 'en'));

COMMENT ON COLUMN public.profiles.preferred_language IS 'Idioma de interfaz: es | en';

-- ---------------------------------------------------------------------------
-- 2) RPC get_profile_with_bike: incluir preferred_language
-- ---------------------------------------------------------------------------
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
    bike_photo_gallery jsonb,
    preferred_language TEXT
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
        COALESCE(b.photo_gallery, '[]'::jsonb) AS bike_photo_gallery,
        p.preferred_language
    FROM public.profiles p
    LEFT JOIN public.bike_setups b ON p.id = b.user_id AND b.is_primary = true
    LEFT JOIN public.bike_brands br ON b.brand_id = br.id
    LEFT JOIN public.bike_models mm ON b.model_id = mm.id
    WHERE p.id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_profile_with_bike(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Catálogo de mantenimiento (marca / modelo / intervalos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_component_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name_es TEXT NOT NULL,
    name_en TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.maintenance_component_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    website_url TEXT
);

CREATE TABLE IF NOT EXISTS public.maintenance_component_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.maintenance_component_categories(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES public.maintenance_component_brands(id) ON DELETE SET NULL,
    model_name TEXT NOT NULL,
    travel_mm INTEGER,
    model_year INTEGER,
    notes_es TEXT,
    notes_en TEXT,
    CONSTRAINT maintenance_component_models_unique UNIQUE (category_id, brand_id, model_name)
);

CREATE TABLE IF NOT EXISTS public.maintenance_service_intervals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_model_id UUID NOT NULL REFERENCES public.maintenance_component_models(id) ON DELETE CASCADE,
    service_kind_slug TEXT NOT NULL,
    interval_hours INTEGER,
    interval_km INTEGER,
    interval_months INTEGER,
    recommendation_es TEXT NOT NULL,
    recommendation_en TEXT NOT NULL,
    source_label TEXT NOT NULL,
    source_url TEXT,
    priority SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT maintenance_service_intervals_unique UNIQUE (component_model_id, service_kind_slug)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_models_category ON public.maintenance_component_models(category_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_models_brand ON public.maintenance_component_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_intervals_model ON public.maintenance_service_intervals(component_model_id);

COMMENT ON TABLE public.maintenance_component_categories IS 'Familias de componentes MTB (horquilla, frenos, etc.)';
COMMENT ON TABLE public.maintenance_component_brands IS 'Marcas comerciales de componentes';
COMMENT ON TABLE public.maintenance_component_models IS 'Modelo específico (ej. RockShox Yari 180 mm)';
COMMENT ON TABLE public.maintenance_service_intervals IS 'Intervalos orientativos de servicio; validar con documentación oficial';

-- RLS: catálogo de solo lectura para clientes autenticados y anónimos
ALTER TABLE public.maintenance_component_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_component_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_component_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_service_intervals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance_categories_select_all" ON public.maintenance_component_categories;
CREATE POLICY "maintenance_categories_select_all"
    ON public.maintenance_component_categories FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "maintenance_brands_select_all" ON public.maintenance_component_brands;
CREATE POLICY "maintenance_brands_select_all"
    ON public.maintenance_component_brands FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "maintenance_models_select_all" ON public.maintenance_component_models;
CREATE POLICY "maintenance_models_select_all"
    ON public.maintenance_component_models FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "maintenance_intervals_select_all" ON public.maintenance_service_intervals;
CREATE POLICY "maintenance_intervals_select_all"
    ON public.maintenance_service_intervals FOR SELECT
    USING (true);

-- ---------------------------------------------------------------------------
-- 4) Semillas (ejemplos representativos; no sustituyen al manual del fabricante)
-- ---------------------------------------------------------------------------
INSERT INTO public.maintenance_component_categories (slug, name_es, name_en, sort_order)
VALUES
    ('suspension_fork', 'Horquilla', 'Fork', 10),
    ('suspension_shock', 'Amortiguador', 'Rear shock', 20),
    ('brake_hydraulic', 'Freno hidráulico', 'Hydraulic brake', 30),
    ('drivetrain', 'Transmisión', 'Drivetrain', 40),
    ('wheel_hub', 'Masa / buje', 'Hub', 50),
    ('frame_bearings', 'Rodamientos de cuadro / dirección', 'Frame / headset bearings', 60),
    ('tubeless', 'Tubeless (sellante)', 'Tubeless (sealant)', 70)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.maintenance_component_brands (name, website_url)
VALUES
    ('RockShox', 'https://www.sram.com/rockshox'),
    ('Fox', 'https://www.ridefox.com'),
    ('Shimano', 'https://bike.shimano.com'),
    ('SRAM', 'https://www.sram.com'),
    ('Hope Technology', 'https://www.hopetech.com'),
    ('Maxxis', 'https://www.maxxis.com')
ON CONFLICT (name) DO NOTHING;

-- Modelos (idempotente)
INSERT INTO public.maintenance_component_models (category_id, brand_id, model_name, travel_mm, notes_es, notes_en)
SELECT c.id, b.id, 'Yari', 180,
  'Horquilla trail/enduro; revisar aire, sellos y lubricación según uso.',
  'Trail/enduro fork; check air, seals and lubrication per use.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'RockShox'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Yari'
  );

INSERT INTO public.maintenance_component_models (category_id, brand_id, model_name, travel_mm, notes_es, notes_en)
SELECT c.id, b.id, 'Boxxer', 200,
  'Horquilla DH; sometida a picos altos de carga.',
  'DH fork; high peak loads.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'RockShox'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Boxxer'
  );

INSERT INTO public.maintenance_component_models (category_id, brand_id, model_name, travel_mm, notes_es, notes_en)
SELECT c.id, b.id, '36 Float', 160,
  'Horquilla enduro; seguir torque y torque specs del fabricante.',
  'Enduro fork; follow manufacturer torque specs.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Fox'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = '36 Float'
  );

INSERT INTO public.maintenance_component_models (category_id, brand_id, model_name, travel_mm, notes_es, notes_en)
SELECT c.id, b.id, 'Float X', NULL,
  'Amortiguador metric; revisar anillo de aire y juego.',
  'Metric shock; inspect air can and bushing play.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Fox'
WHERE c.slug = 'suspension_shock'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Float X'
  );

INSERT INTO public.maintenance_component_models (category_id, brand_id, model_name, travel_mm, notes_es, notes_en)
SELECT c.id, b.id, 'XT BR-M8120', NULL,
  'Pinzas de 4 pistones; vigilar pastillas y purgado.',
  '4-piston calipers; monitor pads and bleed.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Shimano'
WHERE c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'XT BR-M8120'
  );

INSERT INTO public.maintenance_component_models (category_id, brand_id, model_name, travel_mm, notes_es, notes_en)
SELECT c.id, b.id, 'Code R', NULL,
  'Freno gravity; pastillas y líquido DOT.',
  'Gravity brake; pads and DOT fluid.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'SRAM'
WHERE c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Code R'
  );

INSERT INTO public.maintenance_component_models (category_id, brand_id, model_name, travel_mm, notes_es, notes_en)
SELECT c.id, b.id, 'GX Eagle', NULL,
  '12v; cadena y cassette desgastan con barro.',
  '12-speed; chain and cassette wear faster in mud.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'SRAM'
WHERE c.slug = 'drivetrain'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'GX Eagle'
  );

INSERT INTO public.maintenance_component_models (category_id, brand_id, model_name, travel_mm, notes_es, notes_en)
SELECT c.id, b.id, 'Pro 4', NULL,
  'Buje serviciable; engrase según entorno.',
  'Serviceable hub; grease per conditions.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Hope Technology'
WHERE c.slug = 'wheel_hub'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Pro 4'
  );

INSERT INTO public.maintenance_component_models (category_id, brand_id, model_name, travel_mm, notes_es, notes_en)
SELECT c.id, b.id, 'Generic headset bearings', NULL,
  'Rodamientos de dirección: holguras y sonidos.',
  'Headset bearings: play and creaks.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Shimano'
WHERE c.slug = 'frame_bearings'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Generic headset bearings'
  );

INSERT INTO public.maintenance_component_models (category_id, brand_id, model_name, travel_mm, notes_es, notes_en)
SELECT c.id, b.id, 'Tubeless sealant (typical)', NULL,
  'Sellante: reponer cada varios meses o al perder estanqueidad.',
  'Sealant: refresh every few months or when losing pressure.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Maxxis'
WHERE c.slug = 'tubeless'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Tubeless sealant (typical)'
  );

-- Intervalos (idempotente por modelo + slug de servicio)
INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 50, NULL, NULL,
  'Servicio de piernas/bath (orientativo): limpieza, sellos, aceite.',
  'Lower-leg bath service (guideline): clean, seals, oil.',
  'Referencia orientativa fabricante / uso MTB', 'https://www.sram.com/en/service', 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Yari' AND b.name = 'RockShox' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 25, NULL, NULL,
  'DH: intervalos más cortos por picos de carga y suciedad.',
  'DH: shorter intervals due to load peaks and dirt.', 'Referencia orientativa', NULL, 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Boxxer' AND b.name = 'RockShox' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 50, NULL, NULL,
  'Revisión de lubricación y sellos en piernas (orientativo).',
  'Lower-leg lubrication and seal service (guideline).', 'Referencia orientativa', 'https://www.ridefox.com/service', 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = '36 Float' AND b.name = 'Fox' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'air_can_service', 100, NULL, NULL,
  'Revisión de cámara de aire y sellos (orientativo).',
  'Air can and seal inspection (guideline).', 'Referencia orientativa', NULL, 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Float X' AND b.name = 'Fox' AND c.slug = 'suspension_shock'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'air_can_service'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'bleed_and_pads', NULL, NULL, 12,
  'Purgado si tacto esponjoso; revisar pastillas cada pocos meses según uso.',
  'Bleed if lever feels spongy; inspect pads every few months.', 'Referencia orientativa', NULL, 20
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'XT BR-M8120' AND b.name = 'Shimano' AND c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'bleed_and_pads'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'bleed_and_pads', NULL, NULL, 12,
  'DOT higroscópico: revisar nivel y purgar si es necesario.',
  'DOT fluid absorbs moisture; check level and bleed as needed.', 'Referencia orientativa', NULL, 20
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Code R' AND b.name = 'SRAM' AND c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'bleed_and_pads'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'chain_wear_check', NULL, 500, NULL,
  'Medir estiramiento de cadena; sustituir antes de dañar cassette.',
  'Measure chain stretch; replace before cassette damage.', 'Referencia orientativa', NULL, 30
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'GX Eagle' AND b.name = 'SRAM' AND c.slug = 'drivetrain'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'chain_wear_check'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'bearing_grease', NULL, NULL, 18,
  'Engrase / revisión de juego en bujes (orientativo).',
  'Grease / inspect hub play (guideline).', 'Referencia orientativa', NULL, 20
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Pro 4' AND b.name = 'Hope Technology' AND c.slug = 'wheel_hub'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'bearing_grease'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'bearing_inspect', 150, NULL, NULL,
  'Rodamientos de cuadro/dirección: revisión por holgura o ruidos (valor orientativo).',
  'Frame/headset bearings: inspect for play or noise (guideline).', 'Referencia orientativa', NULL, 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Generic headset bearings' AND b.name = 'Shimano' AND c.slug = 'frame_bearings'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'bearing_inspect'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'sealant_refresh', NULL, NULL, 4,
  'Renovar sellante cada pocos meses o al montar neumático nuevo.',
  'Refresh sealant every few months or when mounting new tires.', 'Referencia orientativa', NULL, 40
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Tubeless sealant (typical)' AND b.name = 'Maxxis' AND c.slug = 'tubeless'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'sealant_refresh'
  );
