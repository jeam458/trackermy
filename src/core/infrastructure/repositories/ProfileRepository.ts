import { createClient } from '../supabase/client'

export interface Profile {
  id: string
  full_name: string
  bio: string
  avatar_url: string
  has_crown: boolean
}

export interface BikeSetup {
  id: string
  user_id: string
  frame: string
  fork: string
  drivetrain: string
  image_url: string
  is_primary: boolean
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
  has_crown: boolean
  frame: string
  fork: string
  drivetrain: string
  bike_image_url: string
}

export class ProfileRepository {
  private client = createClient()

  async getProfile(userId: string): Promise<ProfileWithBike | null> {
    const { data, error } = await this.client
      .rpc('get_profile_with_bike', { profile_id: userId })

    if (error || !data || data.length === 0) {
      return null
    }

    return data[0]
  }

  async updateProfile(
    userId: string,
    updates: Partial<Pick<Profile, 'full_name' | 'bio' | 'avatar_url' | 'has_crown'>>
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
      .single()

    if (error || !data) {
      return null
    }

    return data
  }

  async updateBikeSetup(
    userId: string,
    updates: Partial<Pick<BikeSetup, 'frame' | 'fork' | 'drivetrain' | 'image_url'>>
  ): Promise<void> {
    // Verificar si ya existe un bike setup
    const existing = await this.getBikeSetup(userId)

    if (existing) {
      // Actualizar existente
      const { error } = await this.client
        .from('bike_setups')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        throw new Error(`Failed to update bike setup: ${error.message}`)
      }
    } else {
      // Crear nuevo
      const { error } = await this.client
        .from('bike_setups')
        .insert({
          user_id: userId,
          frame: updates.frame || '',
          fork: updates.fork || '',
          drivetrain: updates.drivetrain || '',
          image_url: updates.image_url || '',
          is_primary: true,
        })

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
          has_crown: profile.has_crown || false,
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
    const routesToRemove = currentRoutes.filter(id => !preferredRouteIds.includes(id))
    for (const routeId of routesToRemove) {
      await this.removePreferredRoute(userId, routeId)
    }

    // Agregar nuevas rutas
    const routesToAdd = preferredRouteIds.filter(id => !currentRoutes.includes(id))
    for (const routeId of routesToAdd) {
      await this.addPreferredRoute(userId, routeId)
    }
  }
}
