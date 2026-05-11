export type {
  GuideWorldReplayTick,
  GuideWorldStateSnapshot,
  GuideAppTriggerPulse,
  GuideCatalogTriggerPulse,
  GuideDynamicTriggerPulse,
  GuideTriggerInput,
} from '@/lib/affective/types'
export { GuideWorldStateController } from '@/lib/affective/guideWorldState'
export {
  GUIDE_APP_TRIGGER_META,
  getGuideAppTriggerMeta,
  inferNavTriggerFromPathname,
  isGuideAppTriggerId,
  type GuideAppTriggerGroup,
  type GuideAppTriggerId,
  type GuideAppTriggerMetaEntry,
  type GuideAppTriggerOrigin,
} from '@/lib/affective/guideAppTriggerCatalog'
export {
  buildAffectivePromptAugment,
  deriveSituationTags,
  pickPetEmotionCandidates,
} from '@/lib/affective/emotionIntentPolicy'
export {
  guideTriggerInputSchema,
  guideWorldStateSnapshotSchema,
  parseGuideTriggerInput,
  parseGuideWorldStateSnapshot,
} from '@/lib/affective/schema/guideAffectiveSchemas'
export {
  AFFECTIVE_ATLAS_DEFAULT_MIN_MS,
  gateAtlasEmotionSwitch,
  type AffectiveAtlasGateState,
} from '@/lib/affective/affectiveOutputGate'
export {
  ATTR_GUIDE_ACTION,
  ATTR_GUIDE_DOMAIN,
  ATTR_GUIDE_SUBJECT,
  classifyGuidePointerTarget,
} from '@/lib/affective/guidePointerClassification'
export { getDynamicTriggerHintEs } from '@/lib/affective/guideDynamicTriggerHints'
