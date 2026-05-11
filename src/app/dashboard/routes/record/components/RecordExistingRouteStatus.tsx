'use client'

type Props = {
  visible: boolean
  awaitingStartGate: boolean
  distanceMetersToStart: number | null
  routeAttemptOffRoute: boolean
  stopGateError: string | null
  distanceMetersToEnd: number | null
  startEndRadiusM: number
  maxOffRouteM: number
}

export function RecordExistingRouteStatus({
  visible,
  awaitingStartGate,
  distanceMetersToStart,
  routeAttemptOffRoute,
  stopGateError,
  distanceMetersToEnd,
  startEndRadiusM,
  maxOffRouteM,
}: Props) {
  if (!visible) return null

  return (
    <div className="absolute left-3 right-3 top-16 z-[1090] max-h-[38vh] space-y-2 overflow-y-auto sm:top-20">
      {awaitingStartGate && (
        <div className="bg-cyan-500/15 border border-cyan-500/35 rounded-xl p-3 text-sm text-cyan-100 shadow-lg backdrop-blur-sm">
          <p className="font-semibold text-cyan-200">Línea de salida</p>
          <p>
            El cronómetro y el registro de GPS empiezan al estar a {startEndRadiusM} m o menos del
            inicio.
            {distanceMetersToStart != null && (
              <>
                {' '}
                Distancia a la salida: <strong>{Math.round(distanceMetersToStart)} m</strong>
              </>
            )}
          </p>
        </div>
      )}
      {routeAttemptOffRoute && !awaitingStartGate && (
        <div className="bg-red-500/15 border border-red-500/40 rounded-xl p-3 text-sm text-red-200 shadow-lg backdrop-blur-sm">
          <strong>Intento no válido:</strong> te separaste de la ruta creada (más de {maxOffRouteM}{' '}
          m). No podrás guardar este recorrido como intento válido.
        </div>
      )}
      {stopGateError && (
        <div className="bg-amber-500/15 border border-amber-500/35 rounded-xl p-3 text-sm text-amber-100 shadow-lg backdrop-blur-sm">
          {stopGateError}
        </div>
      )}
      {!awaitingStartGate && distanceMetersToEnd != null && (
        <p className="px-1 text-xs text-slate-300 drop-shadow">
          Dist. a la meta: {Math.round(distanceMetersToEnd)} m (detén a ≤{startEndRadiusM} m)
        </p>
      )}
    </div>
  )
}
