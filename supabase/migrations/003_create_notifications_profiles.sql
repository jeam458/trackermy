-- Migration: Create notifications and update profiles
-- Created: 2026-04-05

-- ============================================
-- 1. Tabla: notifications
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_route_id ON public.notifications(route_id);
CREATE INDEX IF NOT EXISTS idx_notifications_attempt_id ON public.notifications(attempt_id);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- 2. Función: notify_new_public_route
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_new_public_route()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_public = true AND NEW.status = 'active' THEN
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

DROP TRIGGER IF EXISTS trigger_notify_public_route ON public.routes;
CREATE TRIGGER trigger_notify_public_route
    AFTER INSERT ON public.routes
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_public_route();

-- ============================================
-- 3. Función: notify_new_record
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_new_record()
RETURNS TRIGGER AS $$
DECLARE
    route_name TEXT;
    rider_name TEXT;
    is_new_record BOOLEAN;
BEGIN
    SELECT COUNT(*) = 0 INTO is_new_record
    FROM public.route_attempts ra
    WHERE ra.route_id = NEW.route_id
      AND ra.total_time < NEW.total_time
      AND ra.id != NEW.id;
    
    IF is_new_record AND NEW.is_public = true THEN
        SELECT r.name INTO route_name
        FROM public.routes r
        WHERE r.id = NEW.route_id;
        
        SELECT COALESCE(au.user_metadata->>'fullName', 'Un rider') INTO rider_name
        FROM auth.users au
        WHERE au.id = NEW.user_id;
        
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

DROP TRIGGER IF EXISTS trigger_notify_new_record ON public.route_attempts;
CREATE TRIGGER trigger_notify_new_record
    AFTER INSERT ON public.route_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_record();

-- ============================================
-- 4. Funciones auxiliares
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
-- 5. Actualizar tabla profiles
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    bike_image_url TEXT,
    bike_frame TEXT,
    bike_fork TEXT,
    bike_drivetrain TEXT,
    has_crown BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Si la tabla ya existe, agregar columnas faltantes
DO $$ 
BEGIN
    -- Agregar columnas si no existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='full_name') THEN
        ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bio') THEN
        ALTER TABLE public.profiles ADD COLUMN bio TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bike_image_url') THEN
        ALTER TABLE public.profiles ADD COLUMN bike_image_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bike_frame') THEN
        ALTER TABLE public.profiles ADD COLUMN bike_frame TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bike_fork') THEN
        ALTER TABLE public.profiles ADD COLUMN bike_fork TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='bike_drivetrain') THEN
        ALTER TABLE public.profiles ADD COLUMN bike_drivetrain TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='has_crown') THEN
        ALTER TABLE public.profiles ADD COLUMN has_crown BOOLEAN DEFAULT false;
    END IF;
END $$;

-- RLS para profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Trigger updated_at para profiles
CREATE OR REPLACE FUNCTION public.update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_profile_updated_at();

-- ============================================
-- 6. Función get_full_profile
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
