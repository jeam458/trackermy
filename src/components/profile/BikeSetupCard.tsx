import { ChevronRight, Camera } from 'lucide-react'

interface BikeSetupCardProps {
  frame: string
  fork: string
  drivetrain: string
  imageUrl?: string
  isEditing?: boolean
  onFrameChange?: (frame: string) => void
  onForkChange?: (fork: string) => void
  onDrivetrainChange?: (dt: string) => void
  onImageClick?: () => void
}

export function BikeSetupCard({
  frame,
  fork,
  drivetrain,
  imageUrl,
  isEditing = false,
  onFrameChange,
  onForkChange,
  onDrivetrainChange,
  onImageClick
}: BikeSetupCardProps) {
  return (
    <section className="bg-[#2A3439]/80 backdrop-blur-md rounded-[1.5rem] p-5 shadow-lg relative overflow-hidden">
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h3 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
          Mi Bici
        </h3>
        {!isEditing && (
          <button className="text-slate-400 hover:text-slate-200 transition-colors">
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      <div 
        className={`h-40 mb-6 bg-transparent flex items-center justify-center relative z-10 rounded-xl overflow-hidden ${
          isEditing ? 'cursor-pointer group ring-1 ring-slate-600 hover:ring-sky-500 transition-all' : ''
        }`}
        onClick={isEditing ? onImageClick : undefined}
      >
        {imageUrl ? (
           /* eslint-disable-next-line @next/next/no-img-element */
          <img 
            src={imageUrl} 
            alt="My Bike" 
            className={`w-full h-full object-contain filter drop-shadow-xl saturate-150 contrast-125 transition-opacity ${
              isEditing ? 'group-hover:opacity-40' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full bg-[#1e2529] flex items-center justify-center">
             <span className="text-slate-500 text-sm">Image not available</span>
          </div>
        )}
        
        {isEditing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={32} className="text-white drop-shadow-md mb-2" />
            <span className="text-xs text-white font-medium bg-black/50 px-3 py-1 rounded-full">Cambiar foto</span>
          </div>
        )}
      </div>

      {/* Stats Divider Line matching mockup */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-600 to-transparent mb-4 opacity-50 relative z-10"></div>

      <div className="grid grid-cols-3 gap-2 divide-x divide-slate-600/50 relative z-10">
         <div className="text-center px-1 flex flex-col items-center">
           <p className="text-[11px] text-slate-400 mb-1 font-medium uppercase tracking-wider">Frame</p>
           {isEditing ? (
             <input
               type="text"
               value={frame}
               onChange={(e) => onFrameChange?.(e.target.value)}
               className="w-full text-sm font-semibold text-center text-slate-100 bg-slate-800/50 border border-slate-600 rounded px-1 py-1 focus:outline-none focus:border-sky-500"
             />
           ) : (
             <p className="text-sm font-semibold text-slate-200 truncate w-full">{frame}</p>
           )}
         </div>
         <div className="text-center px-1 flex flex-col items-center">
           <p className="text-[11px] text-slate-400 mb-1 font-medium uppercase tracking-wider">Fork</p>
           {isEditing ? (
             <input
               type="text"
               value={fork}
               onChange={(e) => onForkChange?.(e.target.value)}
               className="w-full text-sm font-semibold text-center text-slate-100 bg-slate-800/50 border border-slate-600 rounded px-1 py-1 focus:outline-none focus:border-sky-500"
             />
           ) : (
             <p className="text-sm font-semibold text-slate-200 truncate w-full">{fork}</p>
           )}
         </div>
         <div className="text-center px-1 flex flex-col items-center">
           <p className="text-[11px] text-slate-400 mb-1 font-medium uppercase tracking-wider">Drivetrain</p>
           {isEditing ? (
             <input
               type="text"
               value={drivetrain}
               onChange={(e) => onDrivetrainChange?.(e.target.value)}
               className="w-full text-sm font-semibold text-center text-slate-100 bg-slate-800/50 border border-slate-600 rounded px-1 py-1 focus:outline-none focus:border-sky-500"
             />
           ) : (
             <p className="text-sm font-semibold text-slate-200 truncate w-full">{drivetrain}</p>
           )}
         </div>
      </div>
    </section>
  )
}
