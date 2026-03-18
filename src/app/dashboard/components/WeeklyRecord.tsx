import { Trophy, TrendingUp } from 'lucide-react'

interface WeeklyRecordProps {
  routeName: string
  difficulty: "Expert" | "Intermediate" | "Beginner"
  distance: string
  topTime: string
  topRiderName: string
  topRiderAvatar: string
}

export default function WeeklyRecord({
  routeName,
  difficulty,
  distance,
  topTime,
  topRiderName,
  topRiderAvatar
}: WeeklyRecordProps) {
  const getDifficultyColor = (diff: string) => {
    switch(diff) {
      case 'Expert': return 'text-red-400'
      case 'Intermediate': return 'text-amber-400'
      case 'Beginner': return 'text-emerald-400'
      default: return 'text-slate-400'
    }
  }

  return (
    <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-4 rounded-2xl flex items-center justify-between shadow-lg transition-transform active:scale-[0.98]">
      <div className="flex-1 space-y-2">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{routeName}</h3>
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            <span className={getDifficultyColor(difficulty)}>{difficulty}</span>
            <span className="mx-1">•</span>
            {distance}
          </p>
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={topRiderAvatar} 
            alt={topRiderName}
            className="w-6 h-6 rounded-full border border-slate-600 bg-slate-700"
          />
          <p className="text-sm font-semibold text-slate-300">
            {topRiderName} <span className="font-normal text-slate-500">- {topTime}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 pl-4 border-l border-slate-700/50">
        <div className="bg-sky-500/10 p-2 rounded-xl text-sky-400">
          <TrendingUp size={20} />
        </div>
        {/* Mock mini chart - using simple bars for UI demonstration based on images */}
        <div className="flex items-end gap-1 h-6">
          <div className="w-1.5 h-[40%] bg-sky-600 rounded-t-sm opacity-50"></div>
          <div className="w-1.5 h-[60%] bg-sky-500 rounded-t-sm opacity-70"></div>
          <div className="w-1.5 h-[80%] bg-sky-400 rounded-t-sm opacity-90"></div>
          <div className="w-1.5 h-full bg-sky-300 rounded-t-sm drop-shadow-[0_0_3px_rgba(56,189,248,0.8)]"></div>
        </div>
      </div>
    </div>
  )
}
