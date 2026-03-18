import { TrophyIcon, Camera } from 'lucide-react'

interface UserHeaderProps {
  name: string
  bio: string
  avatarUrl: string
  hasCrown?: boolean
  isEditing?: boolean
  onNameChange?: (name: string) => void
  onBioChange?: (bio: string) => void
  onAvatarClick?: () => void
}

export function UserHeader({
  name,
  bio,
  avatarUrl,
  hasCrown = false,
  isEditing = false,
  onNameChange,
  onBioChange,
  onAvatarClick,
}: UserHeaderProps) {
  return (
    <section className="flex flex-col items-center">
      <div className="relative mt-4">
        {/* Decorative background ring for avatar matching the mockup */}
        <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-sky-400 opacity-70 blur-sm"></div>
        
        <div 
          className={`relative w-28 h-28 rounded-full border-[3px] border-[#2A3439] bg-slate-700 shadow-xl overflow-hidden ${
            isEditing ? 'cursor-pointer group' : ''
          }`}
          onClick={isEditing ? onAvatarClick : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt={`Avatar of ${name}`}
            className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-50"
          />
          {isEditing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={28} className="text-white drop-shadow-md" />
            </div>
          )}
        </div>

        {hasCrown && !isEditing && (
          <div className="absolute -bottom-2 -right-2 bg-[#d4af37] rounded-full p-1.5 border-[3px] border-[#2A3439] shadow-md z-10">
            <TrophyIcon size={16} className="text-[#2A3439]" fill="currentColor" />
          </div>
        )}
      </div>

      {isEditing ? (
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange?.(e.target.value)}
          className="mt-6 text-2xl font-semibold text-center text-slate-100 bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-1 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 w-full max-w-[250px] transition-colors"
          placeholder="Tu nombre"
        />
      ) : (
        <h2 className="mt-6 text-2xl font-semibold text-slate-100 tracking-wide">{name}</h2>
      )}

      {isEditing ? (
        <textarea
          value={bio}
          onChange={(e) => onBioChange?.(e.target.value)}
          className="mt-3 text-center text-sm text-slate-300 bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 w-full max-w-[320px] resize-none h-20 transition-colors"
          placeholder="Escribe algo sobre ti..."
        />
      ) : (
        <p className="mt-2 text-center text-sm text-slate-400 max-w-[300px] leading-relaxed">
          {bio}
        </p>
      )}
    </section>
  )
}
