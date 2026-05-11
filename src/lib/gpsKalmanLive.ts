/**
 * Kalman 2D incremental: misma recurrencia que el paso Kalman batch en
 * `GPSTrackProcessingService` (CreateRouteUseCase.ts).
 */

export class GpsKalman2DLive {
  private estLat = 0
  private estLng = 0
  private estVar = 0.0001
  private ready = false

  constructor(
    private readonly kalmanQ: number,
    private readonly kalmanR: number
  ) {}

  reset(): void {
    this.ready = false
    this.estVar = 0.0001
  }

  /**
   * Un paso Kalman sobre la nueva medición (lat, lng grados).
   * El primer paso inicializa igual que la primera iteración del batch sobre el primer punto.
   */
  step(latitude: number, longitude: number): { latitude: number; longitude: number } {
    const { kalmanQ, kalmanR } = this

    if (!this.ready) {
      this.estLat = latitude
      this.estLng = longitude
      this.estVar = 0.0001
      this.ready = true
    }

    const predVar = this.estVar + kalmanQ
    const kalmanGain = predVar / (predVar + kalmanR)
    this.estLat += kalmanGain * (latitude - this.estLat)
    this.estLng += kalmanGain * (longitude - this.estLng)
    this.estVar = (1 - kalmanGain) * predVar

    return {
      latitude: this.estLat,
      longitude: this.estLng,
    }
  }
}
