import { NextResponse } from 'next/server'
import { createClient } from '@/core/infrastructure/supabase/server'

export type YoutubeSearchHit = {
  id: string
  title: string
  channelTitle: string
  thumbnailUrl: string | null
}

/**
 * Búsqueda de vídeos en YouTube (Data API v3). Requiere `YOUTUBE_DATA_API_KEY` en el servidor.
 * La IFrame Player API es solo en el cliente para reproducir; aquí solo listamos resultados.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (q.length < 2) {
    return NextResponse.json({ error: 'Escribí al menos 2 caracteres para buscar.' }, { status: 400 })
  }
  if (q.length > 120) {
    return NextResponse.json({ error: 'La búsqueda es demasiado larga.' }, { status: 400 })
  }

  const key = process.env.YOUTUBE_DATA_API_KEY?.trim()
  if (!key) {
    return NextResponse.json(
      {
        configured: false,
        error:
          'YouTube Data API no está configurada. Añadí YOUTUBE_DATA_API_KEY en las variables de entorno del servidor.',
        items: [] as YoutubeSearchHit[],
      },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', '12')
  url.searchParams.set('q', q)
  url.searchParams.set('key', key)

  const r = await fetch(url.toString(), { next: { revalidate: 0 } })
  const json = (await r.json().catch(() => ({}))) as {
    error?: { message?: string }
    items?: Array<{
      id?: { videoId?: string }
      snippet?: { title?: string; channelTitle?: string; thumbnails?: { default?: { url?: string } } }
    }>
  }

  if (!r.ok) {
    const msg = json.error?.message || r.statusText
    console.error('[youtube-search]', r.status, msg)
    return NextResponse.json({ error: msg || 'Error de YouTube Data API' }, { status: 502 })
  }

  const items: YoutubeSearchHit[] = []
  for (const row of json.items || []) {
    const id = row.id?.videoId
    if (!id || id.length !== 11) continue
    const sn = row.snippet
    items.push({
      id,
      title: typeof sn?.title === 'string' ? sn.title : 'Sin título',
      channelTitle: typeof sn?.channelTitle === 'string' ? sn.channelTitle : '',
      thumbnailUrl: sn?.thumbnails?.default?.url ?? null,
    })
  }

  return NextResponse.json({ configured: true, items })
}
