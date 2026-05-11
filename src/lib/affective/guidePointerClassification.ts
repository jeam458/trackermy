/**
 * Clasificación ligera de puntero → `GuideTriggerInput` dinámico.
 * Selectores y patrones en `config/`; segmentos validados con Zod.
 */
import {
  ATTR_GUIDE_ACTION,
  ATTR_GUIDE_DOMAIN,
  ATTR_GUIDE_SUBJECT,
  GUIDE_DATA_CARD_SELECTOR,
  GUIDE_LEAFLET_CONTAINER_SELECTOR,
  GUIDE_LEAFLET_POPUP_SELECTOR,
  GUIDE_LEAFLET_ZOOM_IN_SELECTOR,
  GUIDE_LEAFLET_ZOOM_OUT_SELECTOR,
  GUIDE_LEAFLET_ZOOM_WRAP_SELECTOR,
  GUIDE_MAPLIBRE_MAP_SELECTOR,
  GUIDE_MAPLIBRE_POPUP_SELECTOR,
  GUIDE_MAPLIBRE_ZOOM_GROUP_SELECTOR,
  GUIDE_MAPLIBRE_ZOOM_IN_SELECTOR,
  GUIDE_MAPLIBRE_ZOOM_OUT_SELECTOR,
  GUIDE_MAP_EXPAND_CONTROL_SELECTOR,
  GUIDE_POINTER_INTERACTIVE_SELECTOR,
} from '@/lib/affective/config/guidePointerSelectors'
import { GUIDE_MAP_EXPAND_LABEL_SUBSTRINGS_ES } from '@/lib/affective/config/guideMapExpandPatterns'
import {
  GUIDE_DYNAMIC_ACTION_DEFAULT_FROM_DOM,
  GUIDE_DYNAMIC_SUBJECT_MAX_LEN,
  GUIDE_POINTER_CARD_SLUG_MAX_LEN,
  GUIDE_POINTER_LABEL_MAX_LEN,
} from '@/lib/affective/config/affectiveLimits'
import {
  guideDynamicActionSchema,
  guideDynamicDomainSchema,
  type GuideTriggerInput,
} from '@/lib/affective/schema/guideAffectiveSchemas'

export { ATTR_GUIDE_ACTION, ATTR_GUIDE_DOMAIN, ATTR_GUIDE_SUBJECT }

function readDataGuideAttrs(el: HTMLElement | null): GuideTriggerInput | null {
  const node = el?.closest(`[${ATTR_GUIDE_DOMAIN}]`) as HTMLElement | null
  if (!node) return null
  const rawDomain = (node.getAttribute(ATTR_GUIDE_DOMAIN) || '').trim()
  const rawAction = (node.getAttribute(ATTR_GUIDE_ACTION) || '').trim()
  const rawSubject = (node.getAttribute(ATTR_GUIDE_SUBJECT) || '').trim()
  if (!rawDomain) return null

  const domainParsed = guideDynamicDomainSchema.safeParse(rawDomain)
  const actionBase = rawAction || GUIDE_DYNAMIC_ACTION_DEFAULT_FROM_DOM
  const actionParsed = guideDynamicActionSchema.safeParse(actionBase)
  if (!domainParsed.success || !actionParsed.success) return null

  const tag = node.tagName.toLowerCase()
  const label =
    (node.getAttribute('aria-label') ||
      node.textContent?.trim().slice(0, GUIDE_POINTER_LABEL_MAX_LEN) ||
      '') || undefined

  return {
    kind: 'dynamic',
    domain: domainParsed.data,
    action: actionParsed.data,
    subject: rawSubject ? rawSubject.slice(0, GUIDE_DYNAMIC_SUBJECT_MAX_LEN) : undefined,
    detail: { tag, label },
  }
}

function leafletZoomAction(target: HTMLElement): 'zoom_in' | 'zoom_out' | null {
  const z = target.closest(GUIDE_LEAFLET_ZOOM_WRAP_SELECTOR)
  if (!z) return null
  if (target.closest(GUIDE_LEAFLET_ZOOM_IN_SELECTOR)) return 'zoom_in'
  if (target.closest(GUIDE_LEAFLET_ZOOM_OUT_SELECTOR)) return 'zoom_out'
  return null
}

function maplibreZoomAction(target: HTMLElement): 'zoom_in' | 'zoom_out' | null {
  const g = target.closest(GUIDE_MAPLIBRE_ZOOM_GROUP_SELECTOR)
  if (!g) return null
  if (target.closest(GUIDE_MAPLIBRE_ZOOM_IN_SELECTOR)) return 'zoom_in'
  if (target.closest(GUIDE_MAPLIBRE_ZOOM_OUT_SELECTOR)) return 'zoom_out'
  return null
}

function mapCanvasZoomAction(target: HTMLElement): 'zoom_in' | 'zoom_out' | null {
  return leafletZoomAction(target) ?? maplibreZoomAction(target)
}

function mapExpandHint(target: HTMLElement): boolean {
  const el = target.closest(GUIDE_MAP_EXPAND_CONTROL_SELECTOR) as HTMLElement | null
  const t = (el?.textContent || el?.getAttribute('aria-label') || '').toLowerCase()
  return GUIDE_MAP_EXPAND_LABEL_SUBSTRINGS_ES.some((frag) => t.includes(frag))
}

export function classifyGuidePointerTarget(target: HTMLElement | null): GuideTriggerInput | null {
  if (!target) return null

  const fromData = readDataGuideAttrs(target)
  if (fromData) return fromData

  const inMapCanvas = target.closest(
    `${GUIDE_LEAFLET_CONTAINER_SELECTOR},${GUIDE_MAPLIBRE_MAP_SELECTOR}`
  )
  if (inMapCanvas) {
    const za = mapCanvasZoomAction(target)
    if (za === 'zoom_in')
      return { kind: 'dynamic', domain: 'map', action: guideDynamicActionSchema.parse('zoom_in') }
    if (za === 'zoom_out')
      return { kind: 'dynamic', domain: 'map', action: guideDynamicActionSchema.parse('zoom_out') }
    if (mapExpandHint(target))
      return { kind: 'dynamic', domain: 'map', action: guideDynamicActionSchema.parse('expand_toggle') }
    return {
      kind: 'dynamic',
      domain: 'map',
      action: guideDynamicActionSchema.parse('canvas_click'),
      detail: {
        target_tag: target.tagName.toLowerCase(),
        is_popup: !!target.closest(`${GUIDE_LEAFLET_POPUP_SELECTOR},${GUIDE_MAPLIBRE_POPUP_SELECTOR}`),
      },
    }
  }

  const cardLike = target.closest(GUIDE_DATA_CARD_SELECTOR) as HTMLElement | null
  if (cardLike) {
    const slug =
      cardLike.getAttribute('data-guide-card-slug')?.trim().slice(0, GUIDE_POINTER_CARD_SLUG_MAX_LEN) ||
      cardLike.getAttribute('href')?.slice(0, 120)
    return {
      kind: 'dynamic',
      domain: 'ui',
      action: guideDynamicActionSchema.parse('card_click'),
      subject: slug || undefined,
      detail: {
        label:
          (cardLike.getAttribute('aria-label') || cardLike.textContent || '')
            .trim()
            .slice(0, GUIDE_POINTER_LABEL_MAX_LEN) || undefined,
      },
    }
  }

  const tab = target.closest('[role="tab"]') as HTMLElement | null
  if (tab) {
    return {
      kind: 'dynamic',
      domain: 'ui',
      action: guideDynamicActionSchema.parse('tab_select'),
      detail: {
        label: (tab.textContent || tab.getAttribute('aria-label') || '')
          .trim()
          .slice(0, GUIDE_POINTER_LABEL_MAX_LEN),
      },
    }
  }

  const interactive = target.closest(GUIDE_POINTER_INTERACTIVE_SELECTOR) as HTMLElement | null
  if (!interactive) return null

  const tag = interactive.tagName.toLowerCase()
  const role =
    interactive.getAttribute('role') ||
    (tag === 'a' ? 'link' : tag === 'button' ? 'button' : tag)
  const label = (
    interactive.textContent ||
    interactive.getAttribute('aria-label') ||
    interactive.getAttribute('title') ||
    ''
  )
    .trim()
    .slice(0, GUIDE_POINTER_LABEL_MAX_LEN)

  return {
    kind: 'dynamic',
    domain: 'ui',
    action: guideDynamicActionSchema.parse('pointer_click'),
    detail: {
      surface: role,
      tag,
      label: label || undefined,
    },
  }
}
