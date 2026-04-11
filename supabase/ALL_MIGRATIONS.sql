-- Migration: Create routes and track_points tables
-- Created: 2026-04-05

-- ============================================
-- 1. Tabla: routes
-- ============================================
CREATE TABLE IF NOT EXISTS public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    difficulty TEXT NOT NULL,
    distance_km DECIMAL(10, 3) NOT NULL DEFAULT 0,
    elevation_gain_m DECIMAL(10, 2),
    elevation_loss_m DECIMAL(10, 2),
    start_lat DECIMAL(10, 8) NOT NULL,
    start_lng DECIMAL(11, 8) NOT NULL,
    end_lat DECIMAL(10, 8) NOT NULL,
    end_lng DECIMAL(11, 8) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_public BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active',
    track_quality TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_routes_created_by ON public.routes(created_by);
CREATE INDEX IF NOT EXISTS idx_routes_status ON public.routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_is_public ON public.routes(is_public);
CREATE INDEX IF NOT EXISTS idx_routes_difficulty ON public.routes(difficulty);
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON public.routes(created_at DESC);

-- ============================================
-- 2. Tabla: route_track_points
-- ============================================
CREATE TABLE IF NOT EXISTS public.route_track_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    altitude DECIMAL(10, 2),
    accuracy DECIMAL(10, 2),
    timestamp TIMESTAMPTZ,
    order_index INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_track_points_route_id ON public.route_track_points(route_id);
CREATE INDEX IF NOT EXISTS idx_track_points_order ON public.route_track_points(route_id, order_index);

-- ============================================
-- 3. Trigger updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_routes_updated_at ON public.routes;
CREATE TRIGGER update_routes_updated_at
    BEFORE UPDATE ON public.routes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. RLS
-- ============================================
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_track_points ENABLE ROW LEVEL SECURITY;

-- Políticas routes
DROP POLICY IF EXISTS "Public routes are viewable by everyone" ON public.routes;
CREATE POLICY "Public routes are viewable by everyone"
    ON public.routes FOR SELECT
    USING (is_public = true OR status = 'active');

DROP POLICY IF EXISTS "Users can view their own routes" ON public.routes;
CREATE POLICY "Users can view their own routes"
    ON public.routes FOR SELECT
    USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create routes" ON public.routes;
CREATE POLICY "Users can create routes"
    ON public.routes FOR INSERT
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own routes" ON public.routes;
CREATE POLICY "Users can update their own routes"
    ON public.routes FOR UPDATE
    USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own routes" ON public.routes;
CREATE POLICY "Users can delete their own routes"
    ON public.routes FOR DELETE
    USING (auth.uid() = created_by);

-- Políticas track_points
DROP POLICY IF EXISTS "View track points for public or own routes" ON public.route_track_points;
CREATE POLICY "View track points for public or own routes"
    ON public.route_track_points FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.routes r
            WHERE r.id = route_track_points.route_id
            AND (r.is_public = true OR r.created_by = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Insert track points for own routes" ON public.route_track_points;
CREATE POLICY "Insert track points for own routes"
    ON public.route_track_points FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.routes r
            WHERE r.id = route_track_points.route_id
            AND r.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Update track points for own routes" ON public.route_track_points;
CREATE POLICY "Update track points for own routes"
    ON public.route_track_points FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.routes r
            WHERE r.id = route_track_points.route_id
            AND r.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Delete track points for own routes" ON public.route_track_points;
CREATE POLICY "Delete track points for own routes"
    ON public.route_track_points FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.routes r
            WHERE r.id = route_track_points.route_id
            AND r.created_by = auth.uid()
        )
    );
-- Migration: Create route_attempts table for timing and rankings
-- Created: 2026-04-05

-- ============================================
-- 1. Tabla: route_attempts
-- ============================================
CREATE TABLE IF NOT EXISTS public.route_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Tiempos
    total_time DECIMAL NOT NULL,
    moving_time DECIMAL NOT NULL,
    stopped_time DECIMAL NOT NULL,
    
    -- Velocidades (m/s)
    max_speed DECIMAL NOT NULL,
    avg_speed DECIMAL NOT NULL,
    
    -- Distancia y elevación
    distance DECIMAL NOT NULL,
    elevation_gain DECIMAL,
    elevation_loss DECIMAL,
    
    -- Eventos
    jumps_count INTEGER DEFAULT 0,
    sharp_movements_count INTEGER DEFAULT 0,
    hard_brakes_count INTEGER DEFAULT 0,
    stops_count INTEGER DEFAULT 0,
    
    -- Scores
    rhythm_score INTEGER,
    intensity_score INTEGER,
    aggression_score INTEGER,
    overall_score INTEGER,
    
    -- GPS points (JSON)
    gps_points JSONB,
    
    -- Video support
    video_url TEXT,
    video_thumbnail TEXT,
    video_duration INTEGER,
    video_size INTEGER,
    
    -- Metadata
    is_public BOOLEAN DEFAULT true,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_route_attempts_route_id ON public.route_attempts(route_id);
CREATE INDEX IF NOT EXISTS idx_route_attempts_user_id ON public.route_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_route_attempts_total_time ON public.route_attempts(route_id, total_time ASC);
CREATE INDEX IF NOT EXISTS idx_route_attempts_overall_score ON public.route_attempts(route_id, overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_route_attempts_completed_at ON public.route_attempts(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_attempts_is_public ON public.route_attempts(is_public) WHERE is_public = true;

-- ============================================
-- 2. RLS para route_attempts
-- ============================================
ALTER TABLE public.route_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public attempts are viewable by everyone" ON public.route_attempts;
CREATE POLICY "Public attempts are viewable by everyone"
    ON public.route_attempts
    FOR SELECT
    USING (is_public = true);

DROP POLICY IF EXISTS "Users can view their own attempts" ON public.route_attempts;
CREATE POLICY "Users can view their own attempts"
    ON public.route_attempts
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create attempts" ON public.route_attempts;
CREATE POLICY "Users can create attempts"
    ON public.route_attempts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own attempts" ON public.route_attempts;
CREATE POLICY "Users can update their own attempts"
    ON public.route_attempts
    FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own attempts" ON public.route_attempts;
CREATE POLICY "Users can delete their own attempts"
    ON public.route_attempts
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 3. Funciones de ranking
-- ============================================
CREATE OR REPLACE FUNCTION public.get_route_ranking(
    p_route_id UUID,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    rank INTEGER,
    user_id UUID,
    user_name TEXT,
    avatar_url TEXT,
    total_time DECIMAL,
    max_speed DECIMAL,
    avg_speed DECIMAL,
    overall_score INTEGER,
    completed_at TIMESTAMPTZ,
    is_personal_best BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_attempts AS (
        SELECT
            ra.*,
            ROW_NUMBER() OVER (ORDER BY ra.total_time ASC) as position,
            u.user_metadata->>'fullName' as user_name,
            u.user_metadata->>'avatarUrl' as avatar_url
        FROM public.route_attempts ra
        JOIN auth.users u ON u.id = ra.user_id
        WHERE ra.route_id = p_route_id
            AND ra.is_public = true
        ORDER BY ra.total_time ASC
        LIMIT p_limit
        OFFSET p_offset
    )
    SELECT
        rd.position::INTEGER as rank,
        rd.user_id,
        rd.user_name,
        rd.avatar_url,
        rd.total_time,
        rd.max_speed,
        rd.avg_speed,
        rd.overall_score,
        rd.completed_at,
        EXISTS (
            SELECT 1
            FROM public.route_attempts ra2
            WHERE ra2.route_id = p_route_id
                AND ra2.user_id = rd.user_id
                AND ra2.total_time = rd.total_time
        ) as is_personal_best
    FROM ranked_attempts rd
    ORDER BY rd.position ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_route_statistics(p_route_id UUID)
RETURNS TABLE (
    total_attempts BIGINT,
    unique_riders BIGINT,
    best_time DECIMAL,
    avg_time DECIMAL,
    best_score INTEGER,
    avg_score DECIMAL,
    max_recorded_speed DECIMAL,
    avg_jumps DECIMAL,
    avg_stops DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_attempts,
        COUNT(DISTINCT user_id) as unique_riders,
        MIN(total_time) as best_time,
        AVG(total_time) as avg_time,
        MAX(overall_score) as best_score,
        AVG(overall_score) as avg_score,
        MAX(max_speed) as max_recorded_speed,
        AVG(jumps_count) as avg_jumps,
        AVG(stops_count) as avg_stops
    FROM public.route_attempts
    WHERE route_id = p_route_id
        AND is_public = true;
END;
$$ LANGUAGE plpgsql;
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
