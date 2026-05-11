-- Moderación de rutas: super admin por correo + dueño puede gestionar galería de intentos y borrar ruta.
-- Correo de plataforma (mantener en sync con src/lib/routeModeration.ts).

CREATE OR REPLACE FUNCTION public.is_route_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(
    (SELECT u.email::text FROM auth.users u WHERE u.id = auth.uid()),
    ''
  ))) = 'jeancarlos387@gmail.com';
$$;

REVOKE ALL ON FUNCTION public.is_route_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_route_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.routes_prevent_created_by_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'routes.created_by is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_routes_preserve_created_by ON public.routes;
CREATE TRIGGER tr_routes_preserve_created_by
  BEFORE UPDATE ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION public.routes_prevent_created_by_change();

COMMENT ON FUNCTION public.is_route_platform_admin() IS
  'Admin de plataforma por correo (jeancarlos387@gmail.com). Mantener alineado con src/lib/routeModeration.ts.';

-- routes: actualizar / borrar como dueño o admin de plataforma
DROP POLICY IF EXISTS "Users can update their own routes" ON public.routes;
CREATE POLICY "Users can update their own routes"
  ON public.routes FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_route_platform_admin())
  WITH CHECK (auth.uid() = created_by OR public.is_route_platform_admin());

DROP POLICY IF EXISTS "Users can delete their own routes" ON public.routes;
CREATE POLICY "Users can delete their own routes"
  ON public.routes FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_route_platform_admin());

-- route_track_points: mismo criterio que dueño de ruta (incluye admin)
DROP POLICY IF EXISTS "View track points for public or own routes" ON public.route_track_points;
CREATE POLICY "View track points for public or own routes"
  ON public.route_track_points FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.routes r
      WHERE r.id = route_track_points.route_id
        AND (r.is_public = true OR r.created_by = auth.uid() OR public.is_route_platform_admin())
    )
  );

DROP POLICY IF EXISTS "Insert track points for own routes" ON public.route_track_points;
CREATE POLICY "Insert track points for own routes"
  ON public.route_track_points FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routes r
      WHERE r.id = route_track_points.route_id
        AND (r.created_by = auth.uid() OR public.is_route_platform_admin())
    )
  );

DROP POLICY IF EXISTS "Update track points for own routes" ON public.route_track_points;
CREATE POLICY "Update track points for own routes"
  ON public.route_track_points FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.routes r
      WHERE r.id = route_track_points.route_id
        AND (r.created_by = auth.uid() OR public.is_route_platform_admin())
    )
  );

DROP POLICY IF EXISTS "Delete track points for own routes" ON public.route_track_points;
CREATE POLICY "Delete track points for own routes"
  ON public.route_track_points FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.routes r
      WHERE r.id = route_track_points.route_id
        AND (r.created_by = auth.uid() OR public.is_route_platform_admin())
    )
  );

-- Ver medios de cualquier intento de una ruta creada por ti (p. ej. borrado en cascada / limpieza)
DROP POLICY IF EXISTS "route_attempt_media_select_for_route_owner" ON public.route_attempt_media;
CREATE POLICY "route_attempt_media_select_for_route_owner"
  ON public.route_attempt_media FOR SELECT TO authenticated
  USING (
    public.is_route_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.route_attempts ra
      JOIN public.routes r ON r.id = ra.route_id
      WHERE ra.id = route_attempt_media.attempt_id
        AND r.created_by = auth.uid()
    )
  );

-- Galería de intentos: el dueño de la ruta o admin puede borrar filas (p. ej. moderación)
DROP POLICY IF EXISTS "route_attempt_media_delete" ON public.route_attempt_media;
CREATE POLICY "route_attempt_media_delete"
  ON public.route_attempt_media FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_route_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.route_attempts ra
      JOIN public.routes r ON r.id = ra.route_id
      WHERE ra.id = route_attempt_media.attempt_id
        AND r.created_by = auth.uid()
    )
  );

-- Storage attempt-media: borrar objeto si eres el subidor, dueño de la ruta del intento, o admin
DROP POLICY IF EXISTS "storage_attempt_media_delete" ON storage.objects;
CREATE POLICY "storage_attempt_media_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attempt-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_route_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.route_attempts ra
        JOIN public.routes r ON r.id = ra.route_id
        WHERE ra.id::text = (storage.foldername(name))[2]
          AND r.created_by = auth.uid()
      )
    )
  );

-- Vista previa de ruta: admin puede borrar cualquier objeto del bucket
DROP POLICY IF EXISTS "storage_route_previews_delete" ON storage.objects;
CREATE POLICY "storage_route_previews_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'route-previews'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_route_platform_admin()
    )
  );

-- Ver cualquier ruta (p. ej. privada por URL) si eres admin de plataforma
DROP POLICY IF EXISTS "Platform admin can view all routes" ON public.routes;
CREATE POLICY "Platform admin can view all routes"
  ON public.routes FOR SELECT TO authenticated
  USING (public.is_route_platform_admin());

-- Dueño de la ruta (y admin) necesita ver todos los intentos al borrar la ruta o limpiar storage
DROP POLICY IF EXISTS "Route owner can view attempts on their route" ON public.route_attempts;
CREATE POLICY "Route owner can view attempts on their route"
  ON public.route_attempts FOR SELECT TO authenticated
  USING (
    public.is_route_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.routes r
      WHERE r.id = route_attempts.route_id
        AND r.created_by = auth.uid()
    )
  );
