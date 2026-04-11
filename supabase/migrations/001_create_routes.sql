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
