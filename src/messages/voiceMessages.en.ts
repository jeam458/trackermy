import type { VoiceMessages } from './voiceMessages.es'

export const voiceMessagesEn: VoiceMessages = {
  title: 'Voice',
  listen: 'Listen',
  stop: 'Stop',
  learnMode: 'Learn',
  learnModeHint: 'After a recognized command, you can save the phrase as a shortcut.',
  saveShortcut: 'Save shortcut',
  cancel: 'Close',
  listening: 'Listening…',
  processing: 'Processing…',
  noSpeech: 'No speech detected. Try again.',
  notSupported: 'Your browser does not support speech recognition.',
  needMic: 'Allow microphone access.',
  navigated: 'Done',
  unknownCommand: "I didn't recognize a destination. Say: profile, activity, routes, ranking…",
  shortcutSaved: 'Shortcut saved',
  shortcutError: 'Could not save shortcut',
  privacyNote: 'Local navigation only; your phrase is not sent to third parties for classification.',
  coachVoiceRead: 'Read coach',
  coachVoiceReadHint: 'The pet speaks coach messages aloud (your device system voice).',
}
