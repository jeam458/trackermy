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
