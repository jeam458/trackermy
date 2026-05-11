'use client'

import { useCallback, useState } from 'react'
import { Search, Loader2, Play, Plus, Volume2 } from 'lucide-react'
import { buildYoutubeWatchUrl } from '@/lib/youtubeVideoId'

type Hit = {
  id: string
  title: string
  channelTitle: string
  thumbnailUrl: string | null
}

function attributionForHit(h: Hit): string {
  return `YouTube: «${h.title}» — ${h.channelTitle}. Solo para preview en la app; verificá derechos antes de publicar el reel exportado.`
}

type Props = {
  onPick: (opts: { watchUrl: string; attribution: string }) => void
}

export function ReelYoutubeMusicPicker({ onPick }: Props) {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [apiMissing, setApiMissing] = useState(false)
  const [hits, setHits] = useState<Hit[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)

  const runSearch = useCallback(async () => {
    const term = q.trim()
    if (term.length < 2) {
      setErr('Escribí al menos 2 caracteres.')
      return
    }
    setLoading(true)
    setErr(null)
    setApiMissing(false)
    try {
      const res = await fetch(`/api/dashboard/youtube-search?q=${encodeURIComponent(term)}`, {
        credentials: 'include',
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        configured?: boolean
        items?: Hit[]
      }
      if (res.status === 503 && json.configured === false) {
        setApiMissing(true)
        setHits([])
        setPlayingId(null)
        return
      }
      if (!res.ok) throw new Error(json.error || res.statusText)
      const list = Array.isArray(json.items) ? json.items : []
      setHits(list)
      setPlayingId(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al buscar')
      setHits([])
      setPlayingId(null)
    } finally {
      setLoading(false)
    }
  }, [q])

  const addHit = (h: Hit) => {
    onPick({
      watchUrl: buildYoutubeWatchUrl(h.id),
      attribution: attributionForHit(h),
    })
  }

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-950/10 p-2 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-red-200/90">
        YouTube (búsqueda + vista previa)
      </p>
      <p className="text-[9px] text-slate-500 leading-snug">
        Tocá una fila para <span className="text-slate-400">escuchar solo el audio</span> (el reproductor queda oculto).
        <span className="text-slate-400"> Agregar</span> guarda esa pista como fondo del reel.
      </p>
      {apiMissing ? (
        <p className="text-[10px] text-amber-200/90 leading-snug">
          Falta la variable de entorno <code className="text-amber-100/90">YOUTUBE_DATA_API_KEY</code> en el servidor
          (Google Cloud → YouTube Data API v3 → credenciales). Sin ella no podemos buscar; igual podés pegar un enlace
          manual abajo.
        </p>
      ) : null}
      <div className="flex gap-1.5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void runSearch()
            }
          }}
          placeholder="Nombre de tema o artista…"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void runSearch()}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-red-500/35 bg-red-900/40 px-2.5 py-1.5 text-[10px] font-medium text-red-100 hover:bg-red-900/55 disabled:opacity-45"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          Buscar
        </button>
      </div>
      {err ? <p className="text-[10px] text-red-300/90">{err}</p> : null}

      {hits.length > 0 ? (
        <>
          <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Resultados</p>
          <ul className="max-h-[min(42vh,260px)] overflow-y-auto rounded-md border border-white/10 bg-black/35 p-1 space-y-1">
            {hits.map((h) => {
              const active = playingId === h.id
              return (
                <li key={h.id}>
                  <div
                    className={`flex items-stretch gap-1.5 rounded-md border transition-colors ${
                      active
                        ? 'border-red-400/50 bg-red-950/35'
                        : 'border-transparent bg-transparent hover:bg-white/[0.04]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPlayingId(h.id)}
                      className="min-w-0 flex-1 flex items-center gap-2 rounded-l-md px-1.5 py-1.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-red-400/70"
                      aria-label={`Escuchar: ${h.title}`}
                    >
                      {h.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={h.thumbnailUrl}
                          alt=""
                          className="h-10 w-[4.5rem] shrink-0 rounded object-cover bg-black"
                          width={72}
                          height={40}
                        />
                      ) : (
                        <span className="flex h-10 w-[4.5rem] shrink-0 items-center justify-center rounded bg-white/10 text-red-300/90">
                          <Play size={16} strokeWidth={2.25} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-medium leading-snug text-slate-100 line-clamp-2">
                          {h.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[9px] text-slate-500">{h.channelTitle}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-center justify-center text-red-300/85">
                        <Volume2 size={14} />
                        <span className="text-[8px] font-medium uppercase tracking-wide">Audio</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        addHit(h)
                      }}
                      className="shrink-0 flex w-[4.25rem] flex-col items-center justify-center gap-0.5 self-stretch rounded-r-md border-l border-white/10 bg-emerald-950/45 px-1 py-1 text-[9px] font-semibold leading-tight text-emerald-100 hover:bg-emerald-900/55 active:bg-emerald-900/70"
                      aria-label={`Agregar al reel: ${h.title}`}
                    >
                      <Plus size={16} strokeWidth={2.5} className="text-emerald-200" />
                      Agregar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          {playingId ? (
            <>
              <p className="flex items-center gap-1.5 text-[9px] text-slate-400">
                <Volume2 size={12} className="text-red-300/80 shrink-0" />
                Reproduciendo audio de la fila marcada (sin vídeo visible).
              </p>
              {/* iframe fuera de pantalla: el usuario solo escucha; autoplay tras gesto (clic en la fila). */}
              <div
                className="pointer-events-none fixed -left-[240px] top-0 h-[135px] w-[240px] overflow-hidden opacity-0"
                aria-hidden
              >
                <iframe
                  key={playingId}
                  title="Audio YouTube (oculto)"
                  className="h-full w-full border-0"
                  src={`https://www.youtube.com/embed/${encodeURIComponent(playingId)}?rel=0&autoplay=1&playsinline=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                />
              </div>
            </>
          ) : (
            <p className="text-[9px] text-slate-600">Tocá un resultado para escucharlo sin abrir el reproductor grande.</p>
          )}
        </>
      ) : null}
    </div>
  )
}
