-- Lámina modular 7×3 `guarddh-pet-estados-sheet.png` — orden = `ALL_PET_EMOTIONS` en la app.

UPDATE public.pet_emotion_definitions
SET
  atlas_slot = CASE slug
    WHEN 'principal' THEN 0
    WHEN 'pensando_minimal' THEN 1
    WHEN 'conexion_perdida' THEN 2
    WHEN 'recuperando' THEN 3
    WHEN 'ayuda_exitosa_fiesta' THEN 4
    WHEN 'exhausto' THEN 5
    WHEN 'exhausto_total' THEN 6
    WHEN 'inicio_ruta' THEN 7
    WHEN 'espera_sincronizacion' THEN 8
    WHEN 'confusion_error' THEN 9
    WHEN 'datos_guardados' THEN 10
    WHEN 'pensando_mapa' THEN 11
    WHEN 'obstaculo_detectado' THEN 12
    WHEN 'fin_ruta' THEN 13
    WHEN 'saludo' THEN 14
    WHEN 'cansado_flor' THEN 15
    WHEN 'cansado' THEN 16
    WHEN 'velocidad_critica' THEN 17
    WHEN 'bateria_baja' THEN 18
    WHEN 'vinculo_tiempo' THEN 19
    WHEN 'molesto' THEN 20
    ELSE atlas_slot
  END,
  focus_x = NULL,
  focus_y = NULL,
  zoom = NULL
WHERE slug IN (
  'principal',
  'pensando_minimal',
  'conexion_perdida',
  'recuperando',
  'ayuda_exitosa_fiesta',
  'exhausto',
  'exhausto_total',
  'inicio_ruta',
  'espera_sincronizacion',
  'confusion_error',
  'datos_guardados',
  'pensando_mapa',
  'obstaculo_detectado',
  'fin_ruta',
  'saludo',
  'cansado_flor',
  'cansado',
  'velocidad_critica',
  'bateria_baja',
  'vinculo_tiempo',
  'molesto'
);
