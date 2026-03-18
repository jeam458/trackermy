-- ============================================
-- ESQUEMA DE BASE DE DATOS - PERFILES DE USUARIO
-- ============================================
-- Copia TODO este archivo y ejecútalo en Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Tabla: profiles (extiende auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    has_crown BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles(full_name);

-- ============================================
-- 2. Tabla: bike_setups (configuración de bicicleta)
-- ============================================
CREATE TABLE IF NOT EXISTS public.bike_setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    frame TEXT,
    fork TEXT,
    drivetrain TEXT,
    image_url TEXT,
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bike_setups_user_id ON public.bike_setups(user_id);
CREATE INDEX IF NOT EXISTS idx_bike_setups_primary ON public.bike_setups(is_primary);

-- ============================================
-- 3. Tabla: user_routes (rutas favoritas de usuario)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Evitar duplicados
    CONSTRAINT unique_user_route UNIQUE (user_id, route_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_routes_user_id ON public.user_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_routes_route_id ON public.user_routes(route_id);
CREATE INDEX IF NOT EXISTS idx_user_routes_preferred ON public.user_routes(is_preferred);

-- ============================================
-- 4. Trigger para actualizar updated_at en profiles
-- ============================================
CREATE OR REPLACE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. Trigger para actualizar updated_at en bike_setups
-- ============================================
CREATE OR REPLACE TRIGGER update_bike_setups_updated_at
    BEFORE UPDATE ON public.bike_setups
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 6. Row Level Security (RLS)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bike_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_routes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. Políticas RLS para profiles
-- ============================================

-- Ver perfiles públicos
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

-- Cada usuario puede ver su propio perfil
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Cada usuario puede actualizar su propio perfil
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Cada usuario puede insertar su propio perfil (al registrarse)
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 8. Políticas RLS para bike_setups
-- ============================================

-- Ver bike setups propios
CREATE POLICY "Users can view their own bike setups"
    ON public.bike_setups FOR SELECT
    USING (auth.uid() = user_id);

-- Insertar bike setups propios
CREATE POLICY "Users can insert their own bike setups"
    ON public.bike_setups FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Actualizar bike setups propios
CREATE POLICY "Users can update their own bike setups"
    ON public.bike_setups FOR UPDATE
    USING (auth.uid() = user_id);

-- Eliminar bike setups propios
CREATE POLICY "Users can delete their own bike setups"
    ON public.bike_setups FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 9. Políticas RLS para user_routes
-- ============================================

-- Ver rutas favoritas propias
CREATE POLICY "Users can view their own preferred routes"
    ON public.user_routes FOR SELECT
    USING (auth.uid() = user_id);

-- Insertar rutas favoritas propias
CREATE POLICY "Users can insert their own preferred routes"
    ON public.user_routes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Eliminar rutas favoritas propias
CREATE POLICY "Users can delete their own preferred routes"
    ON public.user_routes FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 10. Función: get_profile_with_bike
-- ============================================
CREATE OR REPLACE FUNCTION public.get_profile_with_bike(profile_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    has_crown BOOLEAN,
    frame TEXT,
    fork TEXT,
    drivetrain TEXT,
    bike_image_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        p.bio,
        p.avatar_url,
        p.has_crown,
        b.frame,
        b.fork,
        b.drivetrain,
        b.image_url as bike_image_url
    FROM public.profiles p
    LEFT JOIN public.bike_setups b ON p.id = b.user_id AND b.is_primary = true
    WHERE p.id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. Función: get_user_preferred_routes
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_preferred_routes(profile_id UUID)
RETURNS TABLE (
    route_id UUID,
    route_name TEXT,
    route_difficulty TEXT,
    route_distance_km DECIMAL,
    route_start_lat DECIMAL,
    route_start_lng DECIMAL,
    route_end_lat DECIMAL,
    route_end_lng DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id as route_id,
        r.name as route_name,
        r.difficulty as route_difficulty,
        r.distance_km as route_distance_km,
        r.start_lat as route_start_lat,
        r.start_lng as route_start_lng,
        r.end_lat as route_end_lat,
        r.end_lng as route_end_lng
    FROM public.user_routes ur
    JOIN public.routes r ON ur.route_id = r.id
    WHERE ur.user_id = profile_id
    AND ur.is_preferred = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. Trigger: Crear perfil automáticamente al registrarse
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, has_crown)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/notionists/svg?seed=' || NEW.email),
        false
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta cuando un nuevo usuario se registra
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 13. Comentarios de documentación
-- ============================================
COMMENT ON TABLE public.profiles IS 'Perfiles de usuario con información personal';
COMMENT ON TABLE public.bike_setups IS 'Configuración de bicicletas de los usuarios';
COMMENT ON TABLE public.user_routes IS 'Rutas favoritas de los usuarios';
COMMENT ON FUNCTION public.get_profile_with_bike IS 'Obtiene perfil completo con configuración de bicicleta';
COMMENT ON FUNCTION public.get_user_preferred_routes IS 'Obtiene rutas favoritas de un usuario';

-- ============================================
-- FIN DEL ESQUEMA - PERFILES
-- ============================================
