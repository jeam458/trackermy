import { ArrowLeft, PlayIcon } from 'lucide-react'
import Link from 'next/link'
import MapPlaceholderWrapper from '../components/MapPlaceholderWrapper'

export default function RecordPage() {
  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden relative">
      <div className="absolute top-12 left-4 z-[400]">
        <Link href="/dashboard" className="p-2 bg-slate-800/80 rounded-full border border-slate-700/50 backdrop-blur block text-white">
          <ArrowLeft size={20} />
        </Link>
      </div>

      {/* Map Background Wrapper */}
      <div className="absolute inset-0 z-0 h-[65%]">
        <MapPlaceholderWrapper />
        {/* Gradient overlay for blending */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-[400] pointer-events-none"></div>
      </div>

      {/* recording dashboard overlay */}
      <div className="absolute bottom-0 w-full z-10 bg-slate-900/90 backdrop-blur-xl border-t border-slate-700 rounded-t-[40px] pt-8 px-6 pb-28 flex flex-col items-center">
        <h2 className="text-xl font-bold tracking-tight mb-2">¡Prepárate para la bajada!</h2>
        <p className="text-slate-400 text-sm mb-8 text-center px-4">
          Iniciando validación de velocidad en el punto de partida...
        </p>

        {/* Huge Countdown Display mock */}
        <div className="relative w-40 h-40 flex items-center justify-center rounded-full bg-slate-800 border-[6px] border-emerald-400/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
           <svg className="absolute inset-0 w-full h-full transform -rotate-90">
             <circle 
                cx="80" 
                cy="80" 
                r="74" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="6" 
                strokeDasharray="465"
                strokeDashoffset="120"
                className="transition-all duration-1000 ease-linear"
             />
           </svg>
           <span className="text-6xl font-black text-white">3</span>
        </div>

        <div className="w-full mt-10 flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
          <div className="flex items-center gap-3">
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Carlos" className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600" alt="avatar" />
             <span className="font-medium">Validando...</span>
          </div>
          <div className="bg-slate-700/50 p-2 rounded-full">
            <PlayIcon size={20} className="text-sky-400 pl-0.5" />
          </div>
        </div>
      </div>
    </div>
  )
}
