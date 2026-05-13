import { buildAffectivePromptAugment } from '@/lib/affective'
import type { GuideWorldStateController } from '@/lib/affective'
import type { GuideContext } from '@/lib/guide-ai/types'

export function buildAffectiveAugmentForLlm(
  world: GuideWorldStateController,
  ctx: GuideContext,
) {
  world.ingestFromGuideContext(ctx)
  return buildAffectivePromptAugment(world.getSnapshot())
}
