-- Esquema para intentos de ruta y rankings
-- Ejecutar en Supabase SQL Editor

-- Tabla de intentos de ruta
CREATE TABLE IF NOT EXISTS route_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tiempos
  total_time DECIMAL NOT NULL, -- segundos totales
  moving_time DECIMAL NOT NULL, -- segundos en movimiento
  stopped_time DECIMAL NOT NULL, -- segundos detenido
  
  -- Velocidades (m/s)
  max_speed DECIMAL NOT NULL,
  avg_speed DECIMAL NOT NULL,
  
  -- Distancia y elevación
  distance DECIMAL NOT NULL, -- metros
  elevation_gain DECIMAL, -- metros
  elevation_loss DECIMAL, -- metros
  
  -- Eventos
  jumps_count INTEGER DEFAULT 0,
  sharp_movements_count INTEGER DEFAULT 0,
  hard_brakes_count INTEGER DEFAULT 0,
  stops_count INTEGER DEFAULT 0,
  
  -- Scores
  rhythm_score INTEGER, -- 0-100
  intensity_score INTEGER, -- 0-100
  aggression_score INTEGER, -- 0-100
  overall_score INTEGER, -- 0-100
  
  -- GPS points (JSON)
  gps_points JSONB,
  
  -- Metadata
  is_public BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Índice para ranking (mejor tiempo primero)
  CONSTRAINT valid_scores CHECK (
    rhythm_score BETWEEN 0 AND 100 AND
    intensity_score BETWEEN 0 AND 100 AND
    aggression_score BETWEEN 0 AND 100 AND
    overall_score BETWEEN 0 AND 100
  )
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_route_attempts_route_id ON route_attempts(route_id);
CREATE INDEX IF NOT EXISTS idx_route_attempts_user_id ON route_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_route_attempts_total_time ON route_attempts(route_id, total_time ASC);
CREATE INDEX IF NOT EXISTS idx_route_attempts_overall_score ON route_attempts(route_id, overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_route_attempts_completed_at ON route_attempts(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_attempts_is_public ON route_attempts(is_public) WHERE is_public = true;

-- Tabla de mejores tiempos por segmento (opcional)
CREATE TABLE IF NOT EXISTS route_segment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_id INTEGER NOT NULL,
  segment_time DECIMAL NOT NULL, -- segundos
  avg_speed DECIMAL NOT NULL, -- m/s
  max_speed DECIMAL NOT NULL, -- m/s
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(route_id, user_id, segment_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_records_route_segment ON route_segment_records(route_id, segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_records_time ON route_segment_records(route_id, segment_id, segment_time ASC);

-- Función para obtener ranking de una ruta
CREATE OR REPLACE FUNCTION get_route_ranking(
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
    FROM route_attempts ra
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
      FROM route_attempts ra2
      WHERE ra2.route_id = p_route_id
        AND ra2.user_id = rd.user_id
        AND ra2.total_time = rd.total_time
    ) as is_personal_best
  FROM ranked_attempts rd
  ORDER BY rd.position ASC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener el mejor tiempo de un usuario en una ruta
CREATE OR REPLACE FUNCTION get_user_best_attempt(
  p_route_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  total_time DECIMAL,
  max_speed DECIMAL,
  avg_speed DECIMAL,
  overall_score INTEGER,
  completed_at TIMESTAMPTZ,
  rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH user_best AS (
    SELECT *
    FROM route_attempts
    WHERE route_id = p_route_id
      AND user_id = p_user_id
    ORDER BY total_time ASC
    LIMIT 1
  ),
  user_rank AS (
    SELECT
      COUNT(*) + 1 as rank
    FROM route_attempts
    WHERE route_id = p_route_id
      AND is_public = true
      AND total_time < (SELECT total_time FROM user_best)
  )
  SELECT
    ub.id,
    ub.total_time,
    ub.max_speed,
    ub.avg_speed,
    ub.overall_score,
    ub.completed_at,
    ur.rank::INTEGER
  FROM user_best ub
  CROSS JOIN user_rank ur;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de una ruta
CREATE OR REPLACE FUNCTION get_route_statistics(p_route_id UUID)
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
  FROM route_attempts
  WHERE route_id = p_route_id
    AND is_public = true;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar ranking cuando se inserta un intento
CREATE OR REPLACE FUNCTION notify_new_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Notificar a través de Supabase Realtime
  PERFORM pg_notify(
    'route_attempt_inserted',
    json_build_object(
      'route_id', NEW.route_id,
      'user_id', NEW.user_id,
      'total_time', NEW.total_time,
      'overall_score', NEW.overall_score
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_attempt
  AFTER INSERT ON route_attempts
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_attempt();

-- Políticas de seguridad (RLS)
ALTER TABLE route_attempts ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver intentos públicos
CREATE POLICY "Public attempts are viewable by everyone"
  ON route_attempts
  FOR SELECT
  USING (is_public = true);

-- Usuarios autenticados pueden ver sus propios intentos (incluso privados)
CREATE POLICY "Users can view their own attempts"
  ON route_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuarios pueden crear intentos
CREATE POLICY "Users can create attempts"
  ON route_attempts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden actualizar sus propios intentos
CREATE POLICY "Users can update their own attempts"
  ON route_attempts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Usuarios pueden eliminar sus propios intentos
CREATE POLICY "Users can delete their own attempts"
  ON route_attempts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Segment records RLS
ALTER TABLE route_segment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Segment records are viewable by everyone"
  ON route_segment_records
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create segment records"
  ON route_segment_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
