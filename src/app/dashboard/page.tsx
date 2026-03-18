import WeeklyRecord from './components/WeeklyRecord'
import { ArrowUpRight } from 'lucide-react'
import MapPlaceholderWrapper from './components/MapPlaceholderWrapper'

export default function DashboardPage() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center pt-8 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rutas Cercanas</h1>
          <p className="text-sm text-gray-400 mt-1">
            Explora las rutas de downhill cerca de tu ubicación
          </p>
        </div>
      </header>

      {/* Map Section */}
      <section className="relative w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50">
        <MapPlaceholderWrapper />
        
        {/* Floating actions on map */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[400]">
           <button className="bg-slate-800/80 p-3 rounded-full backdrop-blur text-white shadow-lg hover:bg-slate-700 transition">
             <ArrowUpRight size={20} />
           </button>
        </div>
      </section>

      {/* Popular Routes List */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Popular Rutas
        </h2>
        
        <WeeklyRecord 
          routeName="La Bestia Dorada" 
          difficulty="Expert"
          distance="2,12 km"
          topTime="2:38"
          topRiderName="Carlos Gomez"
          topRiderAvatar="https://api.dicebear.com/7.x/notionists/svg?seed=Carlos"
        />

        <WeeklyRecord 
          routeName="Sendero del Diablo" 
          difficulty="Intermediate"
          distance="2,3 km"
          topTime="2:45"
          topRiderName="Juan P."
          topRiderAvatar="https://api.dicebear.com/7.x/notionists/svg?seed=Juan"
        />

        <WeeklyRecord 
          routeName="La Serpiente de Roca" 
          difficulty="Intermediate"
          distance="7,5 km"
          topTime="3:12"
          topRiderName="Maria S."
          topRiderAvatar="https://api.dicebear.com/7.x/notionists/svg?seed=Maria"
        />
      </section>
    </div>
  )
}
