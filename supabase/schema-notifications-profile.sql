-- ============================================
-- ESQUEMA PARA NOTIFICACIONES Y PERFIL MEJORADO
-- ============================================
-- Ejecutar en Supabase SQL Editor

-- ============================================
-- 1. Tabla: notifications
-- ============================================
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES public.route_attempts(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add check constraint safely
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
    ) THEN
        ALTER TABLE public.notifications 
            ADD CONSTRAINT notifications_type_check 
            CHECK (type IN ('new_route', 'new_record', 'route_updated'));
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_route_id ON public.notifications(route_id);
CREATE INDEX IF NOT EXISTS idx_notifications_attempt_id ON public.notifications(attempt_id);

-- RLS para notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver sus propias notificaciones
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Los usuarios pueden marcar sus notificaciones como leídas
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- 2. Función para crear notificación cuando se crea ruta pública
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_new_public_route()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo crear notificación si la ruta es pública
    IF NEW.is_public = true AND NEW.status = 'active' THEN
        -- Crear notificación para todos los usuarios excepto el creador
        INSERT INTO public.notifications (user_id, type, title, message, route_id)
        SELECT
            au.id,
            'new_route',
            '🆕 Nueva Ruta Pública',
            NEW.name || ' ha sido creada por ' || COALESCE(
                (SELECT user_metadata->>'fullName' FROM auth.users WHERE id = NEW.created_by),
                'un rider'
            ),
            NEW.id
        FROM auth.users au
        WHERE au.id != NEW.created_by;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificar nuevas rutas públicas
CREATE OR REPLACE TRIGGER trigger_notify_public_route
    AFTER INSERT ON public.routes
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_public_route();

-- ============================================
-- 3. Función para crear notificación cuando se establece nuevo récord
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_new_record()
RETURNS TRIGGER AS $$
DECLARE
    route_name TEXT;
    rider_name TEXT;
    is_new_record BOOLEAN;
BEGIN
    -- Verificar si es un nuevo récord (mejor tiempo para esta ruta)
    SELECT COUNT(*) = 0 INTO is_new_record
    FROM public.route_attempts ra
    WHERE ra.route_id = NEW.route_id
      AND ra.total_time < NEW.total_time
      AND ra.id != NEW.id;
    
    -- Si es el mejor tiempo, notificar
    IF is_new_record AND NEW.is_public = true THEN
        -- Obtener nombre de la ruta
        SELECT r.name INTO route_name
        FROM public.routes r
        WHERE r.id = NEW.route_id;
        
        -- Obtener nombre del rider
        SELECT COALESCE(au.user_metadata->>'fullName', 'Un rider') INTO rider_name
        FROM auth.users au
        WHERE au.id = NEW.user_id;
        
        -- Crear notificación para el creador de la ruta
        INSERT INTO public.notifications (user_id, type, title, message, route_id, attempt_id)
        SELECT
            r.created_by,
            'new_record',
            '🏆 ¡Nuevo Récord!',
            rider_name || ' estableció un nuevo récord en ' || route_name || ': ' || 
            FLOOR(NEW.total_time / 60) || ':' || LPAD(FLOOR(NEW.total_time % 60)::TEXT, 2, '0'),
            NEW.route_id,
            NEW.id
        FROM public.routes r
        WHERE r.id = NEW.route_id
          AND r.created_by != NEW.user_id;
        
        -- Notificar a todos los que han intentado esta ruta
        INSERT INTO public.notifications (user_id, type, title, message, route_id, attempt_id)
        SELECT DISTINCT
            ra.user_id,
            'new_record',
            '🏆 ¡Nuevo Récord!',
            rider_name || ' batió tu récord en ' || route_name || ': ' || 
            FLOOR(NEW.total_time / 60) || ':' || LPAD(FLOOR(NEW.total_time % 60)::TEXT, 2, '0'),
            NEW.route_id,
            NEW.id
        FROM public.route_attempts ra
        WHERE ra.route_id = NEW.route_id
          AND ra.user_id != NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para notificar nuevos récords
CREATE OR REPLACE TRIGGER trigger_notify_new_record
    AFTER INSERT ON public.route_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_record();

-- ============================================
-- 4. Función para obtener notificaciones no leídas
-- ============================================
CREATE OR REPLACE FUNCTION public.get_unread_notifications_count(p_user_id UUID)
RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.notifications
        WHERE user_id = p_user_id
          AND is_read = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Función para marcar todas las notificaciones como leídas
-- ============================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = p_user_id
      AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Actualizar tabla profiles para soportar fotos
-- ============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bike_image_url TEXT,
ADD COLUMN IF NOT EXISTS bike_frame TEXT,
ADD COLUMN IF NOT EXISTS bike_fork TEXT,
ADD COLUMN IF NOT EXISTS bike_drivetrain TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS has_crown BOOLEAN DEFAULT false;

-- ============================================
-- 7. Actualizar tabla route_attempts para soportar videos
-- ============================================
ALTER TABLE public.route_attempts
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS video_thumbnail TEXT,
ADD COLUMN IF NOT EXISTS video_duration INTEGER, -- duración en segundos
ADD COLUMN IF NOT EXISTS video_size INTEGER; -- tamaño en bytes

-- Índice para consultas de intentos con video
CREATE INDEX IF NOT EXISTS idx_attempts_has_video ON public.route_attempts(route_id) 
WHERE video_url IS NOT NULL;

-- ============================================
-- 8. Función para obtener perfil completo
-- ============================================
CREATE OR REPLACE FUNCTION public.get_full_profile(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    bike_image_url TEXT,
    bike_frame TEXT,
    bike_fork TEXT,
    bike_drivetrain TEXT,
    has_crown BOOLEAN,
    total_routes BIGINT,
    total_attempts BIGINT,
    best_time DECIMAL,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        p.bio,
        p.avatar_url,
        p.bike_image_url,
        p.bike_frame,
        p.bike_fork,
        p.bike_drivetrain,
        p.has_crown,
        (SELECT COUNT(*) FROM public.routes r WHERE r.created_by = p_user_id) as total_routes,
        (SELECT COUNT(*) FROM public.route_attempts ra WHERE ra.user_id = p_user_id) as total_attempts,
        (SELECT MIN(ra.total_time) FROM public.route_attempts ra WHERE ra.user_id = p_user_id) as best_time,
        p.created_at
    FROM public.profiles p
    WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. Bucket de Storage para fotos y videos
-- ============================================
-- Crear buckets si no existen (esto se hace desde el Dashboard de Supabase)
-- Pero podemos configurar las políticas aquí

-- Políticas para el bucket 'avatars'
-- INSERT: Los usuarios pueden subir sus propias fotos
-- SELECT: Todos pueden ver
-- UPDATE: Los usuarios pueden actualizar sus propias fotos
-- DELETE: Los usuarios pueden eliminar sus propias fotos

-- Políticas para el bucket 'bike-photos'
-- Similar a avatars

-- Políticas para el bucket 'ride-videos'
-- INSERT: Los usuarios pueden subir videos de sus intentos
-- SELECT: Todos pueden ver videos públicos
-- UPDATE: Los usuarios pueden actualizar sus propios videos
-- DELETE: Los usuarios pueden eliminar sus propios videos

-- ============================================
-- 10. Comentario de documentación
-- ============================================
COMMENT ON TABLE public.notifications IS 'Notificaciones push para usuarios';
COMMENT ON FUNCTION public.notify_new_public_route IS 'Crea notificaciones cuando se crea una ruta pública';
COMMENT ON FUNCTION public.notify_new_record IS 'Crea notificaciones cuando se establece un nuevo récord';
COMMENT ON FUNCTION public.get_full_profile IS 'Obtiene el perfil completo con estadísticas';
