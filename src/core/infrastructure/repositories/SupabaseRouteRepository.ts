import { createClient } from '../supabase/client'
import {
  Route,
  RouteCreationRequest,
  RouteUpdateRequest,
  RouteRepository,
  RouteTrackPoint,
} from '../../domain/Route'
import { ProcessedTrackPoint } from '../../domain/GPSTrack'
import { RouteEnhancementService } from '../../application/RouteEnhancementService'

export class SupabaseRouteRepository implements RouteRepository {
  private client = createClient()
  private enhancementService = new RouteEnhancementService()

  async createRoute(
    routeData: RouteCreationRequest,
    createdBy: string
  ): Promise<Route> {
    console.log('Creando ruta...', {
      name: routeData.name,
      difficulty: routeData.difficulty,
      createdBy,
      trackPointsCount: routeData.trackPoints.length,
    })

    // Mejorar ruta automáticamente antes de guardar
    const partialRoute: Partial<Route> = {
      name: routeData.name,
      description: routeData.description,
      difficulty: routeData.difficulty,
      startCoord: routeData.startCoord,
      endCoord: routeData.endCoord,
      trackPoints: routeData.trackPoints.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude,
        accuracy: p.accuracy,
        orderIndex: 0,
      })),
      isPublic: routeData.isPublic,
    }

    const enhancementResult = this.enhancementService.enhanceRoute(partialRoute)
    console.log('Mejoras aplicadas:', enhancementResult.changes)

    const { data: route, error: routeError } = await this.client
      .from('routes')
      .insert({
        name: routeData.name,
        description: routeData.description,
        difficulty: routeData.difficulty,
        distance_km: enhancementResult.enhanced.distanceKm || 0,
        elevation_gain_m: enhancementResult.enhanced.elevationGainM,
        elevation_loss_m: enhancementResult.enhanced.elevationLossM,
        start_lat: routeData.startCoord[0],
        start_lng: routeData.startCoord[1],
        end_lat: enhancementResult.enhanced.endCoord?.[0] || routeData.endCoord[0],
        end_lng: enhancementResult.enhanced.endCoord?.[1] || routeData.endCoord[1],
        created_by: createdBy,
        is_public: routeData.isPublic ?? false,
        status: 'active',
      })
      .select()
      .single()

    console.log('Resultado inserción ruta:', { route, error: routeError })

    if (routeError || !route) {
      console.error('Error creando ruta:', routeError)
      throw new Error(
        `Failed to create route: ${routeError?.message || 'Unknown error'}`
      )
    }

    console.log('Ruta creada con ID:', route.id)

    // Insert track points
    if (routeData.trackPoints.length > 0) {
      const trackPointsToInsert = routeData.trackPoints.map((point, index) => ({
        route_id: route.id,
        latitude: point.latitude,
        longitude: point.longitude,
        altitude: point.altitude,
        accuracy: point.accuracy,
        order_index: index,
      }))

      console.log('Insertando puntos del track:', trackPointsToInsert.length, 'puntos')

      const { error: pointsError } = await this.client
        .from('route_track_points')
        .insert(trackPointsToInsert)

      console.log('Resultado inserción puntos:', { error: pointsError })

      if (pointsError) {
        console.error('Error insertando puntos, haciendo rollback:', pointsError)
        // Rollback: delete the route if points fail
        await this.client.from('routes').delete().eq('id', route.id)
        throw new Error(
          `Failed to insert track points: ${pointsError.message}`
        )
      }
      
      console.log('Puntos insertados exitosamente')
    }

    console.log('Ruta completada exitosamente')

    // Fetch complete route with points
    return this.getRouteById(route.id) as Promise<Route>
  }

  async updateRoute(
    routeId: string,
    updates: RouteUpdateRequest
  ): Promise<Route> {
    const updateData: Record<string, unknown> = {}

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined)
      updateData.description = updates.description
    if (updates.difficulty !== undefined)
      updateData.difficulty = updates.difficulty
    if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic
    if (updates.status !== undefined) updateData.status = updates.status

    // Update route metadata
    if (Object.keys(updateData).length > 0) {
      const { error } = await this.client
        .from('routes')
        .update(updateData)
        .eq('id', routeId)

      if (error) {
        throw new Error(`Failed to update route: ${error.message}`)
      }
    }

    // Update track points if provided
    if (updates.trackPoints !== undefined) {
      // Delete existing points
      await this.client.from('route_track_points').delete().eq('route_id', routeId)

      // Insert new points
      if (updates.trackPoints.length > 0) {
        const trackPointsToInsert = updates.trackPoints.map((point) => ({
          route_id: routeId,
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude,
          accuracy: point.accuracy,
          order_index: point.orderIndex,
        }))

        const { error: pointsError } = await this.client
          .from('route_track_points')
          .insert(trackPointsToInsert)

        if (pointsError) {
          throw new Error(
            `Failed to update track points: ${pointsError.message}`
          )
        }
      }
    }

    return this.getRouteById(routeId) as Promise<Route>
  }

  async getRouteById(routeId: string): Promise<Route | null> {
    // Primero obtener la ruta
    const { data: routeData, error: routeError } = await this.client
      .from('routes')
      .select('*')
      .eq('id', routeId)
      .single()

    if (routeError || !routeData) {
      return null
    }

    // Luego obtener los puntos
    const { data: pointsData, error: pointsError } = await this.client
      .from('route_track_points')
      .select('*')
      .eq('route_id', routeId)
      .order('order_index', { ascending: true })

    if (pointsError) {
      console.error('Error getting track points:', pointsError)
    }

    return this.mapToRoute(routeData, pointsData || [])
  }

  async getUserRoutes(userId: string): Promise<Route[]> {
    const { data, error } = await this.client
      .from('routes')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get user routes: ${error.message}`)
    }

    const routes: Route[] = []
    for (const route of data || []) {
      const fullRoute = await this.getRouteById(route.id)
      if (fullRoute) {
        routes.push(fullRoute)
      }
    }

    return routes
  }

  async getPublicRoutes(
    limit = 20,
    offset = 0
  ): Promise<Route[]> {
    const { data, error } = await this.client
      .from('routes')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'active')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get public routes: ${error.message}`)
    }

    const routes: Route[] = []
    for (const route of data || []) {
      const fullRoute = await this.getRouteById(route.id)
      if (fullRoute) {
        routes.push(fullRoute)
      }
    }

    return routes
  }

  async deleteRoute(routeId: string): Promise<void> {
    const { error } = await this.client
      .from('routes')
      .delete()
      .eq('id', routeId)

    if (error) {
      throw new Error(`Failed to delete route: ${error.message}`)
    }
  }

  private mapToRoute(data: any, pointsData: any[] = []): Route {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      difficulty: data.difficulty,
      distanceKm: Number(data.distance_km) || 0,
      elevationGainM: data.elevation_gain_m ? Number(data.elevation_gain_m) : undefined,
      elevationLossM: data.elevation_loss_m ? Number(data.elevation_loss_m) : undefined,
      startCoord: [Number(data.start_lat), Number(data.start_lng)],
      endCoord: [Number(data.end_lat), Number(data.end_lng)],
      trackPoints: this.mapToTrackPoints(pointsData),
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      isPublic: data.is_public,
      status: data.status,
    }
  }

  private mapToTrackPoints(pointsData: any[]): RouteTrackPoint[] {
    return pointsData.map((p) => ({
      id: p.id,
      routeId: p.route_id,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      altitude: p.altitude ? Number(p.altitude) : undefined,
      accuracy: p.accuracy ? Number(p.accuracy) : undefined,
      timestamp: p.timestamp ? new Date(p.timestamp) : undefined,
      orderIndex: p.order_index,
    }))
  }
}
