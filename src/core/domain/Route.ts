export interface Route {
  id: string
  name: string
  description?: string
  difficulty: "Beginner" | "Intermediate" | "Expert"
  distanceKm: number
  elevationGainM?: number
  elevationLossM?: number
  startCoord: [number, number] // [lat, lng]
  endCoord: [number, number] // [lat, lng]
  trackPoints: RouteTrackPoint[]
  createdBy: string
  createdAt: Date
  updatedAt: Date
  isPublic: boolean
  status: RouteStatus
}

export type RouteStatus = 'draft' | 'active' | 'archived'

export interface RouteTrackPoint {
  id?: string
  routeId?: string
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number // meters
  timestamp?: Date
  orderIndex: number
}

export interface RouteCreationRequest {
  name: string
  description?: string
  difficulty: "Beginner" | "Intermediate" | "Expert"
  startCoord: [number, number]
  endCoord: [number, number]
  trackPoints: Array<{
    latitude: number
    longitude: number
    altitude?: number
    accuracy?: number
  }>
  isPublic?: boolean
}

export interface RouteUpdateRequest {
  name?: string
  description?: string
  difficulty?: "Beginner" | "Intermediate" | "Expert"
  trackPoints?: RouteTrackPoint[]
  isPublic?: boolean
  status?: RouteStatus
}

export interface RouteRepository {
  createRoute(route: RouteCreationRequest, createdBy: string): Promise<Route>
  updateRoute(routeId: string, updates: RouteUpdateRequest): Promise<Route>
  getRouteById(routeId: string): Promise<Route | null>
  getUserRoutes(userId: string): Promise<Route[]>
  getPublicRoutes(limit?: number, offset?: number): Promise<Route[]>
  deleteRoute(routeId: string): Promise<void>
}
