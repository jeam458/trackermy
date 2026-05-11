'use client'

/**
 * Cabeza + casco característicos (viewBox 0 0 100 100).
 * La expresión (cejas/boca) va encima desde `PetProceduralFaceSvg`.
 */
export function GuardDhPetBodySvg() {
  return (
    <>
      <defs>
        <radialGradient id="gdh-face-grad" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#6d5efc" />
          <stop offset="55%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#312e81" />
        </radialGradient>
        <linearGradient id="gdh-helmet-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="55%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#0d5c56" />
        </linearGradient>
        <filter id="gdh-soft" x="-8%" y="-8%" width="116%" height="116%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodOpacity="0.35" />
        </filter>
      </defs>
      {/* Cabeza */}
      <circle cx="50" cy="54" r="34" fill="url(#gdh-face-grad)" filter="url(#gdh-soft)" opacity={0.98} />
      <ellipse cx="50" cy="56" rx="30" ry="28" fill="rgba(15,23,42,0.12)" />
      {/* Casco */}
      <path
        d="M 18 52 Q 18 26 50 22 Q 82 26 82 52 L 79 54 Q 50 46 21 54 Z"
        fill="url(#gdh-helmet-grad)"
        stroke="#0f172a"
        strokeWidth="1.15"
        strokeOpacity={0.35}
      />
      <ellipse cx="50" cy="30" rx="10" ry="5.8" fill="rgba(255,255,255,0.14)" />
      {/* G */}
      <text
        x="50"
        y="37"
        textAnchor="middle"
        fill="#e0f2fe"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        style={{ userSelect: 'none' }}
      >
        G
      </text>
      {/* Visor oscuro — cejas SVG encima */}
      <rect x="24" y="42" width="52" height="22" rx="10" fill="rgba(15,23,42,0.78)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
      <rect x="28" y="44" width="44" height="16" rx="7" fill="rgba(51,65,85,0.45)" />
    </>
  )
}
