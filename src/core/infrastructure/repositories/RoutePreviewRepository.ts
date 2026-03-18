import { createClient } from '../supabase/client'

export interface SimpleRoute {
  id: string
  name: string
  difficulty: 'Beginner' | 'Intermediate' | 'Expert'
  distanceKm: number
  startCoord: [number, number]
  endCoord: [number, number]
}

export class RoutePreviewRepository {
  private client = createClient()

  async getPublicRoutes(limit: number = 20): Promise<SimpleRoute[]> {
    const { data, error } = await this.client
      .from('routes')
      .select('id, name, difficulty, distance_km, start_lat, start_lng, end_lat, end_lng')
      .eq('is_public', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error getting public routes:', error)
      return []
    }

    return (data || []).map(route => ({
      id: route.id,
      name: route.name,
      difficulty: route.difficulty as 'Beginner' | 'Intermediate' | 'Expert',
      distanceKm: route.distance_km,
      startCoord: [route.start_lat, route.start_lng] as [number, number],
      endCoord: [route.end_lat, route.end_lng] as [number, number],
    }))
  }
}
