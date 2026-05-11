-- Ampliación catálogo mantenimiento: specs técnicas resumidas + marcas/modelos/intervalos adicionales
-- (orientativo; siempre validar con manual oficial del fabricante)

ALTER TABLE public.maintenance_component_models
  ADD COLUMN IF NOT EXISTS key_specs_es TEXT,
  ADD COLUMN IF NOT EXISTS key_specs_en TEXT;

COMMENT ON COLUMN public.maintenance_component_models.key_specs_es IS 'Características técnicas resumidas (ES) para recomendaciones IA';
COMMENT ON COLUMN public.maintenance_component_models.key_specs_en IS 'Key technical specs summary (EN) for AI recommendations';

-- Rellenar specs en filas existentes donde sigan nulos (copia de notas como base)
UPDATE public.maintenance_component_models
SET
  key_specs_es = COALESCE(key_specs_es, notes_es),
  key_specs_en = COALESCE(key_specs_en, notes_en)
WHERE key_specs_es IS NULL OR key_specs_en IS NULL;

INSERT INTO public.maintenance_component_brands (name, website_url)
VALUES
    ('Manitou', 'https://www.manitoumtb.com'),
    ('Magura', 'https://www.magura.com'),
    ('DT Swiss', 'https://www.dtswiss.com'),
    ('Ohlins', 'https://www.ohlins.com'),
    ('Formula', 'https://www.formula-brake.com'),
    ('TRP', 'https://www.trpbrakes.com'),
    ('Cane Creek', 'https://canecreek.com')
ON CONFLICT (name) DO NOTHING;

-- RockShox Lyrik
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'Lyrik', 170,
  'Horquilla enduro; revisar cartucho y piernas según horas de uso.',
  'Enduro fork; inspect damper and lowers per hours of use.',
  'Charger / RC2T según generación; DebonAir+; offset de copas variable; torque de tornillos según manual.',
  'Charger / RC2T depending on generation; DebonAir+; variable crown offset; bolt torque per manual.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'RockShox'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Lyrik'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 50, NULL, NULL,
  'Servicio piernas/bath (orientativo); suciedad fina acorta intervalo.',
  'Lower-leg bath service (guideline); fine grit shortens interval.',
  'Referencia orientativa', 'https://www.sram.com/en/service', 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Lyrik' AND b.name = 'RockShox' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'damper_full_service', 200, NULL, NULL,
  'Revisión completa de cartucho/amortiguador (orientativo; taller autorizado).',
  'Full damper/cartridge service (guideline; authorized shop).',
  'Referencia orientativa', NULL, 5
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Lyrik' AND b.name = 'RockShox' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'damper_full_service'
  );

-- RockShox Pike
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'Pike', 150,
  'Trail/enduro ligera; sellos y lubricación frecuentes en barro.',
  'Lighter trail/enduro; seals and lube often in mud.',
  'Ultimate / Select+ según año; offset corto/medio/largo; presiones recomendadas en tabla SRAM.',
  'Ultimate / Select+ by year; short/medium/long offset; pressures per SRAM chart.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'RockShox'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Pike'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 50, NULL, NULL,
  'Piernas/bath: limpieza y sellos (orientativo).',
  'Lower legs: clean and seals (guideline).', 'Referencia orientativa', 'https://www.sram.com/en/service', 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Pike' AND b.name = 'RockShox' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );

-- RockShox ZEB (DH/enduro largo)
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'ZEB', 190,
  'Horquilla de recorrido largo; mayores esfuerzos en copas y barras.',
  'Long-travel fork; higher stress on crowns and stanchions.',
  'Chassis 38 mm; Charger 3 / R2C2 según modelo; orientada a DH/agresivo.',
  '38 mm chassis; Charger 3 / R2C2 by trim; DH/aggressive oriented.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'RockShox'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'ZEB'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 40, NULL, NULL,
  'Uso intenso: acortar intervalo de piernas vs horquilla trail.',
  'Hard use: shorten lower-leg interval vs trail fork.', 'Referencia orientativa', NULL, 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'ZEB' AND b.name = 'RockShox' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );

-- Fox 34
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, '34 Float', 140,
  'Trail versátil; FIT4 / GRIP2 según versión.',
  'Versatile trail; FIT4 / GRIP2 by version.',
  'Barras 34 mm; Float EVOL; volumen de cámara y tokens afectan progresividad.',
  '34 mm stanchions; Float EVOL; air volume and tokens affect progression.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Fox'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = '34 Float'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 50, NULL, NULL,
  'Servicio piernas Fox (orientativo).',
  'Fox lower-leg service (guideline).', 'Referencia orientativa', 'https://www.ridefox.com/service', 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = '34 Float' AND b.name = 'Fox' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );

-- Fox 40 (DH)
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, '40 Float', 203,
  'Horquilla DH; intervalos cortos en piernas por carga y suciedad.',
  'DH fork; shorter lower-leg intervals due to load and dirt.',
  'Chasis 40 mm; cartucho FIT4 o GRIP2 según generación; mucho volumen de lubricación en piernas.',
  '40 mm chassis; FIT4 or GRIP2 by generation; high lower-leg oil volume.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Fox'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = '40 Float'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 25, NULL, NULL,
  'DH: piernas cada ~25 h de pista dura (orientativo).',
  'DH: lowers about every ~25 h hard track (guideline).', 'Referencia orientativa', NULL, 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = '40 Float' AND b.name = 'Fox' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );

-- Manitou Mezzer
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'Mezzer', 180,
  'Horquilla ajustable en volumen de aire (IVA) y progresividad.',
  'Fork with adjustable air volume (IVA) and progression.',
  'Barras 37 mm; MC2 / Dorado Air cart; revisar torque de araña y bridgas.',
  '37 mm stanchions; MC2 / Dorado Air cart; check crown and bridge torques.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Manitou'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Mezzer'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 50, NULL, NULL,
  'Piernas y sellos Manitou (orientativo).',
  'Manitou lowers and seals (guideline).', 'Referencia orientativa', NULL, 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Mezzer' AND b.name = 'Manitou' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );

-- Magura MT7
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'MT7', NULL,
  'Freno 4 pistones; fluido Royal Blood (no DOT ni mineral Shimano).',
  '4-piston brake; Royal Blood fluid (not DOT or Shimano mineral).',
  'Leverage alto; pastillas 7.P/7.R; pistones cerámicos en versiones Pro.',
  'High leverage; 7.P/7.R pads; ceramic pistons on Pro trims.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Magura'
WHERE c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'MT7'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'bleed_and_pads', NULL, NULL, 12,
  'Royal Blood: purgar si tacto cambia; pastillas y discos según desgaste.',
  'Royal Blood: bleed if lever feel changes; pads/rotors per wear.', 'Referencia orientativa', NULL, 20
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'MT7' AND b.name = 'Magura' AND c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'bleed_and_pads'
  );

-- Shimano Saint BR-M820
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'Saint BR-M820', NULL,
  'DH gravity; aceite mineral Shimano; pistones de 4.',
  'DH gravity; Shimano mineral oil; 4-piston.',
  'Ceramic pistons; disipación térmica; pastillas metal/resina según condiciones.',
  'Ceramic pistons; heat shedding; metal/resin pads per conditions.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Shimano'
WHERE c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Saint BR-M820'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'bleed_and_pads', NULL, NULL, 9,
  'Uso DH: revisar pastillas con más frecuencia; purgar ante tacto esponjoso.',
  'DH use: inspect pads more often; bleed if spongy.', 'Referencia orientativa', NULL, 20
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Saint BR-M820' AND b.name = 'Shimano' AND c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'bleed_and_pads'
  );

-- DT Swiss 350 hub
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, '350', NULL,
  'Buje ratchet; engrase del mecanismo según entorno.',
  'Ratchet hub; grease mechanism per environment.',
  'Star Ratchet 18/36/54T según kit; no mezclar grasas incompatibles.',
  'Star Ratchet 18/36/54T by kit; do not mix incompatible greases.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'DT Swiss'
WHERE c.slug = 'wheel_hub'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = '350'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'ratchet_service', NULL, NULL, 12,
  'Abrir, limpiar y re-engrasar Star Ratchet (orientativo).',
  'Open, clean and re-grease Star Ratchet (guideline).', 'Referencia orientativa', 'https://www.dtswiss.com', 20
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = '350' AND b.name = 'DT Swiss' AND c.slug = 'wheel_hub'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'ratchet_service'
  );

-- Ohlins RXF 38 fork
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'RXF 38', 180,
  'Horquilla de alta precisión; cartucho separado; seguir manual Ohlins.',
  'High-precision fork; separate cartridge; follow Ohlins manual.',
  'Barras 38 mm; twin-tube u ohlins-specific damper; revisiones en centro autorizado recomendadas.',
  '38 mm stanchions; twin-tube / Ohlins-specific damper; authorized service recommended.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Ohlins'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'RXF 38'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 50, NULL, NULL,
  'Servicio de piernas y sellos (orientativo).',
  'Lower-leg and seal service (guideline).', 'Referencia orientativa', NULL, 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'RXF 38' AND b.name = 'Ohlins' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );

-- TRP Quadiem
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'Quadiem', NULL,
  'Freno 4 pistones; DOT 5.1; modulación DH.',
  '4-piston brake; DOT 5.1; DH-oriented modulation.',
  'Cuerpo rígido; pistones cerámicos en gama alta; pastillas resina/metal.',
  'Stiff body; ceramic pistons on high end; resin/metal pads.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'TRP'
WHERE c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Quadiem'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'bleed_and_pads', NULL, NULL, 12,
  'DOT: vigilar higroscopia; purgar y pastillas según tacto y ruido.',
  'DOT: watch hygroscopy; bleed and pads per feel and noise.', 'Referencia orientativa', NULL, 20
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Quadiem' AND b.name = 'TRP' AND c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'bleed_and_pads'
  );

-- Formula Cura 4
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'Cura 4', NULL,
  'Freno italiano 4 pistones; mineral Formula.',
  'Italian 4-piston brake; Formula mineral oil.',
  'Mix master opcional; pistones 4x16 mm; pastillas orgánicas/sinter.',
  'Mix master optional; 4×16 mm pistons; organic/sintered pads.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Formula'
WHERE c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Cura 4'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'bleed_and_pads', NULL, NULL, 12,
  'Aceite mineral Formula; purgado y pastillas según desgaste.',
  'Formula mineral oil; bleed and pads per wear.', 'Referencia orientativa', NULL, 20
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Cura 4' AND b.name = 'Formula' AND c.slug = 'brake_hydraulic'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'bleed_and_pads'
  );

-- SRAM X0 Eagle T-Type (transmisión)
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'X0 Eagle Transmission', NULL,
  'Transmisión sin puntera clásica; alineación y torque de UDH.',
  'No classic hanger; alignment and UDH torque.',
  'Flat top chain; cassette direct mount; software AXS para ajustes.',
  'Flat top chain; direct mount cassette; AXS app for setup.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'SRAM'
WHERE c.slug = 'drivetrain'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'X0 Eagle Transmission'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'chain_wear_check', NULL, 400, NULL,
  'Cadena flat-top: medir desgaste con herramienta compatible; cassette DM.',
  'Flat-top chain: measure wear with compatible tool; DM cassette.', 'Referencia orientativa', NULL, 30
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'X0 Eagle Transmission' AND b.name = 'SRAM' AND c.slug = 'drivetrain'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'chain_wear_check'
  );

-- Cane Creek Helm (fork)
INSERT INTO public.maintenance_component_models (
    category_id, brand_id, model_name, travel_mm, notes_es, notes_en, key_specs_es, key_specs_en
)
SELECT c.id, b.id, 'Helm', 160,
  'Horquilla modular; ajuste de progresión interno.',
  'Modular fork; internal progression adjustment.',
  'Doble cartucho independiente aire/helice en algunas versiones; seguir manual CC.',
  'Independent air/coil cartridges on some trims; follow CC manual.'
FROM public.maintenance_component_categories c
JOIN public.maintenance_component_brands b ON b.name = 'Cane Creek'
WHERE c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_component_models m
    WHERE m.category_id = c.id AND m.brand_id = b.id AND m.model_name = 'Helm'
  );

INSERT INTO public.maintenance_service_intervals (
    component_model_id, service_kind_slug, interval_hours, interval_km, interval_months,
    recommendation_es, recommendation_en, source_label, source_url, priority
)
SELECT m.id, 'lower_leg_service', 50, NULL, NULL,
  'Piernas y lubricación (orientativo).',
  'Lower legs and lubrication (guideline).', 'Referencia orientativa', NULL, 10
FROM public.maintenance_component_models m
JOIN public.maintenance_component_brands b ON b.id = m.brand_id
JOIN public.maintenance_component_categories c ON c.id = m.category_id
WHERE m.model_name = 'Helm' AND b.name = 'Cane Creek' AND c.slug = 'suspension_fork'
  AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_service_intervals i
    WHERE i.component_model_id = m.id AND i.service_kind_slug = 'lower_leg_service'
  );
