'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronRight, Camera, Plus, X } from 'lucide-react'
import { BrandSpinner } from '@/components/ui/BrandLogoLoader'
import { fadeSlideIn } from '@/lib/animeUi'
import type { BikeBrand, BikeModel } from '@/core/infrastructure/repositories/ProfileRepository'
import { toast } from '@/lib/toast'
import { useLocale } from '@/lib/i18n/LocaleProvider'

interface BikeSetupCardProps {
  frame: string
  fork: string
  drivetrain: string
  imageUrl?: string
  /** Miniatura del catálogo (modelo) si no hay foto propia */
  catalogThumbnailUrl?: string | null
  colorHex?: string
  brands: BikeBrand[]
  models: BikeModel[]
  brandId: string
  modelId: string
  isEditing?: boolean
  onFrameChange?: (frame: string) => void
  onForkChange?: (fork: string) => void
  onDrivetrainChange?: (dt: string) => void
  onBrandChange?: (brandId: string) => void
  onModelChange?: (modelId: string) => void
  onColorChange?: (hex: string) => void
  onImageClick?: () => void
  /** Nombres desde el servidor (RPC); modo lectura sin depender del catálogo en cliente */
  readOnlyBrandName?: string
  readOnlyModelName?: string
  /** Alta de marca en catálogo (crece la BD) */
  onCreateBrand?: (name: string) => Promise<BikeBrand>
  /** Alta de modelo para la marca actual */
  onCreateModel?: (brandId: string, name: string) => Promise<BikeModel>
  creatingBrand?: boolean
  creatingModel?: boolean
  /** Subida de foto de bicicleta en curso */
  uploadingBike?: boolean
  /** URLs adicionales (galería) */
  galleryUrls?: string[]
  uploadingGallery?: boolean
  onAddGalleryClick?: () => void
  onRemoveGalleryUrl?: (url: string) => void
}

export function BikeSetupCard({
  frame,
  fork,
  drivetrain,
  imageUrl,
  catalogThumbnailUrl,
  colorHex = '#f59e0b',
  brands,
  models,
  brandId,
  modelId,
  isEditing = false,
  onFrameChange,
  onForkChange,
  onDrivetrainChange,
  onBrandChange,
  onModelChange,
  onColorChange,
  onImageClick,
  readOnlyBrandName = '',
  readOnlyModelName = '',
  onCreateBrand,
  onCreateModel,
  creatingBrand = false,
  creatingModel = false,
  uploadingBike = false,
  galleryUrls = [],
  uploadingGallery = false,
  onAddGalleryClick,
  onRemoveGalleryUrl,
}: BikeSetupCardProps) {
  const { messages } = useLocale()
  const b = messages.profile.bike
  const rootRef = useRef<HTMLElement>(null)
  const tint = colorHex && /^#[0-9A-Fa-f]{6}$/.test(colorHex) ? colorHex : '#f59e0b'

  const slides = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    const add = (u: string | undefined | null) => {
      const t = u?.trim()
      if (!t || seen.has(t)) return
      seen.add(t)
      out.push(t)
    }
    add(imageUrl || undefined)
    for (const g of galleryUrls) add(g)
    if (!imageUrl?.trim()) add(catalogThumbnailUrl || undefined)
    return out
  }, [imageUrl, catalogThumbnailUrl, galleryUrls])

  const useMarquee = slides.length >= 2

  useEffect(() => {
    if (rootRef.current) fadeSlideIn(rootRef.current, { duration: 480, y: [20, 0] })
  }, [])

  const canRemoveSlide = (src: string) => {
    if (!isEditing || !onRemoveGalleryUrl) return false
    const s = src.trim()
    const primary = (imageUrl || '').trim()
    if (s === primary) return false
    return galleryUrls.some((u) => u.trim() === s)
  }

  const [brandQuery, setBrandQuery] = useState('')
  const [modelQuery, setModelQuery] = useState('')
  const [brandOpen, setBrandOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const brandWrapRef = useRef<HTMLDivElement>(null)
  const modelWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (brandWrapRef.current && !brandWrapRef.current.contains(t)) setBrandOpen(false)
      if (modelWrapRef.current && !modelWrapRef.current.contains(t)) setModelOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selectedBrand = useMemo(() => brands.find((b) => b.id === brandId), [brands, brandId])
  const selectedModel = useMemo(() => models.find((m) => m.id === modelId), [models, modelId])

  const brandFilter = brandQuery.trim().toLowerCase()
  const filteredBrands = useMemo(() => {
    if (!brandFilter) return brands
    return brands.filter((b) => b.name.toLowerCase().includes(brandFilter))
  }, [brands, brandFilter])

  const modelFilter = modelQuery.trim().toLowerCase()
  const filteredModels = useMemo(() => {
    if (!modelFilter) return models
    return models.filter((m) => m.name.toLowerCase().includes(modelFilter))
  }, [models, modelFilter])

  const canAddBrand =
    !!onCreateBrand &&
    brandQuery.trim().length >= 2 &&
    !brands.some((b) => b.name.toLowerCase() === brandQuery.trim().toLowerCase())

  const canAddModel =
    !!onCreateModel &&
    !!brandId &&
    modelQuery.trim().length >= 1 &&
    !models.some((m) => m.name.toLowerCase() === modelQuery.trim().toLowerCase())

  const brandInputDisplay = brandOpen ? brandQuery : selectedBrand?.name || ''
  const modelInputDisplay = modelOpen ? modelQuery : selectedModel?.name || ''

  return (
    <section
      ref={rootRef}
      className="bg-[#1e2529] border border-white/[0.07] backdrop-blur-md rounded-[1.35rem] p-5 shadow-lg relative overflow-hidden opacity-0"
    >
      <div className="flex justify-between items-center mb-4 relative z-10">
        <h3 className="font-semibold text-lg text-white tracking-tight flex items-center gap-2">{b.sectionTitle}</h3>
        {!isEditing && (
          <span className="text-slate-500" aria-hidden>
            <ChevronRight size={22} strokeWidth={2} />
          </span>
        )}
      </div>

      {isEditing && (
        <div className="space-y-3 mb-4 relative z-10">
          <div ref={brandWrapRef} className="relative">
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{b.brand}</label>
            <input
              type="text"
              value={brandInputDisplay}
              onChange={(e) => {
                setBrandQuery(e.target.value)
                setBrandOpen(true)
                if (brandId && e.target.value !== selectedBrand?.name) {
                  onBrandChange?.('')
                }
              }}
              onFocus={() => {
                setBrandOpen(true)
                setBrandQuery(selectedBrand?.name || '')
              }}
              placeholder={b.searchBrandPlaceholder}
              className="w-full text-sm bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
              autoComplete="off"
            />
            {brandOpen && (
              <ul className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-600 bg-[#1e2529] shadow-xl text-sm">
                {filteredBrands.length === 0 && !canAddBrand && (
                  <li className="px-3 py-2 text-slate-500">{b.noMatches}</li>
                )}
                {filteredBrands.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-slate-100 hover:bg-sky-600/30"
                      onClick={() => {
                        onBrandChange?.(b.id)
                        setBrandQuery('')
                        setBrandOpen(false)
                      }}
                    >
                      {b.name}
                    </button>
                  </li>
                ))}
                {canAddBrand && (
                  <li className="border-t border-slate-600/80">
                    <button
                      type="button"
                      disabled={creatingBrand}
                      className="w-full text-left px-3 py-2 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 flex items-center gap-2"
                      onClick={() => {
                        void (async () => {
                          try {
                            const b = await onCreateBrand!(brandQuery.trim())
                            onBrandChange?.(b.id)
                            setBrandQuery('')
                            setBrandOpen(false)
                          } catch (err) {
                            console.error(err)
                            toast.error(
                              b.errorCreateBrandTitle,
                              err instanceof Error ? err.message : b.tryAgain
                            )
                          }
                        })()
                      }}
                    >
                      {creatingBrand ? <BrandSpinner className="shrink-0" size={16} /> : null}
                      {b.addBrandPrefix}
                      {brandQuery.trim()}
                      {b.addBrandSuffix}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
          <div ref={modelWrapRef} className="relative">
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{b.model}</label>
            <input
              type="text"
              value={modelInputDisplay}
              disabled={!brandId}
              onChange={(e) => {
                setModelQuery(e.target.value)
                setModelOpen(true)
                if (modelId && e.target.value !== selectedModel?.name) {
                  onModelChange?.('')
                }
              }}
              onFocus={() => {
                if (!brandId) return
                setModelOpen(true)
                setModelQuery(selectedModel?.name || '')
              }}
              placeholder={brandId ? b.searchModelPlaceholder : b.pickBrandFirst}
              className="w-full text-sm bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-500 disabled:opacity-50"
              autoComplete="off"
            />
            {modelOpen && brandId && (
              <ul className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-600 bg-[#1e2529] shadow-xl text-sm">
                {filteredModels.length === 0 && !canAddModel && (
                  <li className="px-3 py-2 text-slate-500">{b.noMatches}</li>
                )}
                {filteredModels.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-slate-100 hover:bg-sky-600/30"
                      onClick={() => {
                        onModelChange?.(m.id)
                        setModelQuery('')
                        setModelOpen(false)
                      }}
                    >
                      {m.name}
                    </button>
                  </li>
                ))}
                {canAddModel && (
                  <li className="border-t border-slate-600/80">
                    <button
                      type="button"
                      disabled={creatingModel}
                      className="w-full text-left px-3 py-2 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 flex items-center gap-2"
                      onClick={() => {
                        void (async () => {
                          try {
                            const m = await onCreateModel!(brandId, modelQuery.trim())
                            onModelChange?.(m.id)
                            setModelQuery('')
                            setModelOpen(false)
                          } catch (err) {
                            console.error(err)
                            toast.error(
                              b.errorCreateModelTitle,
                              err instanceof Error ? err.message : b.tryAgain
                            )
                          }
                        })()
                      }}
                    >
                      {creatingModel ? <BrandSpinner className="shrink-0" size={16} /> : null}
                      {b.addModelPrefix}
                      {modelQuery.trim()}
                      {b.addModelSuffix}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{b.color}</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={tint}
                  onChange={(e) => onColorChange?.(e.target.value)}
                  className="h-10 w-14 rounded-lg border border-slate-600 bg-slate-900 cursor-pointer"
                />
                <input
                  type="text"
                  value={tint}
                  onChange={(e) => onColorChange?.(e.target.value)}
                  className="flex-1 text-sm font-mono bg-slate-800/80 border border-slate-600 rounded-lg px-2 py-2 text-slate-100 focus:outline-none focus:border-sky-500"
                  placeholder={b.colorPlaceholder}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 relative z-10 space-y-3">
        {slides.length === 0 ? (
          <div
            className={`h-40 bg-transparent flex items-center justify-center relative rounded-xl overflow-hidden ${
              isEditing ? 'cursor-pointer group ring-1 ring-slate-600 hover:ring-sky-500 transition-all bg-[#1e2529]' : ''
            }`}
            onClick={isEditing && !uploadingBike ? onImageClick : undefined}
          >
            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
              <span className="text-slate-500 text-sm">{b.noImage}</span>
              <span className="text-[11px] text-slate-600 text-center px-4">{b.noImageHint}</span>
            </div>
            {isEditing && !uploadingBike && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={28} className="text-white drop-shadow-md mb-1" />
                <span className="text-xs text-white font-medium bg-black/50 px-3 py-1 rounded-full">{b.primaryPhoto}</span>
              </div>
            )}
            {isEditing && uploadingBike && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 z-20">
                <BrandSpinner className="mb-2" size={28} />
                <span className="text-xs text-white/90">{b.uploading}</span>
              </div>
            )}
          </div>
        ) : useMarquee ? (
          <div
            className={`bike-gallery-marquee-outer overflow-hidden rounded-xl border border-white/10 bg-gdh-canvas-2 ${uploadingBike || uploadingGallery ? 'opacity-80' : ''}`}
          >
            <div className="bike-gallery-marquee-inner flex w-max gap-3 motion-reduce:!animate-none motion-reduce:max-w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:w-full">
              {[...slides, ...slides].map((src, i) => {
                const logical = i % slides.length
                const isPrimarySlot = logical === 0
                return (
                  <div
                    key={`mq-${i}-${src}`}
                    className={`relative shrink-0 w-[min(78vw,260px)] h-[168px] rounded-lg overflow-hidden bg-[#0f1316] shadow-inner shadow-black/40 ${
                      isPrimarySlot && isEditing && !uploadingBike && onImageClick
                        ? 'cursor-pointer ring-1 ring-white/15 hover:ring-teal-500/70'
                        : ''
                    }`}
                    onClick={
                      isPrimarySlot && isEditing && !uploadingBike && onImageClick ? () => onImageClick() : undefined
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className={`w-full h-full object-contain p-2 filter drop-shadow-lg ${isPrimarySlot && isEditing ? 'transition-opacity hover:opacity-90' : ''}`}
                    />
                    <div
                      className="pointer-events-none absolute inset-0 mix-blend-color opacity-35"
                      style={{ backgroundColor: tint }}
                      aria-hidden
                    />
                    {isPrimarySlot && isEditing && !uploadingBike && (
                      <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] text-white font-medium">
                        {b.mainBadge}
                      </span>
                    )}
                    {canRemoveSlide(src) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveGalleryUrl?.(src)
                        }}
                        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-red-500/90 z-10"
                        aria-label={b.removePhotoAria}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className={`overflow-x-auto overflow-y-hidden rounded-xl border border-white/10 bg-gdh-canvas-2 pb-2 ${uploadingBike || uploadingGallery ? 'opacity-85' : ''}`}>
            <div className="flex gap-3 min-w-max snap-x snap-mandatory px-1 py-1">
              {slides.map((src, idx) => (
                <div
                  key={`static-${src}-${idx}`}
                  className={`relative shrink-0 w-[min(78vw,260px)] h-[168px] snap-center rounded-lg overflow-hidden bg-[#0f1316] ${
                    idx === 0 && isEditing && !uploadingBike && onImageClick
                      ? 'cursor-pointer ring-1 ring-white/15 hover:ring-teal-500/70'
                      : ''
                  }`}
                  onClick={
                    idx === 0 && isEditing && !uploadingBike && onImageClick ? () => onImageClick() : undefined
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full object-contain p-2 filter drop-shadow-lg"
                  />
                  <div className="pointer-events-none absolute inset-0 mix-blend-color opacity-35" style={{ backgroundColor: tint }} aria-hidden />
                  {idx === 0 && isEditing && !uploadingBike && (
                    <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] text-white font-medium">
                      {b.mainBadge}
                    </span>
                  )}
                  {canRemoveSlide(src) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveGalleryUrl?.(src)
                      }}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white hover:bg-red-500/90 z-10"
                      aria-label={b.removePhotoAria}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isEditing && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={uploadingBike}
              onClick={() => {
                void onImageClick?.()
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-gdh-canvas-2 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-gdh-elevated disabled:opacity-45"
            >
              <Camera size={14} />
              {slides.length === 0 ? b.uploadPrimary : b.changePrimary}
            </button>
            {onAddGalleryClick && (
              <button
                type="button"
                disabled={uploadingBike || uploadingGallery}
                onClick={onAddGalleryClick}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-gdh-canvas-2 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-gdh-elevated disabled:opacity-45"
              >
                {uploadingGallery ? (
                  <BrandSpinner className="shrink-0" size={14} />
                ) : (
                  <Plus size={14} className="shrink-0" />
                )}
                {b.morePhotos}
              </button>
            )}
          </div>
        )}

        {isEditing && (uploadingBike || uploadingGallery) && slides.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-center text-[11px] text-slate-300">
            {uploadingBike && <p>{b.updatingPrimaryMap}</p>}
            {!uploadingBike && uploadingGallery && <p>{b.uploadingExtra}</p>}
          </div>
        )}
      </div>

      {!isEditing && (readOnlyBrandName || readOnlyModelName || brandId || modelId) && (
        <p className="text-center text-sm text-slate-300 mb-4">
          {[readOnlyBrandName || brands.find((b) => b.id === brandId)?.name, readOnlyModelName || models.find((m) => m.id === modelId)?.name]
            .filter(Boolean)
            .join(' · ') || b.readOnlyBikeFallback}
        </p>
      )}

      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-600 to-transparent mb-4 opacity-50 relative z-10" />

      <div className="grid grid-cols-3 gap-2 divide-x divide-slate-600/50 relative z-10">
        <div className="text-center px-1 flex flex-col items-center">
          <p className="text-[11px] text-slate-400 mb-1 font-medium uppercase tracking-wider">{b.frame}</p>
          {isEditing ? (
            <input
              type="text"
              value={frame}
              onChange={(e) => onFrameChange?.(e.target.value)}
              className="w-full text-sm font-semibold text-center text-slate-100 bg-slate-800/50 border border-slate-600 rounded px-1 py-1 focus:outline-none focus:border-sky-500"
            />
          ) : (
            <p className="text-sm font-semibold text-slate-200 truncate w-full">{frame || '—'}</p>
          )}
        </div>
        <div className="text-center px-1 flex flex-col items-center">
          <p className="text-[11px] text-slate-400 mb-1 font-medium uppercase tracking-wider">{b.fork}</p>
          {isEditing ? (
            <input
              type="text"
              value={fork}
              onChange={(e) => onForkChange?.(e.target.value)}
              className="w-full text-sm font-semibold text-center text-slate-100 bg-slate-800/50 border border-slate-600 rounded px-1 py-1 focus:outline-none focus:border-sky-500"
            />
          ) : (
            <p className="text-sm font-semibold text-slate-200 truncate w-full">{fork || '—'}</p>
          )}
        </div>
        <div className="text-center px-1 flex flex-col items-center">
          <p className="text-[11px] text-slate-400 mb-1 font-medium uppercase tracking-wider">{b.drivetrain}</p>
          {isEditing ? (
            <input
              type="text"
              value={drivetrain}
              onChange={(e) => onDrivetrainChange?.(e.target.value)}
              className="w-full text-sm font-semibold text-center text-slate-100 bg-slate-800/50 border border-slate-600 rounded px-1 py-1 focus:outline-none focus:border-sky-500"
            />
          ) : (
            <p className="text-sm font-semibold text-slate-200 truncate w-full">{drivetrain || '—'}</p>
          )}
        </div>
      </div>
    </section>
  )
}
