import { NextResponse } from 'next/server'
import { createClient } from '@/core/infrastructure/supabase/server'
import { isVoiceNavPathAllowed } from '@/lib/voice/voiceNavigateAllowlist'
import { normalizeVoicePhrase, sanitizeTranscriptForDisplay } from '@/lib/voice/voicePrivacy'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { data, error } = await supabase
    .from('user_voice_shortcuts')
    .select('id, phrase_display, phrase_normalized, path, locale, use_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ shortcuts: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { phrase_display?: unknown; path?: unknown; locale?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const phraseDisplay = sanitizeTranscriptForDisplay(String(body.phrase_display || ''))
  const path = String(body.path || '').trim()
  const locale = body.locale === 'en' ? 'en' : 'es'

  if (!phraseDisplay || phraseDisplay.length < 2) {
    return NextResponse.json({ error: 'Frase demasiado corta' }, { status: 400 })
  }
  if (!isVoiceNavPathAllowed(path)) {
    return NextResponse.json({ error: 'Ruta no permitida para voz' }, { status: 400 })
  }

  const phrase_normalized = normalizeVoicePhrase(phraseDisplay)
  if (phrase_normalized.length < 2) {
    return NextResponse.json({ error: 'Frase no válida tras normalizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_voice_shortcuts')
    .insert({
      user_id: user.id,
      phrase_display: phraseDisplay.slice(0, 200),
      phrase_normalized,
      intent_slug: 'navigate',
      path,
      locale,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un atajo con esa frase' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data?.id })
}
