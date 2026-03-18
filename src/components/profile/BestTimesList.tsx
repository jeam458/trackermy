import { Trophy } from 'lucide-react'

export interface BestTimeEntry {
  id: string
  position: 1 | 2 | 3 | number
  routeName: string
  difficulty: 'Expert' | 'Intermediate' | 'Beginner'
  distance: string
  time: string
}

interface BestTimesListProps {
  times: BestTimeEntry[]
}

export function BestTimesList({ times }: BestTimesListProps) {
  const getGradientByPosition = (position: number) => {
    switch (position) {
      case 1:
        return 'from-amber-500/20 to-[#2A3439]/40 border-l-amber-500'
      case 2:
        return 'from-slate-300/20 to-[#2A3439]/40 border-l-slate-300'
      case 3:
        return 'from-amber-700/20 to-[#2A3439]/40 border-l-amber-700'
      default:
        return 'from-slate-600/20 to-[#2A3439]/40 border-l-slate-600'
    }
  }

  const getTextColorByPosition = (position: number) => {
    switch (position) {
      case 1:
        return 'text-amber-500'
      case 2:
        return 'text-slate-300'
      case 3:
        return 'text-amber-600'
      default:
        return 'text-slate-500'
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
          Mejores Puestos
        </h3>
        <p className="text-sm text-slate-400 mt-1">Top 3 puestos en todas las rutas</p>
      </div>

      <div className="space-y-3">
        {times.map((time) => (
          <div
            key={time.id}
            className={`flex items-center gap-4 bg-gradient-to-r p-4 rounded-xl border border-transparent border-l-[4px] shadow-sm backdrop-blur-sm ${getGradientByPosition(
              time.position
            )}`}
          >
            {/* Position Column */}
            <div
              className={`font-black text-2xl w-10 flex items-center justify-center shrink-0 ${getTextColorByPosition(
                time.position
              )}`}
            >
              {time.position}º
            </div>

            {/* Route Details */}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-100 text-base truncate">
                {time.routeName}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {time.difficulty} • {time.distance}
              </p>
            </div>

            {/* Time / Graph Mockup */}
            <div className="flex flex-col items-end shrink-0">
              {/* Fake little sparkline graph (using SVG) */}
              <svg width="48" height="24" viewBox="0 0 48 24" className="opacity-70 mb-1">
                <path
                  d="M0 20 Q 5 15, 10 18 T 20 10 T 30 15 T 40 5 L 48 8"
                  fill="transparent"
                  stroke={time.position === 1 ? '#f59e0b' : '#a8a29e'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <div
                className={`text-xs font-semibold tracking-wider ${getTextColorByPosition(
                  time.position
                )} opacity-80`}
              >
                {time.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
