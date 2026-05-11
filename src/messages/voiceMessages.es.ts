import type { WidenMessageStrings } from './widen'

export const voiceMessages = {
  title: 'Voz',
  listen: 'Escuchar',
  stop: 'Parar',
  learnMode: 'Aprender',
  learnModeHint: 'Tras un comando reconocido, podés guardar la frase como atajo.',
  saveShortcut: 'Guardar atajo',
  cancel: 'Cerrar',
  listening: 'Escuchando…',
  processing: 'Procesando…',
  noSpeech: 'No se detectó voz. Probá de nuevo.',
  notSupported: 'Tu navegador no soporta reconocimiento de voz.',
  needMic: 'Concedé permiso al micrófono.',
  navigated: 'Listo',
  unknownCommand: 'No reconocí un destino. Decí: perfil, actividad, rutas, ranking…',
  shortcutSaved: 'Atajo guardado',
  shortcutError: 'No se pudo guardar el atajo',
  privacyNote: 'Solo navegación local; la frase no se envía a servicios externos para clasificar.',
  coachVoiceRead: 'Leer coach',
  coachVoiceReadHint:
    'El pet lee en voz alta los mensajes del coach (voz del sistema de tu dispositivo).',
} as const

export type VoiceMessages = WidenMessageStrings<typeof voiceMessages>
