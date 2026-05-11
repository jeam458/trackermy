import type { Route } from './RouteSelectionModal'
import { Plus } from 'lucide-react'
import { useLocale } from '@/lib/i18n/LocaleProvider'

interface PreferredRoutesProps {
  selectedRoutes: Route[]
  isEditing: boolean
  onAddRouteClick: () => void
  /** Avatar del usuario para miniatura en cada fila (mockup) */
  userAvatarUrl?: string
}

/** Barras decorativas tipo sparkline (scores aún no enlazados a BD en todos los casos). */
function MiniSpark({ variant }: { variant: 'gold' | 'silver' | 'bronze' }) {
  const heights = variant === 'gold' ? [40, 55, 35, 70, 50, 80, 45, 92] : variant === 'silver' ? [35, 48, 55, 40, 62, 50, 70, 58] : [45, 38, 52, 60, 48, 72, 55, 68]
  const grad =
    variant === 'gold'
      ? 'from-sky-500 to-cyan-400'
      : variant === 'silver'
        ? 'from-violet-500 to-purple-400'
        : 'from-orange-500 to-amber-400'

  const score =
    variant === 'gold'
      ? '12.315/20'
      : variant === 'silver'
        ? '11.982/20'
        : variant === 'bronze'
          ? '12.312/20'
          : '—/20'

  return (
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      <div className="flex items-end gap-px h-8">
        {heights.map((h, i) => (
          <div
            key={i}
            className={`w-[3px] rounded-t-[1px] bg-gradient-to-t ${grad} opacity-90`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <span className="text-[9px] font-mono text-slate-500 tabular-nums">{score}</span>
    </div>
  )
}

const rankStyle = (idx: number) => {
  if (idx === 0) return 'from-amber-400 to-yellow-600 text-gdh-on-brand'
  if (idx === 1) return 'from-slate-200 to-slate-400 text-slate-900'
  return 'from-orange-700 to-amber-800 text-amber-100'
}

const sparkVariant = (idx: number): 'gold' | 'silver' | 'bronze' => {
  if (idx === 0) return 'gold'
  if (idx === 1) return 'silver'
  return 'bronze'
}

export function PreferredRoutes({ selectedRoutes, isEditing, onAddRouteClick, userAvatarUrl }: PreferredRoutesProps) {
  const { messages } = useLocale()
  const p = messages.profile.preferredRoutes

  const defaultThumb =
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect fill="%23334155" width="40" height="40"/><circle cx="20" cy="14" r="6" fill="%2394a3b8"/></svg>`
    )

  const formatDifficulty = (d: string) =>
    d === 'Expert'
      ? p.difficultyExpert
      : d === 'Intermediate'
        ? p.difficultyIntermediate
        : p.difficultyBeginner

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h3 className="font-semibold text-lg text-white tracking-tight">{p.title}</h3>
          <p className="text-[13px] text-slate-500 mt-1 leading-snug">{p.subtitle}</p>
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={onAddRouteClick}
            className="p-2.5 bg-violet-500/15 text-violet-300 rounded-xl border border-violet-500/25 hover:bg-violet-500/25 transition-colors shrink-0"
            title={p.pickRoutesTitle}
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {selectedRoutes.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-white/10 rounded-[1.25rem] bg-gdh-card/80">
            <p className="text-slate-500 text-sm">{p.empty}</p>
            {isEditing && (
              <button type="button" onClick={onAddRouteClick} className="mt-3 text-sm font-medium text-teal-400 hover:text-teal-300">
                {p.addFeatured}
              </button>
            )}
          </div>
        ) : (
          selectedRoutes.slice(0, 3).map((route, idx) => (
            <div
              key={route.id}
              className="flex items-center gap-3 bg-[#1e2529]/95 p-4 rounded-[1.15rem] border border-white/[0.06] shadow-sm"
            >
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${rankStyle(idx)} flex items-center justify-center font-black text-sm shrink-0 shadow-inner`}
              >
                {idx + 1}º
              </div>
              <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 border border-white/10 bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={userAvatarUrl?.trim() ? userAvatarUrl : defaultThumb} alt="" className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white text-[15px] leading-tight truncate">{route.name}</h4>
                <p className="text-[12px] text-slate-500 mt-0.5 truncate">
                  {formatDifficulty(route.difficulty)} · {route.distance}
                </p>
              </div>

              <MiniSpark variant={sparkVariant(idx)} />
            </div>
          ))
        )}
      </div>
    </section>
  )
}
