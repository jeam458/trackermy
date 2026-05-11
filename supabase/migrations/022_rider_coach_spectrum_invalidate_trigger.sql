-- Invalida el espectro coaching del rider al cambiar intentos (recomputo TS en la próxima carga del guía).
-- Paridad con `isRiderSpectrumStale` en app: computed_at antiguo fuerza recálculo.

CREATE OR REPLACE FUNCTION public.invalidate_rider_coach_spectrum (p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public AS $$
BEGIN
  INSERT INTO
    public.rider_coach_spectrum (
      user_id,
      spectrum,
      suggested_coach_level,
      attempts_in_window,
      computed_at,
      updated_at
    )
  VALUES (
    p_user_id,
    '{}'::jsonb,
    'sin_datos',
    0,
    '1970-01-01T00:00:00+00:00'::timestamptz,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    computed_at = '1970-01-01T00:00:00+00:00'::timestamptz,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.invalidate_rider_coach_spectrum (uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.route_attempts_invalidate_rider_coach_spectrum_fn () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public AS $$
DECLARE
  uid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    uid := OLD.user_id;
  ELSE
    uid := NEW.user_id;
  END IF;
  PERFORM public.invalidate_rider_coach_spectrum (uid);
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.route_attempts_invalidate_rider_coach_spectrum_fn () FROM PUBLIC;

DROP TRIGGER IF EXISTS route_attempts_invalidate_rider_coach_spectrum ON public.route_attempts;

CREATE TRIGGER route_attempts_invalidate_rider_coach_spectrum
AFTER INSERT
OR
UPDATE
OR DELETE ON public.route_attempts FOR EACH ROW
EXECUTE PROCEDURE public.route_attempts_invalidate_rider_coach_spectrum_fn ();
