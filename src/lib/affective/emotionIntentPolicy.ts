import { ALL_PET_EMOTIONS, PET_EMOTION_LABELS, type PetEmotion } from '@/components/pet/guardDhPetTypes'
import { GUIDE_CATALOG_ID_PREFIX_TAGS } from '@/lib/affective/config/guideCatalogTriggerPrefixes'
import { GUIDE_DYNAMIC_DOMAIN_TO_INTERACTION_TAG } from '@/lib/affective/config/guideDynamicDomains'
import { GUIDE_SCREEN_PATH_TAGS } from '@/lib/affective/config/guideScreenPathMarkers'
import {
  REPLAY_ALTITUDE_HIGH_M,
  REPLAY_SPEED_HIGH_KMH,
  REPLAY_SPEED_MODERATE_KMH,
  REPLAY_SPEED_VERY_HIGH_KMH,
  REPLAY_SPEED_VERY_LOW_KMH,
} from '@/lib/affective/config/replayTelemetryThresholds'
import { getDynamicTriggerHintEs } from '@/lib/affective/guideDynamicTriggerHints'
import { getGuideAppTriggerMeta } from '@/lib/affective/guideAppTriggerCatalog'
import type { GuideAppTriggerPulse, GuideWorldStateSnapshot } from '@/lib/affective/types'

/** Etiquetas de situación derivadas solo del snapshot (sin eventos sueltos). */
export function deriveSituationTags(snapshot: GuideWorldStateSnapshot): string[] {
  const tags: string[] = []
  const p = (snapshot.pathname || '').toLowerCase()

  const pulses =
    snapshot.recentAppTriggers?.length > 0
      ? snapshot.recentAppTriggers
      : snapshot.lastAppTrigger
        ? [snapshot.lastAppTrigger]
        : []
  for (const pulse of pulses.slice(-5)) {
    if (pulse.kind === 'catalog') {
      tags.push(`trigger:${pulse.id}`)
      const idStr = String(pulse.id)
      for (const { prefix, tag } of GUIDE_CATALOG_ID_PREFIX_TAGS) {
        if (idStr.startsWith(prefix)) tags.push(tag)
      }
    } else {
      tags.push(`dyn:${pulse.domain}:${pulse.action}`)
      tags.push(`dyn_domain:${pulse.domain}`)
      if (pulse.subject) tags.push(`dyn_subject:${pulse.subject}`)
      const interactionTag = GUIDE_DYNAMIC_DOMAIN_TO_INTERACTION_TAG[pulse.domain]
      if (interactionTag) tags.push(interactionTag)
    }
  }

  for (const { includes, tag } of GUIDE_SCREEN_PATH_TAGS) {
    if (p.includes(includes)) tags.push(tag)
  }

  const gh = snapshot.gpsHint
  if (gh === 'denied' || gh === 'unavailable') tags.push('gps_degraded')

  if (snapshot.networkOnline === false) tags.push('network_offline')
  else if (snapshot.networkOnline === true) tags.push('network_online')

  const tick = snapshot.replayLastTick
  if (tick) {
    if (tick.playing) tags.push('replay_playing')
    else tags.push('replay_paused')

    const v = tick.speed_kmh
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (v >= REPLAY_SPEED_VERY_HIGH_KMH) tags.push('speed_very_high')
      else if (v >= REPLAY_SPEED_HIGH_KMH) tags.push('speed_high')
      else if (v >= REPLAY_SPEED_MODERATE_KMH) tags.push('speed_moderate')
      else if (v < REPLAY_SPEED_VERY_LOW_KMH) tags.push('speed_very_low')
    }

    const z = tick.altitude_m
    if (typeof z === 'number' && Number.isFinite(z) && z >= REPLAY_ALTITUDE_HIGH_M) tags.push('altitude_high')
  }

  const tail = snapshot.replayStructuralTail
  const lastStruct = tail[tail.length - 1]
  if (lastStruct?.action === 'pause') tags.push('replay_struct_pause')
  if (lastStruct?.action === 'seek') tags.push('replay_struct_seek')

  return tags
}

const PRESET = new Set<PetEmotion>(ALL_PET_EMOTIONS)

export function pickPetEmotionCandidates(tags: Set<string> | string[]): PetEmotion[] {
  const t = Array.isArray(tags) ? new Set(tags) : tags
  const pick = (ordered: PetEmotion[]) => {
    const out: PetEmotion[] = []
    for (const e of ordered) {
      if (PRESET.has(e) && !out.includes(e)) out.push(e)
      if (out.length >= 5) break
    }
    return out
  }

  if (t.has('gps_degraded') || t.has('network_offline')) {
    return pick(['conexion_perdida', 'recuperando', 'pensando_minimal', 'principal', 'saludo'])
  }

  if (t.has('interaction_map')) {
    return pick(['pensando_mapa', 'principal', 'inicio_ruta', 'pensando_minimal', 'saludo'])
  }

  if (t.has('interaction_metrics') || t.has('interaction_replay_metrics')) {
    return pick(['pensando_mapa', 'datos_guardados', 'principal', 'pensando_minimal', 'saludo'])
  }

  if (t.has('speed_very_high')) {
    return pick(['velocidad_critica', 'exhausto', 'molesto', 'pensando_mapa', 'principal'])
  }

  if (t.has('speed_high')) {
    return pick(['velocidad_critica', 'exhausto', 'pensando_mapa', 'principal', 'cansado'])
  }

  if (t.has('replay_playing') && t.has('speed_very_low')) {
    return pick(['pensando_mapa', 'principal', 'pensando_minimal', 'inicio_ruta', 'saludo'])
  }

  if (t.has('replay_paused') || t.has('replay_struct_pause')) {
    return pick(['pensando_minimal', 'principal', 'pensando_mapa', 'saludo', 'recuperando'])
  }

  if (t.has('screen_replay')) {
    return pick(['pensando_mapa', 'principal', 'inicio_ruta', 'saludo', 'pensando_minimal'])
  }

  if (t.has('screen_route_detail')) {
    return pick(['inicio_ruta', 'principal', 'pensando_mapa', 'saludo', 'datos_guardados'])
  }

  return pick(['principal', 'saludo', 'pensando_minimal', 'pensando_mapa', 'inicio_ruta'])
}

function lastTriggerMetaForPrompt(last: GuideAppTriggerPulse | null): Record<string, unknown> | null {
  if (!last) return null
  if (last.kind === 'catalog') {
    return { kind: 'catalog', id: last.id, ...getGuideAppTriggerMeta(last.id), detail: last.detail }
  }
  const hint = getDynamicTriggerHintEs(last.domain, last.action)
  return {
    kind: 'dynamic',
    domain: last.domain,
    action: last.action,
    subject: last.subject ?? null,
    hint_es: hint ?? null,
    detail: last.detail ?? null,
  }
}

export function buildAffectivePromptAugment(snapshot: GuideWorldStateSnapshot): Record<string, unknown> {
  const tags = deriveSituationTags(snapshot)
  const tagSet = new Set(tags)
  const slugs = pickPetEmotionCandidates(tagSet)
  const emotion_candidates_for_atlas = slugs.map((slug) => ({
    slug,
    label_es: PET_EMOTION_LABELS[slug],
  }))
  return {
    affective_world: snapshot,
    situation_tags: tags,
    emotion_candidate_slugs: slugs,
    emotion_candidates_for_atlas,
    last_trigger_meta: lastTriggerMetaForPrompt(snapshot.lastAppTrigger),
  }
}
