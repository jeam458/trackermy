import { enqueueMaintenanceCatalogResearchIfNeeded } from '@/lib/maintenance/enqueueCatalogResearch'
import { createClient } from '../supabase/client'

/** Evita enviar texto vacío o UUID inválido a columnas UUID (Postgres rechaza ''). */
function asUuidOrNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const s = String(value).trim()
  if (!s) return null
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRe.test(s) ? s : null
}

/** PostgREST cuando la columna `photo_gallery` aún no existe en el proyecto (migración 008 sin aplicar). */
function isMissingPhotoGallerySchemaError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('photo_gallery') && (m.includes('schema cache') || m.includes('column'))
}

export interface Profile {
  id: string
  full_name: string
  bio: string
  avatar_url: string
  map_avatar_url?: string | null
  has_crown: boolean
  rider_weight_kg?: number | null
  /** Idioma de interfaz guardado en `profiles.preferred_language`. */
  preferred_language?: 'es' | 'en' | null
}

export interface BikeBrand {
  id: string
  name: string
  logo_url: string | null
  sort_order: number
  created_by?: string | null
}

export interface BikeModel {
  id: string
  brand_id: string
  name: string
  category: string
  thumbnail_url: string | null
  sort_order: number
  created_by?: string | null
}

export interface BikeSetup {
  id: string
  user_id: string
  frame: string
  fork: string
  drivetrain: string
  image_url: string
  brand_id: string | null
  model_id: string | null
  color_hex: string | null
  map_icon_url: string | null
  is_primary: boolean
  /** URLs públicas extra (jsonb en BD) */
  photo_gallery?: string[]
}

export interface UserRoute {
  id: string
  user_id: string
  route_id: string
  is_preferred: boolean
}

export interface ProfileWithBike {
  id: string
  full_name: string
  bio: string
  avatar_url: string
  map_avatar_url?: string | null
  has_crown: boolean
  rider_weight_kg?: number | null
  preferred_language?: 'es' | 'en' | null
  frame: string | null
  fork: string | null
  drivetrain: string | null
  bike_image_url: string | null
  bike_map_icon_url?: string | null
  bike_brand_id: string | null
  bike_model_id: string | null
  bike_brand_name: string | null
  bike_model_name: string | null
  bike_model_thumbnail_url: string | null
  color_hex: string | null
  /** URLs de fotos extra de la bici (además de bike_image_url) */
  bike_photo_gallery?: string[] | null
}

export interface UserRideAttemptRow {
  id: string
  route_id: string
  total_time: number
  moving_time: number
  stopped_time: number
  max_speed: number
  avg_speed: number
  distance: number
  elevation_gain: number | null
  elevation_loss: number | null
  completed_at: string | null
  gps_points: unknown
  routes: { id: string; name: string } | null
}

export class ProfileRepository {
  private client = createClient()

  async getProfile(userId: string): Promise<ProfileWithBike | null> {
    const { data, error } = await this.client
      .rpc('get_profile_with_bike', { profile_id: userId })

    if (error || !data || data.length === 0) {
      return null
    }

    const row = data[0] as ProfileWithBike & { preferred_language?: string | null }
    const lang = row.preferred_language === 'en' ? 'en' : 'es'
    return { ...row, preferred_language: lang }
  }

  async updateProfile(
    userId: string,
    updates: Partial<
      Pick<Profile, 'full_name' | 'bio' | 'avatar_url' | 'map_avatar_url' | 'has_crown' | 'rider_weight_kg' | 'preferred_language'>
    >
  ): Promise<void> {
    const { error } = await this.client
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`)
    }
  }

  async getBikeSetup(userId: string): Promise<BikeSetup | null> {
    const { data, error } = await this.client
      .from('bike_setups')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.warn('[getBikeSetup]', error.message)
      return null
    }

    return data ?? null
  }

  async listBikeBrands(): Promise<BikeBrand[]> {
    const { data, error } = await this.client
      .from('bike_brands')
      .select('id, name, logo_url, sort_order, created_by')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.warn('bike_brands:', error.message)
      return []
    }
    return (data || []) as BikeBrand[]
  }

  async listBikeModels(brandId: string): Promise<BikeModel[]> {
    const { data, error } = await this.client
      .from('bike_models')
      .select('id, brand_id, name, category, thumbnail_url, sort_order, created_by')
      .eq('brand_id', brandId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.warn('bike_models:', error.message)
      return []
    }
    return (data || []) as BikeModel[]
  }

  /** Marca nueva (crece el catálogo; nombre único). */
  async createBikeBrand(name: string, userId: string): Promise<BikeBrand> {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Nombre de marca vacío')
    }
    const { data, error } = await this.client
      .from('bike_brands')
      .insert({
        name: trimmed,
        sort_order: 10000,
        created_by: userId,
      })
      .select('id, name, logo_url, sort_order, created_by')
      .single()

    if (error) {
      if (error.code === '23505') {
        const { data: existing, error: e2 } = await this.client
          .from('bike_brands')
          .select('id, name, logo_url, sort_order, created_by')
          .eq('name', trimmed)
          .single()
        if (e2 || !existing) throw new Error(error.message)
        return existing as BikeBrand
      }
      throw new Error(error.message)
    }
    enqueueMaintenanceCatalogResearchIfNeeded(this.client, {
      userId,
      rawBrand: trimmed,
      rawModel: null,
      sourceContext: 'profile_new_bike_brand',
    }).catch(() => {})
    return data as BikeBrand
  }

  async createBikeModel(brandId: string, name: string, userId: string): Promise<BikeModel> {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Nombre de modelo vacío')
    }
    const { data, error } = await this.client
      .from('bike_models')
      .insert({
        brand_id: brandId,
        name: trimmed,
        category: 'downhill',
        sort_order: 10000,
        created_by: userId,
      })
      .select('id, brand_id, name, category, thumbnail_url, sort_order, created_by')
      .single()

    if (error) {
      if (error.code === '23505') {
        const { data: existing, error: e2 } = await this.client
          .from('bike_models')
          .select('id, brand_id, name, category, thumbnail_url, sort_order, created_by')
          .eq('brand_id', brandId)
          .eq('name', trimmed)
          .single()
        if (e2 || !existing) throw new Error(error.message)
        return existing as BikeModel
      }
      throw new Error(error.message)
    }
    const { data: brRow } = await this.client.from('bike_brands').select('name').eq('id', brandId).maybeSingle()
    const bname = typeof brRow?.name === 'string' ? brRow.name.trim() : ''
    if (bname) {
      enqueueMaintenanceCatalogResearchIfNeeded(this.client, {
        userId,
        rawBrand: bname,
        rawModel: trimmed,
        sourceContext: 'profile_new_bike_model',
      }).catch(() => {})
    }
    return data as BikeModel
  }

  async updateBikeSetup(
    userId: string,
    updates: Partial<
      Pick<
        BikeSetup,
        | 'frame'
        | 'fork'
        | 'drivetrain'
        | 'image_url'
        | 'brand_id'
        | 'model_id'
        | 'color_hex'
        | 'map_icon_url'
        | 'photo_gallery'
      >
    >
  ): Promise<void> {
    // Verificar si ya existe un bike setup
    const existing = await this.getBikeSetup(userId)

    const brandId = asUuidOrNull(updates.brand_id as string | null | undefined)
    const modelId = asUuidOrNull(updates.model_id as string | null | undefined)

    if (existing) {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      for (const [key, val] of Object.entries(updates) as [string, unknown][]) {
        if (val === undefined) continue
        if (key === 'brand_id') {
          payload.brand_id = brandId
          continue
        }
        if (key === 'model_id') {
          payload.model_id = modelId
          continue
        }
        if (key === 'photo_gallery') {
          payload.photo_gallery = Array.isArray(val) ? val : []
          continue
        }
        payload[key] = val
      }

      let { error } = await this.client.from('bike_setups').update(payload).eq('id', existing.id)

      if (error && isMissingPhotoGallerySchemaError(error.message) && 'photo_gallery' in payload) {
        const { photo_gallery: _omit, ...withoutGallery } = payload
        console.warn(
          '[ProfileRepository] bike_setups.photo_gallery no existe en el proyecto; aplica supabase/migrations/008_bike_photo_gallery.sql. Reintentando sin galería.'
        )
        ;({ error } = await this.client.from('bike_setups').update(withoutGallery).eq('id', existing.id))
      }

      if (error) {
        throw new Error(`Failed to update bike setup: ${error.message}`)
      }
    } else {
      const insertRow = {
        user_id: userId,
        frame: updates.frame || '',
        fork: updates.fork || '',
        drivetrain: updates.drivetrain || '',
        image_url: updates.image_url || '',
        brand_id: brandId,
        model_id: modelId,
        color_hex: updates.color_hex ?? null,
        map_icon_url: updates.map_icon_url ?? null,
        photo_gallery: Array.isArray(updates.photo_gallery) ? updates.photo_gallery : [],
        is_primary: true,
      }

      let { error } = await this.client.from('bike_setups').insert(insertRow)

      if (error && isMissingPhotoGallerySchemaError(error.message)) {
        const { photo_gallery: _pg, ...insertWithoutGallery } = insertRow
        console.warn(
          '[ProfileRepository] bike_setups.photo_gallery no existe; aplica migración 008. Insertando sin galería.'
        )
        ;({ error } = await this.client.from('bike_setups').insert(insertWithoutGallery))
      }

      if (error) {
        throw new Error(`Failed to create bike setup: ${error.message}`)
      }
    }
  }

  async getPreferredRoutes(userId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('user_routes')
      .select('route_id')
      .eq('user_id', userId)
      .eq('is_preferred', true)

    if (error) {
      return []
    }

    return data.map(r => r.route_id)
  }

  async addPreferredRoute(userId: string, routeId: string): Promise<void> {
    const { error } = await this.client
      .from('user_routes')
      .upsert({
        user_id: userId,
        route_id: routeId,
        is_preferred: true,
      }, {
        onConflict: 'user_id,route_id',
      })

    if (error) {
      throw new Error(`Failed to add preferred route: ${error.message}`)
    }
  }

  async removePreferredRoute(userId: string, routeId: string): Promise<void> {
    const { error } = await this.client
      .from('user_routes')
      .delete()
      .eq('user_id', userId)
      .eq('route_id', routeId)

    if (error) {
      throw new Error(`Failed to remove preferred route: ${error.message}`)
    }
  }

  async getUserRideAttempts(userId: string): Promise<UserRideAttemptRow[]> {
    const { data, error } = await this.client
      .from('route_attempts')
      .select(
        'id, route_id, total_time, moving_time, stopped_time, max_speed, avg_speed, distance, elevation_gain, elevation_loss, completed_at, gps_points'
      )
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })

    if (error || !data?.length) {
      if (error) console.warn('route_attempts:', error.message)
      return []
    }

    const routeIds = [...new Set(data.map((r) => r.route_id as string))]
    const { data: routes } = await this.client.from('routes').select('id, name').in('id', routeIds)
    const nameById = new Map((routes || []).map((r) => [r.id as string, r.name as string | null]))

    return data.map((row) => ({
      ...row,
      routes: {
        id: row.route_id as string,
        name: nameById.get(row.route_id as string) || 'Ruta',
      },
    })) as UserRideAttemptRow[]
  }

  async saveCompleteProfile(
    userId: string,
    profile: Partial<Profile>,
    bike: Partial<BikeSetup>,
    preferredRouteIds: string[]
  ): Promise<void> {
    // Verificar si el perfil existe, si no, crearlo
    const existingProfile = await this.getProfile(userId)
    
    if (!existingProfile) {
      // Crear perfil nuevo
      const { error: profileError } = await this.client
        .from('profiles')
        .insert({
          id: userId,
          full_name: profile.full_name || '',
          bio: profile.bio || '',
          avatar_url: profile.avatar_url || '',
          map_avatar_url: profile.map_avatar_url ?? null,
          has_crown: profile.has_crown || false,
          rider_weight_kg: profile.rider_weight_kg ?? null,
          preferred_language: profile.preferred_language === 'en' ? 'en' : 'es',
        })

      if (profileError) {
        throw new Error(`Failed to create profile: ${profileError.message}`)
      }
    } else {
      // Actualizar perfil existente
      if (Object.keys(profile).length > 0) {
        await this.updateProfile(userId, profile)
      }
    }

    // Actualizar bike setup
    if (Object.keys(bike).length > 0) {
      await this.updateBikeSetup(userId, bike)
    }

    // Actualizar rutas favoritas
    const currentRoutes = await this.getPreferredRoutes(userId)
    
    // Eliminar rutas que ya no están seleccionadas
    const preferredSet = new Set(preferredRouteIds.filter((id) => asUuidOrNull(id)))
    const routesToRemove = currentRoutes.filter((id) => !preferredSet.has(id))
    for (const routeId of routesToRemove) {
      await this.removePreferredRoute(userId, routeId)
    }

    // Agregar nuevas rutas (ignorar ids vacíos o no UUID)
    const routesToAdd = preferredRouteIds.filter(
      (id) => id && !currentRoutes.includes(id) && asUuidOrNull(id)
    )
    for (const routeId of routesToAdd) {
      const rid = asUuidOrNull(routeId)
      if (rid) await this.addPreferredRoute(userId, rid)
    }
  }
}
