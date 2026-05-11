'use client'

import { useEffect } from 'react'
import { syncManager } from '@/services/SyncManager'

/** Inicia escucha online/offline y reintentos de subida de datos pendientes en IndexedDB (intentos de ruta, etc.). */
export function SyncManagerInit() {
  useEffect(() => {
    syncManager.init()
  }, [])
  return null
}
