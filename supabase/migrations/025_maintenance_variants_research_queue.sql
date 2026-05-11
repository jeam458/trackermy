-- Variantes de modelo (p. ej. Float X carrera 216 mm) + categorías ampliadas + cola de investigación IA
-- Escala: nuevas marcas/modelos desde perfil → research_requests → merge manual o worker con IA

-- ---------------------------------------------------------------------------
-- 1) variant_key en modelos (misma familia + distinto tamaño/variante)
-- ---------------------------------------------------------------------------
ALTER TABLE public.maintenance_component_models
  ADD COLUMN IF NOT EXISTS variant_key TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.maintenance_component_models.variant_key IS
  'Clave estable de variante (ej. stroke_216, eyelet_trunnion). Vacío = fila “base” del model_name.';

ALTER TABLE public.maintenance_component_models
  DROP CONSTRAINT IF EXISTS maintenance_component_models_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_maintenance_models_natural_key
  ON public.maintenance_component_models (category_id, brand_id, model_name, variant_key);

-- ---------------------------------------------------------------------------
-- 2) Categorías adicionales (frames, cockpit, neumáticos, etc.)
-- ---------------------------------------------------------------------------
INSERT INTO public.maintenance_component_categories (slug, name_es, name_en, sort_order)
VALUES
    ('frame', 'Cuadro', 'Frame', 80),
    ('dropper_post', 'Tija telescópica', 'Dropper post', 90),
    ('tires', 'Neumático', 'Tire', 100),
    ('cockpit', 'Cockpit (manillar / potencia)', 'Cockpit (bar / stem)', 110),
    ('pedals', 'Pedales', 'Pedals', 120),
    ('chainguide', 'Guía de cadena', 'Chainguide', 130)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Marca FBX + cuadros ejemplo (semilla; ampliar con research_requests + IA)
-- ---------------------------------------------------------------------------
INSERT INTO public.maintenance_component_brands (name, website_url)
VALUES ('FBX', NULL)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, variant_key, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'Session', NULL, '',
  'Cuadro DH/enduro FBX Session; geometría y torque según ficha del fabricante.',
  'FBX Session DH/enduro frame; geometry and torque per manufacturer datasheet.',
  'Aluminio o carbono según generación; rodamientos de suspensión y tornillería crítica en revisión periódica.',
  'Aluminum or carbon by generation; pivot bearings and hardware on periodic inspection.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'FBX'
WHERE c.slug = 'frame'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Session' AND m.variant_key = ''
  );

INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, variant_key, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'Zaga', NULL, '',
  'Cuadro FBX Zaga; validar talla y kit de dirección con distribuidor.',
  'FBX Zaga frame; confirm size and headset kit with dealer.',
  'Geometría trail/enduro según año; mismas reglas de rodamientos y par de apriete que Session.',
  'Trail/enduro geometry by year; same bearing and torque discipline as Session line.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'FBX'
WHERE c.slug = 'frame'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Zaga' AND m.variant_key = ''
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'pivot_bearing_inspect', 80, NULL, NULL,
  'Revisar rodamientos de articulaciones y tornillería (orientativo; barro acorta).',
  'Inspect pivot bearings and hardware (guideline; mud shortens).', 'Referencia orientativa', NULL, 15
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name IN ('Session', 'Zaga') AND b.name = 'FBX' AND c.slug = 'frame' AND m.variant_key = ''
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'pivot_bearing_inspect'
  );

-- ---------------------------------------------------------------------------
-- 4) Fox Float X variante carrera 216 mm (fila además de la base variant_key '')
-- ---------------------------------------------------------------------------
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, variant_key, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'Float X', 216, 'stroke_216',
  'Amortiguador Fox Float X con carrera de amortiguador ~216 mm (métrica; confirmar medida en vaina).',
  'Fox Float X damper with ~216 mm stroke (metric; confirm in frame).',
  'EVOL cámara de aire; revisar volumen espaciadores y torque de trunnion/ojos; bushing y sellos de cámara según horas.',
  'EVOL air can; check volume spacers and trunnion/eye torque; air can seals and bushings per hours.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Fox'
WHERE c.slug = 'suspension_shock'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Float X' AND m.variant_key = 'stroke_216'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'air_can_service', 100, NULL, NULL,
  'Cámara de aire y sellos: revisión orientativa (carrera larga puede acumular más carga en bushing).',
  'Air can and seals: guideline inspection (long stroke can load bushings more).',
  'Referencia orientativa', 'https://www.ridefox.com/service', 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Float X' AND b.name = 'Fox' AND c.slug = 'suspension_shock' AND m.variant_key = 'stroke_216'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'air_can_service'
  );

-- ---------------------------------------------------------------------------
-- 5) Cola de investigación (usuario / perfil → payload IA → merge al catálogo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_catalog_research_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    source_context TEXT NOT NULL DEFAULT 'manual',
    category_slug TEXT,
    raw_brand TEXT NOT NULL,
    raw_model TEXT NOT NULL,
    raw_variant TEXT,
    user_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'merged')),
    proposed_payload JSONB,
    merged_model_id UUID REFERENCES public.maintenance_component_models (id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maint_research_user ON public.maintenance_catalog_research_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_maint_research_status ON public.maintenance_catalog_research_requests (status);

COMMENT ON TABLE public.maintenance_catalog_research_requests IS
  'Solicitudes para enriquecer catálogo (IA o curador): marca/modelo/variante desde perfil u origen manual.';

ALTER TABLE public.maintenance_catalog_research_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance_research_select_own" ON public.maintenance_catalog_research_requests;
CREATE POLICY "maintenance_research_select_own"
    ON public.maintenance_catalog_research_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "maintenance_research_insert_own" ON public.maintenance_catalog_research_requests;
CREATE POLICY "maintenance_research_insert_own"
    ON public.maintenance_catalog_research_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.maintenance_catalog_research_requests TO authenticated;
