'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Settings, Save, X, Menu } from 'lucide-react'
import { createClient } from '@/core/infrastructure/supabase/client'
import {
  ProfileRepository,
  type BikeBrand,
  type BikeModel,
} from '@/core/infrastructure/repositories/ProfileRepository'
import { UserHeader } from '@/components/profile/UserHeader'
import { BikeSetupCard } from '@/components/profile/BikeSetupCard'
import { RouteSelectionModal, type Route as PreferredRouteRow } from '@/components/profile/RouteSelectionModal'
import { PreferredRoutes } from '@/components/profile/PreferredRoutes'
import { RiderStatsPanel } from '@/components/profile/RiderStatsPanel'
import { createSquareMapIconPng, MAP_ICON_MAP_SIZE } from '@/lib/mapIconFromImage'
import { PageLoadingShimmer } from '@/components/ui/PageLoadingShimmer'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { AnimeIconButton } from '@/components/ui/AnimeIconButton'
import {
  DashboardAppTopBar,
  DashboardAppTopBarHeading,
  DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS,
  DashboardAppTopBarTrailingCluster,
} from '@/app/dashboard/components/DashboardAppTopBar'
import { useDashboardSidebar } from '@/lib/dashboard/DashboardSidebarContext'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { getAuthUserOrNull } from '@/lib/authSession'
import { resetGuideModelsAndBootstrap } from '@/lib/guide-ai/webLlmCacheAdmin'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { getMessages } from '@/messages/getMessages'
import type { AppLocale } from '@/messages/types'

const UserCreatedRoutesMap = dynamic(
  () =>
    import('@/components/profile/UserCreatedRoutesMap').then((mod) => ({
      default: mod.UserCreatedRoutesMap,
    })),
  { ssr: false }
)

const profileRepo = new ProfileRepository()

const SHOW_IA_CACHE_RESET =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_IA_CACHE_RESET === '1'

function normalizeBikePhotoGallery(raw: unknown): string[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
}

export default function ProfilePage() {
  const { messages, setLocale, locale } = useLocale()
  const { openSidebar } = useDashboardSidebar()
  const p = messages.profile

  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBike, setUploadingBike] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [creatingBrand, setCreatingBrand] = useState(false)
  const [creatingModel, setCreatingModel] = useState(false)
  const [iaCacheResetting, setIaCacheResetting] = useState(false)
  /** Icono reducido para mapas (distinto del avatar de perfil). */
  const [mapAvatarUrl, setMapAvatarUrl] = useState<string | null>(null)
  const [mapIconUrl, setMapIconUrl] = useState<string | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bikeInputRef = useRef<HTMLInputElement>(null)
  const bikeGalleryInputRef = useRef<HTMLInputElement>(null)

  const [brands, setBrands] = useState<BikeBrand[]>([])
  const [models, setModels] = useState<BikeModel[]>([])

  const [user, setUser] = useState({
    name: '',
    bio: '',
    avatarUrl: '',
    hasCrown: false,
  })
  const [riderWeightKg, setRiderWeightKg] = useState('')
  const [bike, setBike] = useState({
    frame: '',
    fork: '',
    drivetrain: '',
    imageUrl: '',
    brandId: '',
    modelId: '',
    colorHex: '#f59e0b',
  })
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([])
  const [bikeReadOnlyNames, setBikeReadOnlyNames] = useState({ brand: '', model: '' })
  const [bikeGalleryUrls, setBikeGalleryUrls] = useState<string[]>([])
  const [preferredRoutesRows, setPreferredRoutesRows] = useState<PreferredRouteRow[]>([])

  useEffect(() => {
    profileRepo.listBikeBrands().then(setBrands)
  }, [])

  useEffect(() => {
    if (!bike.brandId) {
      setModels([])
      return
    }
    profileRepo.listBikeModels(bike.brandId).then(setModels)
  }, [bike.brandId])

  const catalogThumbnailUrl = useMemo(() => {
    const m = models.find((x) => x.id === bike.modelId)
    return m?.thumbnail_url ?? null
  }, [models, bike.modelId])

  const riderWeightNum = useMemo(() => {
    if (riderWeightKg.trim() === '') return null
    const n = Number(riderWeightKg)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [riderWeightKg])

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supaUser = await getAuthUserOrNull()

        if (!supaUser) {
          console.warn('Usuario no autenticado')
          return
        }

        setUserId(supaUser.id)

        const profile = await profileRepo.getProfile(supaUser.id)

        if (profile) {
          const lang: AppLocale = profile.preferred_language === 'en' ? 'en' : 'es'
          setLocale(lang)
          const pm = getMessages(lang).profile
          setUser({
            name: profile.full_name || supaUser.email?.split('@')[0] || pm.defaultUserName,
            bio: profile.bio || '',
            avatarUrl: profile.avatar_url || '',
            hasCrown: profile.has_crown || false,
          })
          const rw = profile.rider_weight_kg
          setRiderWeightKg(rw != null ? String(rw) : '')
          setBike({
            frame: profile.frame || '',
            fork: profile.fork || '',
            drivetrain: profile.drivetrain || '',
            imageUrl: profile.bike_image_url || '',
            brandId: profile.bike_brand_id || '',
            modelId: profile.bike_model_id || '',
            colorHex:
              profile.color_hex && /^#[0-9A-Fa-f]{6}$/.test(profile.color_hex)
                ? profile.color_hex
                : '#f59e0b',
          })
          setBikeReadOnlyNames({
            brand: profile.bike_brand_name || '',
            model: profile.bike_model_name || '',
          })
          setBikeGalleryUrls(normalizeBikePhotoGallery(profile.bike_photo_gallery))
          setMapAvatarUrl(profile.map_avatar_url ?? null)
          setMapIconUrl(profile.bike_map_icon_url ?? null)
        }

        const preferredRoutes = await profileRepo.getPreferredRoutes(supaUser.id)
        setSelectedRouteIds(preferredRoutes)
      } catch (error) {
        console.error('Error cargando perfil:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [setLocale])

  useEffect(() => {
    if (selectedRouteIds.length === 0) {
      setPreferredRoutesRows([])
      return
    }
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('routes')
        .select('id, name, difficulty, distance_km')
        .in('id', selectedRouteIds)

      if (cancelled || error || !data) return

      const orderIdx = new Map(selectedRouteIds.map((id, i) => [id, i]))
      const isDiff = (d: string): d is PreferredRouteRow['difficulty'] =>
        d === 'Beginner' || d === 'Intermediate' || d === 'Expert'

      const rows: PreferredRouteRow[] = [...data]
        .sort((a, b) => (orderIdx.get(a.id as string) ?? 0) - (orderIdx.get(b.id as string) ?? 0))
        .map((r) => {
          const d = typeof r.difficulty === 'string' ? r.difficulty : 'Intermediate'
          return {
            id: r.id as string,
            name: String(r.name),
            difficulty: isDiff(d) ? d : 'Intermediate',
            distance: `${Number(r.distance_km).toFixed(2).replace('.', ',')} km`,
            location: '',
          }
        })
      setPreferredRoutesRows(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedRouteIds])

  const handleToggleRoute = (routeId: string) => {
    setSelectedRouteIds((prev) =>
      prev.includes(routeId) ? prev.filter((id) => id !== routeId) : [...prev, routeId]
    )
  }

  const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return

    setUploadingAvatar(true)
    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${userId}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, {
        upsert: true,
      })
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(fileName)

      const mapBlob = await createSquareMapIconPng(file, MAP_ICON_MAP_SIZE)
      const mapPath = `${userId}/avatar-map.png`
      const { error: mapErr } = await supabase.storage.from('map-icons').upload(mapPath, mapBlob, {
        upsert: true,
        contentType: 'image/png',
      })
      if (mapErr) throw mapErr
      const {
        data: { publicUrl: mapPublicUrl },
      } = supabase.storage.from('map-icons').getPublicUrl(mapPath)

      const preferred = await profileRepo.getPreferredRoutes(userId)
      await profileRepo.saveCompleteProfile(
        userId,
        {
          full_name: user.name,
          bio: user.bio,
          avatar_url: publicUrl,
          map_avatar_url: mapPublicUrl,
          has_crown: user.hasCrown,
          rider_weight_kg: riderWeightNum,
        },
        {},
        preferred
      )

      setUser((u) => ({ ...u, avatarUrl: publicUrl }))
      setMapAvatarUrl(mapPublicUrl)
    } catch (e) {
      console.error(e)
      toast.error(p.toasts.avatarUploadErrorTitle, p.toasts.avatarUploadErrorBody)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleBikeFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return

    setUploadingBike(true)
    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${userId}/bike.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('bike-photos').upload(fileName, file, {
        upsert: true,
      })
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('bike-photos').getPublicUrl(fileName)

      const mapBlob = await createSquareMapIconPng(file, MAP_ICON_MAP_SIZE)
      const mapPath = `${userId}/bike-map.png`
      const { error: mapErr } = await supabase.storage.from('map-icons').upload(mapPath, mapBlob, {
        upsert: true,
        contentType: 'image/png',
      })
      if (mapErr) throw mapErr
      const {
        data: { publicUrl: bikeMapPublicUrl },
      } = supabase.storage.from('map-icons').getPublicUrl(mapPath)

      await profileRepo.updateBikeSetup(userId, {
        image_url: publicUrl,
        map_icon_url: bikeMapPublicUrl,
      })

      setBike((b) => ({ ...b, imageUrl: publicUrl }))
      setMapIconUrl(bikeMapPublicUrl)
    } catch (e) {
      console.error(e)
      toast.error(p.toasts.bikePhotoErrorTitle, p.toasts.bikePhotoErrorBody)
    } finally {
      setUploadingBike(false)
    }
  }

  const handleBikeGalleryFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    event.target.value = ''
    if (!files?.length || !userId) return

    setUploadingGallery(true)
    try {
      const supabase = createClient()
      const additions: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        const fileExt = file.name.split('.').pop() || 'jpg'
        const fileName = `${userId}/bike-gallery/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('bike-photos').upload(fileName, file)
        if (uploadError) throw uploadError
        const {
          data: { publicUrl },
        } = supabase.storage.from('bike-photos').getPublicUrl(fileName)
        additions.push(publicUrl)
      }

      const merged = [...bikeGalleryUrls, ...additions]
      setBikeGalleryUrls(merged)
      await profileRepo.updateBikeSetup(userId, { photo_gallery: merged })
    } catch (e) {
      console.error(e)
      toast.error(p.toasts.galleryErrorTitle, p.toasts.galleryErrorBody)
    } finally {
      setUploadingGallery(false)
    }
  }

  const handleRemoveGalleryUrl = async (url: string) => {
    if (!userId) return
    const next = bikeGalleryUrls.filter((u) => u !== url)
    setBikeGalleryUrls(next)
    try {
      await profileRepo.updateBikeSetup(userId, { photo_gallery: next })
    } catch (e) {
      console.error(e)
      toast.error(p.toasts.galleryUpdateErrorTitle, p.toasts.galleryUpdateErrorBody)
    }
  }

  const handleSave = async () => {
    if (!userId) {
      toast.warning(p.toasts.notAuthTitle, p.toasts.notAuthSaveBody)
      return
    }

    setIsSaving(true)

    try {
      await profileRepo.saveCompleteProfile(
        userId,
        {
          full_name: user.name,
          bio: user.bio,
          avatar_url: user.avatarUrl,
          map_avatar_url: mapAvatarUrl,
          has_crown: user.hasCrown,
          rider_weight_kg: riderWeightNum,
          preferred_language: locale,
        },
        {
          frame: bike.frame,
          fork: bike.fork,
          drivetrain: bike.drivetrain,
          image_url: bike.imageUrl,
          brand_id: bike.brandId || null,
          model_id: bike.modelId || null,
          color_hex: bike.colorHex || null,
          map_icon_url: mapIconUrl,
          photo_gallery: bikeGalleryUrls,
        },
        selectedRouteIds
      )

      toast.success(p.toasts.saveSuccessTitle, p.toasts.saveSuccessBody)
      setBikeReadOnlyNames({
        brand: brands.find((b) => b.id === bike.brandId)?.name || '',
        model: models.find((m) => m.id === bike.modelId)?.name || '',
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Error guardando perfil:', error)
      const detail =
        error instanceof Error ? error.message : typeof error === 'string' ? error : p.toasts.saveErrorFallback
      toast.error(p.toasts.saveErrorTitle, detail)
    } finally {
      setIsSaving(false)
    }
  }

  const persistLang = async (next: AppLocale) => {
    if (next === locale) return
    setLocale(next)
    if (!userId) return
    try {
      await profileRepo.updateProfile(userId, { preferred_language: next })
    } catch (e) {
      console.error(e)
      toast.error(p.language.saveErrorTitle, p.toasts.saveErrorFallback)
    }
  }

  const handleCancel = () => {
    if (userId) {
      profileRepo.getProfile(userId).then((profile) => {
        if (profile) {
          setUser({
            name: profile.full_name || '',
            bio: profile.bio || '',
            avatarUrl: profile.avatar_url || '',
            hasCrown: profile.has_crown || false,
          })
          const rw = profile.rider_weight_kg
          setRiderWeightKg(rw != null ? String(rw) : '')
          setBike({
            frame: profile.frame || '',
            fork: profile.fork || '',
            drivetrain: profile.drivetrain || '',
            imageUrl: profile.bike_image_url || '',
            brandId: profile.bike_brand_id || '',
            modelId: profile.bike_model_id || '',
            colorHex:
              profile.color_hex && /^#[0-9A-Fa-f]{6}$/.test(profile.color_hex)
                ? profile.color_hex
                : '#f59e0b',
          })
          setBikeReadOnlyNames({
            brand: profile.bike_brand_name || '',
            model: profile.bike_model_name || '',
          })
          setBikeGalleryUrls(normalizeBikePhotoGallery(profile.bike_photo_gallery))
          setMapAvatarUrl(profile.map_avatar_url ?? null)
          setMapIconUrl(profile.bike_map_icon_url ?? null)
        }
      })
    }
    setIsEditing(false)
  }

  if (isLoading) {
    return <PageLoadingShimmer label={p.loading} />
  }

  return (
    <div className="gdh-immersive-page min-h-screen text-slate-100 font-sans selection:bg-amber-500/30">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFile}
      />
      <input
        ref={bikeInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBikeFile}
      />
      <input
        ref={bikeGalleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleBikeGalleryFiles}
      />

      <DashboardAppTopBar
        leading={
          <AnimeIconButton
            label="Menú"
            onClick={() => openSidebar()}
            className={cn(DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS)}
          >
            <Menu size={22} aria-hidden />
          </AnimeIconButton>
        }
        center={<DashboardAppTopBarHeading title={messages.nav.profile} />}
        trailing={
          <DashboardAppTopBarTrailingCluster className="gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 p-2.5 text-slate-200 hover:bg-white/10 disabled:opacity-50"
                >
                  <X size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/90 p-2.5 text-[#1e2529] hover:bg-amber-400 disabled:opacity-50"
                >
                  {isSaving ? <BrandSpinner size={20} /> : <Save size={20} />}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={cn(
                  DASHBOARD_APP_TOP_BAR_ICON_BUTTON_CLASS,
                  'border border-white/15 bg-white/5 hover:bg-white/10',
                )}
              >
                <Settings size={20} className="text-slate-200" aria-hidden />
              </button>
            )}
          </DashboardAppTopBarTrailingCluster>
        }
      >
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{p.language.label}</p>
            <p className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{p.language.hint}</p>
          </div>
          <div className="inline-flex shrink-0 rounded-xl border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => void persistLang('es')}
              aria-label={p.language.ariaEs}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                locale === 'es'
                  ? 'border border-gdh-brand/40 bg-gdh-brand/25 text-gdh-brand-highlight'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.language.optionEs}
            </button>
            <button
              type="button"
              onClick={() => void persistLang('en')}
              aria-label={p.language.ariaEn}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                locale === 'en'
                  ? 'border border-gdh-brand/40 bg-gdh-brand/25 text-gdh-brand-highlight'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.language.optionEn}
            </button>
          </div>
        </div>
      </DashboardAppTopBar>

      <div className="max-w-md mx-auto px-4 space-y-10 pb-28">

        <UserHeader
          {...user}
          isEditing={isEditing}
          uploadingAvatar={uploadingAvatar}
          onNameChange={(name) => setUser({ ...user, name })}
          onBioChange={(bio) => setUser({ ...user, bio })}
          onAvatarClick={() => {
            if (!uploadingAvatar) avatarInputRef.current?.click()
          }}
        />

        {isEditing && (
          <div className="max-w-xs mx-auto -mt-2">
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 text-center">
              {p.weight.label}
            </label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="300"
              value={riderWeightKg}
              onChange={(e) => setRiderWeightKg(e.target.value)}
              className="w-full text-sm text-center bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-gdh-brand/50"
              placeholder={p.weight.placeholder}
            />
          </div>
        )}

        <BikeSetupCard
          frame={bike.frame}
          fork={bike.fork}
          drivetrain={bike.drivetrain}
          imageUrl={bike.imageUrl}
          catalogThumbnailUrl={catalogThumbnailUrl}
          colorHex={bike.colorHex}
          readOnlyBrandName={bikeReadOnlyNames.brand}
          readOnlyModelName={bikeReadOnlyNames.model}
          brands={brands}
          models={models}
          brandId={bike.brandId}
          modelId={bike.modelId}
          isEditing={isEditing}
          creatingBrand={creatingBrand}
          creatingModel={creatingModel}
          onCreateBrand={
            userId
              ? async (name) => {
                  setCreatingBrand(true)
                  try {
                    const b = await profileRepo.createBikeBrand(name, userId)
                    setBrands(await profileRepo.listBikeBrands())
                    return b
                  } finally {
                    setCreatingBrand(false)
                  }
                }
              : undefined
          }
          onCreateModel={
            userId
              ? async (bid, name) => {
                  setCreatingModel(true)
                  try {
                    const m = await profileRepo.createBikeModel(bid, name, userId)
                    setModels(await profileRepo.listBikeModels(bid))
                    return m
                  } finally {
                    setCreatingModel(false)
                  }
                }
              : undefined
          }
          onFrameChange={(frame) => setBike({ ...bike, frame })}
          onForkChange={(fork) => setBike({ ...bike, fork })}
          onDrivetrainChange={(drivetrain) => setBike({ ...bike, drivetrain })}
          onBrandChange={(brandId) => setBike({ ...bike, brandId, modelId: '' })}
          onModelChange={(modelId) => setBike({ ...bike, modelId })}
          onColorChange={(colorHex) => setBike({ ...bike, colorHex })}
          onImageClick={() => {
            if (!uploadingBike) bikeInputRef.current?.click()
          }}
          uploadingBike={uploadingBike}
          galleryUrls={bikeGalleryUrls}
          uploadingGallery={uploadingGallery}
          onAddGalleryClick={() => bikeGalleryInputRef.current?.click()}
          onRemoveGalleryUrl={(url) => {
            void handleRemoveGalleryUrl(url)
          }}
        />

        <PreferredRoutes
          selectedRoutes={preferredRoutesRows}
          isEditing={isEditing}
          onAddRouteClick={() => setIsModalOpen(true)}
          userAvatarUrl={user.avatarUrl}
        />

        <UserCreatedRoutesMap userId={userId} />

        {SHOW_IA_CACHE_RESET ? (
          <section className="rounded-2xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm">
            <p className="font-semibold text-amber-100">{p.iaCache.title}</p>
            <p className="mt-1 text-amber-200/80 text-xs leading-relaxed">
              {p.iaCache.bodyLead}{' '}
              <code className="text-amber-100/95">{p.iaCache.bodyVarName}</code> {p.iaCache.bodyTrail}
            </p>
            <button
              type="button"
              disabled={iaCacheResetting}
              onClick={() => {
                void (async () => {
                  setIaCacheResetting(true)
                  try {
                    const r = await resetGuideModelsAndBootstrap()
                    if (r.failed.length) {
                      toast.warning(
                        `Caché: eliminados ${r.removedIds.length}. Avisos: ${r.failed.map((f) => f.id).join(', ')}`
                      )
                    } else {
                      toast.success(p.iaCache.success)
                    }
                    window.setTimeout(() => window.location.reload(), 600)
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : p.iaCache.fail)
                  } finally {
                    setIaCacheResetting(false)
                  }
                })()
              }}
              className="mt-2 w-full rounded-lg bg-amber-600/80 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-500 disabled:opacity-50"
            >
              {iaCacheResetting ? p.iaCache.clearing : p.iaCache.button}
            </button>
          </section>
        ) : null}

        <RiderStatsPanel userId={userId} riderWeightKg={riderWeightNum} />
      </div>

      <RouteSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedRouteIds={selectedRouteIds}
        onToggleRoute={handleToggleRoute}
      />
    </div>
  )
}
