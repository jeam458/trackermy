-- ============================================
-- ESQUEMA DE BASE DE DATOS PARA ROUTES
-- ============================================
-- Este script crea las tablas necesarias para el sistema de rutas de downhill
-- con tracking GPS preciso

-- ============================================
-- 1. Tabla: routes
-- ============================================
CREATE TABLE IF NOT EXISTS public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Expert')),
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
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    track_quality TEXT CHECK (track_quality IN ('excellent', 'good', 'fair', 'poor')),
    
    -- Índices para búsquedas eficientes
    CONSTRAINT routes_difficulty_check CHECK (difficulty IN ('Beginner', 'Intermediate', 'Expert')),
    CONSTRAINT routes_status_check CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT routes_track_quality_check CHECK (track_quality IN ('excellent', 'good', 'fair', 'poor'))
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
    accuracy DECIMAL(10, 2), -- precisión en metros
    timestamp TIMESTAMPTZ,
    order_index INTEGER NOT NULL,
    
    -- Restricción para orden único por ruta
    CONSTRAINT unique_route_point_order UNIQUE (route_id, order_index)
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_track_points_route_id ON public.route_track_points(route_id);
CREATE INDEX IF NOT EXISTS idx_track_points_order ON public.route_track_points(route_id, order_index);

-- ============================================
-- 3. Trigger para actualizar updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_routes_updated_at
    BEFORE UPDATE ON public.routes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. Row Level Security (RLS)
-- ============================================
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_track_points ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Políticas RLS para routes
-- ============================================

-- Los usuarios pueden ver rutas públicas
CREATE POLICY "Public routes are viewable by everyone"
    ON public.routes FOR SELECT
    USING (is_public = true OR status = 'active');

-- Los usuarios pueden ver sus propias rutas
CREATE POLICY "Users can view their own routes"
    ON public.routes FOR SELECT
    USING (auth.uid() = created_by);

-- Los usuarios pueden crear rutas
CREATE POLICY "Users can create routes"
    ON public.routes FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Los usuarios pueden actualizar sus propias rutas
CREATE POLICY "Users can update their own routes"
    ON public.routes FOR UPDATE
    USING (auth.uid() = created_by);

-- Los usuarios pueden eliminar sus propias rutas
CREATE POLICY "Users can delete their own routes"
    ON public.routes FOR DELETE
    USING (auth.uid() = created_by);

-- ============================================
-- 6. Políticas RLS para route_track_points
-- ============================================

-- Los usuarios pueden ver puntos de rutas públicas o propias
CREATE POLICY "View track points for public or own routes"
    ON public.route_track_points FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.routes r
            WHERE r.id = route_track_points.route_id
            AND (r.is_public = true OR r.created_by = auth.uid())
        )
    );

-- Los usuarios pueden crear puntos para sus propias rutas
CREATE POLICY "Insert track points for own routes"
    ON public.route_track_points FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.routes r
            WHERE r.id = route_track_points.route_id
            AND r.created_by = auth.uid()
        )
    );

-- Los usuarios pueden actualizar puntos de sus propias rutas
CREATE POLICY "Update track points for own routes"
    ON public.route_track_points FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.routes r
            WHERE r.id = route_track_points.route_id
            AND r.created_by = auth.uid()
        )
    );

-- Los usuarios pueden eliminar puntos de sus propias rutas
CREATE POLICY "Delete track points for own routes"
    ON public.route_track_points FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.routes r
            WHERE r.id = route_track_points.route_id
            AND r.created_by = auth.uid()
        )
    );

-- ============================================
-- 7. Función para obtener ruta completa con puntos
-- ============================================
CREATE OR REPLACE FUNCTION public.get_route_with_points(route_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    difficulty TEXT,
    distance_km DECIMAL,
    elevation_gain_m DECIMAL,
    elevation_loss_m DECIMAL,
    start_lat DECIMAL,
    start_lng DECIMAL,
    end_lat DECIMAL,
    end_lng DECIMAL,
    created_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_public BOOLEAN,
    status TEXT,
    track_quality TEXT,
    track_points JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.name,
        r.description,
        r.difficulty,
        r.distance_km,
        r.elevation_gain_m,
        r.elevation_loss_m,
        r.start_lat,
        r.start_lng,
        r.end_lat,
        r.end_lng,
        r.created_by,
        r.created_at,
        r.updated_at,
        r.is_public,
        r.status,
        r.track_quality,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', p.id,
                    'latitude', p.latitude,
                    'longitude', p.longitude,
                    'altitude', p.altitude,
                    'accuracy', p.accuracy,
                    'timestamp', p.timestamp,
                    'orderIndex', p.order_index
                ) ORDER BY p.order_index
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::jsonb
        ) as track_points
    FROM public.routes r
    LEFT JOIN public.route_track_points p ON r.id = p.route_id
    WHERE r.id = route_id
    GROUP BY r.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. Función para calcular distancia entre dos puntos (Haversine)
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_distance_meters(
    lat1 DECIMAL,
    lng1 DECIMAL,
    lat2 DECIMAL,
    lng2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    R DECIMAL := 6371000; -- Radio de la Tierra en metros
    dLat DECIMAL;
    dLng DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dLat = RADIANS(lat2 - lat1);
    dLng = RADIANS(lng2 - lng1);
    
    a = SIN(dLat / 2) * SIN(dLat / 2) +
        COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
        SIN(dLng / 2) * SIN(dLng / 2);
    
    c = 2 * ATAN2(SQRT(a), SQRT(1 - a));
    
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 9. Función para actualizar distancia y elevación de ruta
-- ============================================
CREATE OR REPLACE FUNCTION public.update_route_stats()
RETURNS TRIGGER AS $$
DECLARE
    total_distance DECIMAL := 0;
    elevation_gain DECIMAL := 0;
    elevation_loss DECIMAL := 0;
    prev_point RECORD;
    curr_point RECORD;
BEGIN
    -- Calcular distancia y elevación
    FOR curr_point IN 
        SELECT latitude, longitude, altitude, order_index
        FROM public.route_track_points
        WHERE route_id = NEW.id
        ORDER BY order_index
    LOOP
        IF prev_point IS NOT NULL THEN
            -- Distancia
            total_distance := total_distance + public.calculate_distance_meters(
                prev_point.latitude, prev_point.longitude,
                curr_point.latitude, curr_point.longitude
            );
            
            -- Elevación
            IF prev_point.altitude IS NOT NULL AND curr_point.altitude IS NOT NULL THEN
                IF curr_point.altitude > prev_point.altitude THEN
                    elevation_gain := elevation_gain + (curr_point.altitude - prev_point.altitude);
                ELSE
                    elevation_loss := elevation_loss + (prev_point.altitude - curr_point.altitude);
                END IF;
            END IF;
        END IF;
        
        prev_point := curr_point;
    END LOOP;
    
    -- Actualizar ruta
    UPDATE public.routes
    SET 
        distance_km = total_distance / 1000,
        elevation_gain_m = elevation_gain,
        elevation_loss_m = elevation_loss
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar estadísticas cuando cambian los puntos
CREATE OR REPLACE TRIGGER update_route_stats_after_point_change
    AFTER INSERT OR UPDATE OR DELETE ON public.route_track_points
    FOR EACH ROW
    EXECUTE FUNCTION public.update_route_stats();

-- ============================================
-- 10. Comentario de documentación
-- ============================================
COMMENT ON TABLE public.routes IS 'Rutas de downhill creadas por usuarios con tracking GPS';
COMMENT ON TABLE public.route_track_points IS 'Puntos GPS que conforman el track de una ruta';
COMMENT ON FUNCTION public.get_route_with_points IS 'Obtiene una ruta completa con todos sus puntos GPS en formato JSON';
COMMENT ON FUNCTION public.calculate_distance_meters IS 'Calcula distancia entre dos coordenadas usando fórmula Haversine';
