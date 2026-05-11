'use client'

import type { ReactNode } from 'react'
import type { PetEmotion } from '@/components/pet/guardDhPetTypes'

/** Iconografía mínima por celda emocional (misma semántica que la lámina modular). */
export function PetEmotionVectorDecors({ emotion }: { emotion: PetEmotion }) {
  const g = (children: ReactNode) => <g opacity={0.92}>{children}</g>

  switch (emotion) {
    case 'principal':
      return null
    case 'pensando_minimal':
      return g(<path d="M 50 52 Q 52 54 54 52" stroke="rgba(148,163,184,0.5)" strokeWidth="0.8" fill="none" />)
    case 'conexion_perdida':
      return g(
        <>
          <path d="M 12 18 L 26 28 M 26 18 L 12 28" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
          <rect x="52" y="16" width="32" height="14" rx="2" stroke="#64748b" strokeWidth="1" fill="none" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={54 + i * 7} y={26 - i * 3} width="5" height={4 + i * 3} fill="#475569" opacity={0.7} rx="0.8" />
          ))}
        </>
      )
    case 'recuperando':
      return g(
        <>
          <path d="M 14 74 Q 22 69 26 74 Q 21 82 17 76" stroke="#34d399" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <rect x="70" y="14" width="18" height="22" rx="3" stroke="#34d399" strokeWidth="1.3" fill="rgba(52,211,153,0.15)" />
          <path d="M 73 34 L 76 39 L 85 29" stroke="#34d399" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'ayuda_exitosa_fiesta':
      return g(
        <>
          <path d="M 44 14 L 50 26 L 56 14 L 53 26 L 50 30 L 47 26 Z" fill="#fcd34d" stroke="#78350f" strokeWidth="0.5" />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={20 + ((i * 17) % 60)} cy={72 + ((i * 13) % 18)} r="2" fill={['#f472b6', '#60a5fa', '#fcd34d', '#34d399', '#a78bfa'][i]} opacity={0.85} />
          ))}
          <path d="M 72 74 L 78 74 C 76 71 73 71 72 74" stroke="#fef08a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </>
      )
    case 'exhausto':
      return g(<path d="M 74 72 L 70 74 L 78 74 M 71 71 L 75 71" stroke="#64748b" strokeWidth="1.1" opacity={0.65} strokeLinecap="round" />)
    case 'exhausto_total':
      return g(
        <>
          <circle cx="74" cy="72" r="7" stroke="#94a3b8" strokeWidth="1" fill="none" />
          <path d="M 68 71 L 80 71 M 71 73 L 77 73" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" opacity={0.7} />
        </>
      )
    case 'inicio_ruta':
      return g(<path d="M 71 22 L 88 38 M 71 38 L 88 22" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="square" opacity={0.75} />)
    case 'espera_sincronizacion':
      return g(
        <>
          <rect x="70" y="13" width="16" height="20" rx="2" stroke="#94a3b8" strokeWidth="1" fill="rgba(148,163,184,0.12)" />
          <path d="M 71 34 L 85 34" stroke="#cbd5e1" strokeWidth="1.2" />
          <path d="M 78 12 L 78 68 M 88 76 L 86 74 L 90 74 Z" stroke="#94a3b8" strokeWidth="1.1" fill="none" />
        </>
      )
    case 'confusion_error':
      return g(
        <>
          <text x="22" y="22" fill="#f87171" fontSize="13" fontWeight="700">
            ✕
          </text>
          <text x="34" y="26" fill="#fcd34d" fontSize="12" fontWeight="700">
            ?
          </text>
          <rect x="71" y="68" width="13" height="19" rx="2" stroke="#94a3b8" strokeWidth="1.1" fill="none" />
          <circle cx="83" cy="64" r="3" fill="#fb7185" />
        </>
      )
    case 'datos_guardados':
      return g(
        <>
          <rect x="66" y="58" width="26" height="22" rx="3" fill="rgba(15,23,42,0.55)" stroke="rgba(148,163,184,0.4)" strokeWidth="0.9" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={69 + i * 7} y={71} width="9" height="3.5" rx="0.6" fill="#475569" />
          ))}
          <circle cx="79" cy="64" r="5" stroke="#34d399" strokeWidth="1.4" fill="none" />
          <path d="M 76 63 L 78 66 L 83 61" stroke="#34d399" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </>
      )
    case 'pensando_mapa':
      return g(
        <>
          <circle cx="74" cy="43" r="8" stroke="#38bdf8" strokeWidth="1.5" fill="rgba(56,189,248,0.12)" />
          <circle cx="74" cy="43" r="3" fill="#bae6fd" opacity={0.9} />
          <path d="M 74 54 Q 74 61 82 61 Q 88 61 87 53" stroke="rgba(148,163,184,0.7)" strokeWidth="1.2" fill="none" />
          <circle cx="86" cy="28" r="5" stroke="#60a5fa" strokeWidth="1" fill="none" />
          <path d="M 86 31 L 86 39 M 83 34 L 89 34" stroke="#60a5fa" strokeWidth="0.85" strokeLinecap="round" />
        </>
      )
    case 'obstaculo_detectado':
      return g(
        <>
          <path d="M 72 74 L 70 71 L 78 71 Z" fill="#fcd34d" stroke="#92400e" strokeWidth="0.5" opacity={0.88} />
          <path d="M 74 74 L 76 71 L 80 71 Z" fill="#fcd34d" opacity={0.88} />
          <circle cx="18" cy="20" r="5" stroke="#cbd5e1" strokeWidth="0.85" fill="rgba(226,232,240,0.15)" />
        </>
      )
    case 'fin_ruta':
      return g(
        <>
          <path d="M 18 74 L 10 76 M 26 74 L 34 76" stroke="#e2e8f0" strokeWidth="5" opacity={0.75} strokeLinecap="square" />
          <path d="M 68 74 L 90 92 L 71 94 Z" fill="#fcd34d" stroke="#b45309" strokeWidth="0.6" />
        </>
      )
    case 'saludo':
      return g(
        <>
          <path d="M 14 74 Q 26 72 34 74 Q 30 82 34 74" stroke="#f8fafc" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M 14 73 L 12 71 M 34 73 L 36 71" stroke="#cbd5e1" strokeWidth="1" strokeLinecap="round" />
        </>
      )
    case 'cansado_flor':
      return g(<path d="M 74 74 Q 80 76 76 82 Q 78 74 74 73" stroke="#fb923c" strokeWidth="1.6" fill="none" opacity={0.75} strokeLinecap="round" />)
    case 'cansado':
      return g(
        <>
          <rect x="72" y="68" width="12" height="18" rx="2" stroke="#64748b" strokeWidth="1" fill="none" />
          <circle cx="84" cy="64" r="2.8" fill="#fb7185" />
        </>
      )
    case 'velocidad_critica':
      return g(<path d="M 74 72 L 90 74 L 86 88 Z" stroke="#38bdf8" strokeWidth="1.3" fill="rgba(56,189,248,0.12)" strokeLinejoin="round" />)
    case 'bateria_baja':
      return g(
        <>
          <rect x="70" y="14" width="12" height="20" rx="2" stroke="#f87171" strokeWidth="1.4" fill="rgba(127,29,29,0.12)" />
          <rect x="72.8" y="9" width="6.5" height="3" rx="1" fill="#f87171" />
          <rect x="72" y={14 + 14} width="8" height="4" rx="0.9" fill="#ef4444" />
        </>
      )
    case 'vinculo_tiempo':
      return g(
        <>
          <rect x="71" y="58" width="10" height="14" rx="1.6" stroke="#94a3b8" strokeWidth="1" fill="rgba(51,65,85,0.2)" />
          <path d="M 72 61 L 80 61 M 72 64.5 L 79 64.5 M 73 71 L 79 71" stroke="#cbd5e1" strokeWidth="0.95" strokeLinecap="round" />
          <path d="M 84 71 L 86 73 L 88 71 L 86 74 Z" stroke="#fb7185" strokeWidth="0.95" fill="rgba(251,113,133,0.2)" strokeLinejoin="round" />
        </>
      )
    case 'molesto':
      return g(
        <>
          <path d="M 22 73 L 32 71 L 42 73" stroke="#854d0e" strokeWidth="1.5" fill="rgba(251,146,60,0.15)" strokeLinecap="round" />
          <text x="22" y="79" fill="#fcd34d" fontSize="5.2" opacity={0.85} fontFamily="system-ui,sans-serif">
            Qosqo
          </text>
          <path d="M 72 71 L 70 73 L 78 71 L 74 73 Z M 71 73 L 85 73" stroke="#fca5a5" strokeWidth="0.95" opacity={0.85} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    default:
      return null
  }
}
