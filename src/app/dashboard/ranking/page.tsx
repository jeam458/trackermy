import { ArrowLeft, Star, Crown } from 'lucide-react'
import Link from 'next/link'

export default function RankingPage() {
  const rankings = [
    { pos: 1, name: 'Carlos Gomez', time: '2:38', avatar: 'Carlos', change: 0, isCurrent: true },
    { pos: 2, name: 'Jully Kiviera', time: '2:27', avatar: 'Jully', change: -1, isCurrent: false },
    { pos: 3, name: 'John Williams', time: '2:16', avatar: 'John', change: 1, isCurrent: false },
    { pos: 4, name: 'Maria S.', time: '2:40', avatar: 'Maria', change: 2, isCurrent: false },
    { pos: 5, name: 'Alex P.', time: '2:50', avatar: 'Alex', change: -2, isCurrent: false },
  ]

  return (
    <div className="p-4 space-y-6 pt-12 pb-24">
      <header className="flex items-center gap-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-white transition">
          <ArrowLeft size={24} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-medium text-slate-300">Ranking Semanal</h1>
          <h2 className="text-2xl font-bold tracking-tight">La Bestia Dorada</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Finaliza en</p>
          <p className="font-bold text-lg">3 DÍAS</p>
        </div>
      </header>

      {/* Top 1 Highlight */}
      <section className="bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-sky-500/20 border border-indigo-500/30 p-6 rounded-[2rem] relative overflow-hidden flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(99,102,241,0.1)]">
        <div className="absolute top-4 left-4 font-black text-4xl text-white/90 italic drop-shadow-md">
          #1
        </div>
        <div className="absolute top-4 right-4 text-amber-400">
           <Star size={24} fill="currentColor" />
        </div>
        
        <div className="relative mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Carlos" 
            alt="Carlos" 
            className="w-20 h-20 rounded-full border-4 border-indigo-500/50 bg-slate-800 shadow-xl"
          />
          <div className="absolute -bottom-2 -right-2 bg-amber-500 p-1.5 rounded-full border-2 border-slate-900 shadow-lg">
            <Crown size={16} className="text-slate-900" />
          </div>
        </div>
        
        <h3 className="mt-4 text-xl font-bold">Carlos Gomez</h3>
        <p className="text-3xl font-black tracking-tighter mt-1 text-slate-200">2:38</p>
      </section>

      {/* List */}
      <section className="bg-slate-800/50 border border-slate-700 rounded-3xl overflow-hidden shadow-lg">
        {rankings.slice(1).map((rank) => (
          <div key={rank.pos} className="flex items-center gap-4 p-4 border-b border-slate-700/50 last:border-0 hover:bg-slate-800/80 transition-colors">
            <span className="font-bold text-slate-500 w-6 text-right">#{rank.pos}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${rank.avatar}`} alt={rank.name} className="w-10 h-10 bg-slate-700 rounded-full border border-slate-600" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{rank.name}</h4>
              <p className="text-slate-400 text-xs font-medium">{rank.time}</p>
            </div>
            <div className={`flex flex-col items-end text-xs font-bold ${rank.change > 0 ? 'text-emerald-400' : rank.change < 0 ? 'text-red-400' : 'text-slate-500'}`}>
               {rank.change > 0 ? '↑' : rank.change < 0 ? '↓' : '-'} {Math.abs(rank.change) || ''}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
