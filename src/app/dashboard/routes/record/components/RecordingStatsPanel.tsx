'use client'

import { Clock, TrendingUp, Navigation, Gauge, MapPin } from 'lucide-react'
import { formatTime, formatDistance, formatSpeed, type MapPoint } from '@/hooks/useGPSRecorder'
import type { Route, RouteTrackType } from '@/core/domain/Route'

function calculateDistance(points: MapPoint[]): number {
  if (points.length < 2) return 0
  let total = 0
  const R = 6371000
  for (let i = 1; i < points.length; i++) {
    const dLat = ((points[i].latitude - points[i - 1].latitude) * Math.PI) / 180
    const dLng = ((points[i].longitude - points[i - 1].longitude) * Math.PI) / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((points[i - 1].latitude * Math.PI) / 180) * Math.cos((points[i].latitude * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    total += R * c
  }
  return total
}

export function RecordingStatsPanel({
  points,
  elapsedTime,
  currentSpeed,
  maxSessionSpeedMps,
  currentAccuracy,
  user,
  mapAvatarUrl,
  isPaused,
  awaitingStartGate,
}: {
  points: MapPoint[]
  elapsedTime: number
  currentSpeed: number | null
  maxSessionSpeedMps: number | null
  currentAccuracy: number | null
  user: { id: string; fullName: string; avatarUrl?: string } | null
  mapAvatarUrl: string | null
  isPaused: boolean
  awaitingStartGate: boolean
}) {
  const distanceM = calculateDistance(points)
  const avgSpeed = elapsedTime > 0 && distanceM > 0 ? distanceM / elapsedTime : 0

  return (
    <>
      <div className="fixed left-3 right-3 bottom-[5.1rem] z-[1055] mx-auto flex w-[min(92vw,420px)] items-center gap-3 rounded-2xl border border-white/10 bg-gdh-card/95 px-3 py-2.5 shadow-xl">
        <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-white/10 shrink-0">
          {mapAvatarUrl || user?.avatarUrl ? (
            <img src={mapAvatarUrl || user?.avatarUrl || ''} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
              {user?.fullName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-gdh-brand-highlight truncate">
            {isPaused ? 'Pausado' : awaitingStartGate ? 'Validando...' : 'Grabando recorrido'}
          </p>
          <p className="text-[10px] text-slate-400">
            {awaitingStartGate ? 'Validación de velocidad en salida' : 'GPS activo · seguimiento en vivo'}
          </p>
        </div>
        <Gauge className="text-gdh-muted shrink-0" size={24} />
      </div>

      <div className="pointer-events-none fixed bottom-[4.35rem] left-2 right-2 z-[1060] max-h-[38vh] overflow-y-auto sm:bottom-[4.25rem]">
        <div className="pointer-events-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 rounded-xl border border-white/10 bg-[#0d1114]/92 p-2 shadow-xl backdrop-blur-md">
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Clock size={18} /><span className="text-sm">Tiempo</span>
            </div>
            <p className="text-2xl font-bold text-white font-mono">{formatTime(elapsedTime)}</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <TrendingUp size={18} /><span className="text-sm">Distancia</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatDistance(distanceM)}</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <Navigation size={18} /><span className="text-sm">Ahora</span>
            </div>
            <p className="text-2xl font-bold text-white">{currentSpeed != null ? formatSpeed(currentSpeed) : '--'}</p>
            {avgSpeed > 0 && (
              <p className="text-xs text-slate-500 mt-1" title="Distancia recorrida ÷ tiempo transcurrido">
                Media trayecto: {formatSpeed(avgSpeed)}
              </p>
            )}
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center gap-2 text-gdh-brand-highlight mb-2">
              <Gauge size={18} /><span className="text-sm">Máx. pico</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {maxSessionSpeedMps != null && maxSessionSpeedMps > 0 ? formatSpeed(maxSessionSpeedMps) : '--'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">GPS + tramo</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center gap-2 text-gdh-brand-highlight mb-2">
              <MapPin size={18} /><span className="text-sm">Puntos</span>
            </div>
            <p className="text-2xl font-bold text-white">{points.length}</p>
            {currentAccuracy && <p className="text-xs text-gray-400 mt-1">±{currentAccuracy.toFixed(1)}m</p>}
          </div>
        </div>
      </div>
    </>
  )
}
