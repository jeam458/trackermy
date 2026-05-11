-- Atajos de voz por usuario (skills controlados: solo navegación a rutas permitidas)

CREATE TABLE IF NOT EXISTS public.user_voice_shortcuts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    phrase_display TEXT NOT NULL,
    phrase_normalized TEXT NOT NULL,
    intent_slug TEXT NOT NULL DEFAULT 'navigate' CHECK (intent_slug = 'navigate'),
    path TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'es' CHECK (locale IN ('es', 'en')),
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_voice_shortcuts_path_prefix CHECK (path LIKE '/dashboard%'),
    CONSTRAINT user_voice_shortcuts_unique_phrase UNIQUE (user_id, phrase_normalized)
);

CREATE INDEX IF NOT EXISTS idx_user_voice_shortcuts_user ON public.user_voice_shortcuts (user_id);

COMMENT ON TABLE public.user_voice_shortcuts IS
  'Frases aprendidas del usuario → navegación dashboard; sin código arbitrario ni datos de terceros.';

ALTER TABLE public.user_voice_shortcuts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_voice_shortcuts_select_own" ON public.user_voice_shortcuts;
CREATE POLICY "user_voice_shortcuts_select_own"
    ON public.user_voice_shortcuts FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_voice_shortcuts_insert_own" ON public.user_voice_shortcuts;
CREATE POLICY "user_voice_shortcuts_insert_own"
    ON public.user_voice_shortcuts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_voice_shortcuts_update_own" ON public.user_voice_shortcuts;
CREATE POLICY "user_voice_shortcuts_update_own"
    ON public.user_voice_shortcuts FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_voice_shortcuts_delete_own" ON public.user_voice_shortcuts;
CREATE POLICY "user_voice_shortcuts_delete_own"
    ON public.user_voice_shortcuts FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_voice_shortcuts TO authenticated;
