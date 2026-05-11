'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PetEmotion } from '@/components/pet/guardDhPetTypes'
import type { PetAmbientRecipe, PetEnterRecipe } from '@/lib/pet/petEmotionAnimationRecipe'
import type { PetEmotionRegistryEntry } from '@/lib/pet/petEmotionRegistry.types'

type PetEmotionRecipeContextValue = {
  /** Definiciones por slug (pueden extender o anular animaciones embebidas). */
  bySlug: Map<string, PetEmotionRegistryEntry>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const PetEmotionRecipeContext = createContext<PetEmotionRecipeContextValue | null>(null)

export function PetEmotionRecipeProvider({ children }: { children: ReactNode }) {
  const [bySlug, setBySlug] = useState<Map<string, PetEmotionRegistryEntry>>(() => new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/dashboard/pet-emotions', { method: 'GET', cache: 'no-store' })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      const j = (await r.json()) as { definitions?: PetEmotionRegistryEntry[] }
      const m = new Map<string, PetEmotionRegistryEntry>()
      for (const d of j.definitions || []) {
        if (d?.slug) m.set(d.slug, d)
      }
      setBySlug(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar emociones')
      setBySlug(new Map())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      bySlug,
      loading,
      error,
      refresh,
    }),
    [bySlug, loading, error, refresh]
  )

  return <PetEmotionRecipeContext.Provider value={value}>{children}</PetEmotionRecipeContext.Provider>
}

export function usePetEmotionRecipes(): PetEmotionRecipeContextValue {
  const v = useContext(PetEmotionRecipeContext)
  if (!v) {
    return {
      bySlug: new Map(),
      loading: false,
      error: null,
      refresh: async () => {},
    }
  }
  return v
}

export function usePetEmotionRecipeFor(emotion: PetEmotion): {
  ambient: PetAmbientRecipe | null
  enter: PetEnterRecipe | null
  rostro: PetEmotionRegistryEntry['rostro']
  proceduralFace: PetEmotionRegistryEntry['proceduralFace']
} {
  const { bySlug } = usePetEmotionRecipes()
  return useMemo(() => {
    const row = bySlug.get(emotion)
    return {
      ambient: row?.ambient ?? null,
      enter: row?.enter ?? null,
      rostro: row?.rostro ?? null,
      proceduralFace: row?.proceduralFace ?? null,
    }
  }, [bySlug, emotion])
}
