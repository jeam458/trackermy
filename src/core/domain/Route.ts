/** Superficie predominante: define estrategia de aproximación al guardar y en matching futuro. */
export type RouteTrackType = 'pavement' | 'trail' | 'mixed'

export interface Route {
  id: string
  name: string
  description?: string
  difficulty: "Beginner" | "Intermediate" | "Expert"
  /** pavimento | senda/trocha | mixto */
  trackType: RouteTrackType
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
  /** Imagen, GIF o clip corto (p. ej. WebM) para tarjetas de listado */
  previewMediaUrl?: string | null
  /** Clave del catálogo `routeThemedIcons` (condor, chakana, …). */
  iconSymbolKey?: string | null
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
  trackType?: RouteTrackType
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
  trackType?: RouteTrackType
  trackPoints?: RouteTrackPoint[]
  isPublic?: boolean
  status?: RouteStatus
  previewMediaUrl?: string | null
  iconSymbolKey?: string | null
}

export interface RouteRepository {
  createRoute(route: RouteCreationRequest, createdBy: string): Promise<Route>
  updateRoute(routeId: string, updates: RouteUpdateRequest): Promise<Route>
  getRouteById(routeId: string): Promise<Route | null>
  getUserRoutes(userId: string): Promise<Route[]>
  getPublicRoutes(limit?: number, offset?: number): Promise<Route[]>
  /** Búsqueda por nombre en rutas públicas activas (ilike parcial). */
  searchPublicRoutesByName(term: string, limit?: number): Promise<Route[]>
  /**
   * Rutas que el usuario puede elegir al grabar: públicas activas o creadas por el usuario.
   */
  searchRoutesForRecording(userId: string, term: string, limit?: number): Promise<Route[]>
  deleteRoute(routeId: string): Promise<void>
}
