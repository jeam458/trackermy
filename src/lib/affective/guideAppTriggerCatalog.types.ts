export type GuideAppTriggerGroup =
  | 'navigation'
  | 'replay'
  | 'system'
  | 'ui'
  | 'coach'
  | 'future'

export type GuideAppTriggerOrigin = 'user' | 'system' | 'app' | 'scheduled'

export type GuideAppTriggerMetaEntry = {
  group: GuideAppTriggerGroup
  origin: GuideAppTriggerOrigin
  description_es: string
}
