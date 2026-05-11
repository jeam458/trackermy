'use client'

import { createClient } from '@/core/infrastructure/supabase/client'
import { defaultBootstrapModelChain } from '@/lib/guide-ai/guideModelDefaults'

const RUNTIME_DB_NAME = 'guarddh-runtime-cache'
const RUNTIME_DB_VERSION = 1
const META_STORE = 'meta'
const ROUTES_STORE = 'routes'
const ATTEMPTS_STORE = 'attempts'
const PROFILE_STORE = 'profiles'
const BOOTSTRAP_FLAG_KEY = 'bootstrap_v1_done'

type RuntimeMetaRecord = {
  key: string
  value: unknown
  updatedAt: string
}

type ProgressCallback = (status: RuntimeBootstrapStatus) => void

export type RuntimeBootstrapStatus = {
  running: boolean
  done: boolean
  stage:
    | 'idle'
    | 'checking'
    | 'model-downloading'
    | 'model-ready'
    | 'model-unavailable'
    | 'db-sync'
    | 'completed'
    | 'error'
  message: string
  progressPct?: number
  modelId?: string
  /** Si el modelo principal falló y se probó otro de la cadena. */
  modelLoadNote?: string
  error?: string
}

function nowIso() {
  return new Date().toISOString()
}

function emit(cb: ProgressCallback | undefined, patch: RuntimeBootstrapStatus) {
  cb?.(patch)
}

function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string' && e.trim()) return e.trim()
  try {
    return JSON.stringify(e)
  } catch {
    return 'error'
  }
}

function shortErrorForUi(e: unknown, max = 140): string {
  const s = errorMessage(e)
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function openRuntimeDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RUNTIME_DB_NAME, RUNTIME_DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(ROUTES_STORE)) {
        const st = db.createObjectStore(ROUTES_STORE, { keyPath: 'id' })
        st.createIndex('updated_at', 'updated_at')
      }
      if (!db.objectStoreNames.contains(ATTEMPTS_STORE)) {
        const st = db.createObjectStore(ATTEMPTS_STORE, { keyPath: 'id' })
        st.createIndex('completed_at', 'completed_at')
      }
      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir cache runtime'))
  })
}

async function readMeta(db: IDBDatabase, key: string): Promise<RuntimeMetaRecord | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly')
    const req = tx.objectStore(META_STORE).get(key)
    req.onsuccess = () => resolve((req.result as RuntimeMetaRecord | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('No se pudo leer meta'))
  })
}

async function writeMeta(db: IDBDatabase, rec: RuntimeMetaRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite')
    tx.objectStore(META_STORE).put(rec)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar meta'))
  })
}

/** Tras purgar WebLLM, el siguiente arranque vuelve a ejecutar descarga de modelo + sync básico. */
export async function clearBootstrapDoneFlag(): Promise<void> {
  const db = await openRuntimeDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite')
      tx.objectStore(META_STORE).delete(BOOTSTRAP_FLAG_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('No se pudo borrar meta de bootstrap'))
    })
  } finally {
    db.close()
  }
}

async function putMany(db: IDBDatabase, storeName: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const st = tx.objectStore(storeName)
    for (const row of rows) st.put(row)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error(`No se pudo guardar ${storeName}`))
  })
}

function getAllFromStore(db: IDBDatabase, storeName: string): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve((req.result as Array<Record<string, unknown>>) ?? [])
    req.onerror = () => reject(req.error ?? new Error(`No se pudo leer ${storeName}`))
  })
}

/** Una sola apertura: rutas + intentos cacheados (réplica para guía MCP offline). */
export async function readRuntimeGuideCache(): Promise<{
  routes: Array<Record<string, unknown>>
  attempts: Array<Record<string, unknown>>
}> {
  const db = await openRuntimeDb()
  try {
    const [routes, attempts] = await Promise.all([
      getAllFromStore(db, ROUTES_STORE),
      getAllFromStore(db, ATTEMPTS_STORE),
    ])
    return { routes, attempts }
  } finally {
    db.close()
  }
}

async function preloadGuideModel(cb?: ProgressCallback): Promise<{ modelId?: string; available: boolean }> {
  const nav = navigator as Navigator & { gpu?: unknown }
  if (!nav.gpu) {
    emit(cb, {
      running: true,
      done: false,
      stage: 'model-unavailable',
      message: 'WebGPU no disponible: guía local limitada en este dispositivo.',
    })
    return { available: false }
  }

  const chain = defaultBootstrapModelChain()

  const webllm = await import('@mlc-ai/web-llm')
  let lastErr: unknown = null
  const skippedNotes: string[] = []
  for (const modelId of chain) {
    try {
      emit(cb, {
        running: true,
        done: false,
        stage: 'model-downloading',
        modelId,
        modelLoadNote: skippedNotes.length ? skippedNotes.join(' · ') : undefined,
        message: `Descargando recursos IA (${modelId})...`,
      })
      await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report: { progress?: number; text?: string }) => {
          emit(cb, {
            running: true,
            done: false,
            stage: 'model-downloading',
            modelId,
            modelLoadNote: skippedNotes.length ? skippedNotes.join(' · ') : undefined,
            progressPct: report.progress != null ? Math.max(0, Math.min(100, Math.round(report.progress * 100))) : undefined,
            message: report.text ? String(report.text) : `Preparando ${modelId}...`,
          })
        },
      })
      emit(cb, {
        running: true,
        done: false,
        stage: 'model-ready',
        modelId,
        progressPct: 100,
        modelLoadNote: skippedNotes.length ? skippedNotes.join(' · ') : undefined,
        message: `Modelo IA listo (${modelId}).`,
      })
      return { available: true, modelId }
    } catch (e) {
      lastErr = e
      const hint = `${modelId}: ${shortErrorForUi(e)}`
      skippedNotes.push(hint)
      emit(cb, {
        running: true,
        done: false,
        stage: 'model-downloading',
        modelId,
        modelLoadNote: skippedNotes.join(' · '),
        message: `No cargó «${modelId}». Probando siguiente modelo… (${shortErrorForUi(e, 90)})`,
      })
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('No se pudo inicializar ningún modelo WebLLM')
}

async function syncSupabaseBasics(db: IDBDatabase) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: publicRoutes, error: eRoutes }, profileResult, attemptsResult] = await Promise.all([
    supabase
      .from('routes')
      .select(
        'id, name, description, distance_km, elevation_gain_m, difficulty, start_lat, start_lng, updated_at, created_at, is_public, status'
      )
      .eq('is_public', true)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(450),
    user
      ? supabase
          .from('profiles')
          .select('id, full_name, avatar_url, map_avatar_url, bike_frame, updated_at')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    user
      ? supabase
          .from('route_attempts')
          .select('id, route_id, total_time, distance, completed_at, created_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(220)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (eRoutes) throw eRoutes
  if (profileResult.error) throw profileResult.error
  if (attemptsResult.error) throw attemptsResult.error

  await putMany(db, ROUTES_STORE, (publicRoutes as Array<Record<string, unknown>>) ?? [])
  if (profileResult.data) {
    await putMany(db, PROFILE_STORE, [profileResult.data as Record<string, unknown>])
  }
  await putMany(db, ATTEMPTS_STORE, (attemptsResult.data as Array<Record<string, unknown>>) ?? [])
}

export async function bootstrapRuntimeOnce(onProgress?: ProgressCallback): Promise<RuntimeBootstrapStatus> {
  emit(onProgress, {
    running: true,
    done: false,
    stage: 'checking',
    message: 'Verificando recursos locales...',
  })

  const db = await openRuntimeDb()
  try {
    const already = await readMeta(db, BOOTSTRAP_FLAG_KEY)
    if (already?.value === true) {
      const doneStatus: RuntimeBootstrapStatus = {
        running: false,
        done: true,
        stage: 'completed',
        message: 'Bootstrap local ya estaba listo.',
      }
      emit(onProgress, doneStatus)
      return doneStatus
    }

    let model: { modelId?: string; available: boolean } = { available: false }
    let modelWarning: string | null = null
    try {
      model = await preloadGuideModel(onProgress)
    } catch (e) {
      modelWarning = errorMessage(e)
      emit(onProgress, {
        running: true,
        done: false,
        stage: 'model-unavailable',
        message: `IA local no disponible por ahora (${modelWarning}). Continuamos con datos offline.`,
      })
    }

    emit(onProgress, {
      running: true,
      done: false,
      stage: 'db-sync',
      modelId: model.modelId,
      message: 'Creando copia local básica de datos...',
    })
    await syncSupabaseBasics(db)

    await writeMeta(db, {
      key: BOOTSTRAP_FLAG_KEY,
      value: true,
      updatedAt: nowIso(),
    })
    await writeMeta(db, {
      key: 'bootstrap_model_id',
      value: model.modelId ?? null,
      updatedAt: nowIso(),
    })

    const status: RuntimeBootstrapStatus = {
      running: false,
      done: true,
      stage: 'completed',
      modelId: model.modelId,
      message: modelWarning
        ? `Cache base lista. IA local pendiente (${modelWarning}).`
        : 'IA local y cache base listos.',
      progressPct: 100,
    }
    emit(onProgress, status)
    return status
  } catch (e) {
    const status: RuntimeBootstrapStatus = {
      running: false,
      done: false,
      stage: 'error',
      message: 'No se pudo completar el bootstrap inicial.',
      error: errorMessage(e),
    }
    emit(onProgress, status)
    return status
  } finally {
    db.close()
  }
}

