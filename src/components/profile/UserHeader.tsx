import { Crown, Camera } from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { useLocale } from '@/lib/i18n/LocaleProvider'

const DEFAULT_AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect fill="#334155" width="64" height="64"/><circle cx="32" cy="24" r="10" fill="#94a3b8"/><path fill="#94a3b8" d="M14 58c2-12 12-18 18-18s16 6 18 18"/></svg>`
  )

interface UserHeaderProps {
  name: string
  bio: string
  avatarUrl: string
  hasCrown?: boolean
  isEditing?: boolean
  onNameChange?: (name: string) => void
  onBioChange?: (bio: string) => void
  onAvatarClick?: () => void
  /** Subida del avatar en curso */
  uploadingAvatar?: boolean
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
  uploadingAvatar = false,
}: UserHeaderProps) {
  const { messages } = useLocale()
  const t = messages.profile.userHeader

  return (
    <section className="flex flex-col items-center px-1">
      <div className="relative mt-2">
        <div
          className={`rounded-full p-[3px] bg-gradient-to-tr from-indigo-400 via-violet-500 to-sky-400 shadow-[0_0_24px_rgba(99,102,241,0.35)] ${isEditing ? 'cursor-pointer group' : ''}`}
          onClick={isEditing ? onAvatarClick : undefined}
          role={isEditing ? 'button' : undefined}
        >
          <div className="rounded-full bg-gdh-canvas-2 p-[2px]">
            <div className="relative w-[7.25rem] h-[7.25rem] rounded-full overflow-hidden bg-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl?.trim() ? avatarUrl : DEFAULT_AVATAR}
                alt=""
                className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-85"
              />
              {isEditing && !uploadingAvatar && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera size={26} className="text-white drop-shadow-md" aria-hidden />
                </div>
              )}
              {isEditing && uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55 rounded-full">
                  <BrandSpinner size={26} />
                </div>
              )}
            </div>
          </div>
        </div>

        {hasCrown && (
          <div
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-gdh-canvas-2 bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 shadow-lg z-10"
            aria-hidden
          >
            <Crown size={17} className="text-amber-950 fill-amber-950 drop-shadow-sm" strokeWidth={1.75} />
          </div>
        )}
      </div>

      {isEditing ? (
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange?.(e.target.value)}
          className="mt-7 text-[1.35rem] font-semibold text-center text-white bg-[#1e2529] border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 w-full max-w-[min(100%,320px)] transition-colors"
          placeholder={t.namePlaceholder}
        />
      ) : (
        <h2 className="mt-7 text-[1.35rem] font-semibold text-white tracking-tight text-center">{name}</h2>
      )}

      {isEditing ? (
        <textarea
          value={bio}
          onChange={(e) => onBioChange?.(e.target.value)}
          className="mt-3 text-center text-sm text-slate-300 bg-[#1e2529] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 w-full max-w-[min(100%,340px)] resize-none min-h-[5rem] leading-relaxed"
          placeholder={t.bioPlaceholder}
        />
      ) : (
        <p className="mt-2.5 text-center text-[0.9375rem] text-slate-400 max-w-[min(100%,320px)] leading-relaxed">
          {bio || <span className="text-slate-600">{t.noBio}</span>}
        </p>
      )}
    </section>
  )
}
