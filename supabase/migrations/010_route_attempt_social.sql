-- Social interactions for route attempts: likes and comments

CREATE TABLE IF NOT EXISTS public.route_attempt_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.route_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(attempt_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.route_attempt_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.route_attempts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_attempt_likes_attempt ON public.route_attempt_likes(attempt_id);
CREATE INDEX IF NOT EXISTS idx_route_attempt_likes_user ON public.route_attempt_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_route_attempt_comments_attempt ON public.route_attempt_comments(attempt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_attempt_comments_user ON public.route_attempt_comments(user_id);

ALTER TABLE public.route_attempt_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_attempt_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes readable by authenticated users" ON public.route_attempt_likes;
CREATE POLICY "likes readable by authenticated users"
ON public.route_attempt_likes FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "likes insert own user" ON public.route_attempt_likes;
CREATE POLICY "likes insert own user"
ON public.route_attempt_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes delete own user" ON public.route_attempt_likes;
CREATE POLICY "likes delete own user"
ON public.route_attempt_likes FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments readable by authenticated users" ON public.route_attempt_comments;
CREATE POLICY "comments readable by authenticated users"
ON public.route_attempt_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "comments insert own user" ON public.route_attempt_comments;
CREATE POLICY "comments insert own user"
ON public.route_attempt_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments delete own user" ON public.route_attempt_comments;
CREATE POLICY "comments delete own user"
ON public.route_attempt_comments FOR DELETE
USING (auth.uid() = user_id);
