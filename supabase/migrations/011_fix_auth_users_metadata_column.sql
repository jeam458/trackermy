-- En auth.users el JSON de metadatos del usuario es raw_user_meta_data (no user_metadata).
-- Los triggers y RPC que usaban user_metadata fallaban al crear rutas / ranking.

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
                (SELECT raw_user_meta_data->>'fullName' FROM auth.users WHERE id = NEW.created_by),
                'un rider'
            ),
            NEW.id
        FROM auth.users au
        WHERE au.id != NEW.created_by;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

        SELECT COALESCE(au.raw_user_meta_data->>'fullName', 'Un rider') INTO rider_name
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
            u.raw_user_meta_data->>'fullName' as user_name,
            u.raw_user_meta_data->>'avatarUrl' as avatar_url
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
