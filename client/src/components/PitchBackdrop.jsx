// The JPL signature: a 22-yard pitch drawn as crease geometry — popping creases,
export default function PitchBackdrop({ className = '' }) {
  return (
    <svg className={`pitch ${className}`} viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="pitchStrip" x1="0" x2="1">
          <stop offset="0" stopColor="#F4E9D8" stopOpacity="0" />
          <stop offset=".18" stopColor="#F4E9D8" stopOpacity=".05" />
          <stop offset=".82" stopColor="#F4E9D8" stopOpacity=".05" />
          <stop offset="1" stopColor="#F4E9D8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="210" width="1600" height="180" fill="url(#pitchStrip)" />
      <g stroke="#F4E9D8" strokeOpacity=".16" strokeWidth="2" fill="none">
        {// bowling creases}
        <line x1="220" y1="230" x2="220" y2="370" />
        <line x1="1380" y1="230" x2="1380" y2="370" />
        {// popping creases}
        <line x1="300" y1="190" x2="300" y2="410" />
        <line x1="1300" y1="190" x2="1300" y2="410" />
        {// return creases}
        <line x1="180" y1="250" x2="300" y2="250" />
        <line x1="180" y1="350" x2="300" y2="350" />
        <line x1="1300" y1="250" x2="1420" y2="250" />
        <line x1="1300" y1="350" x2="1420" y2="350" />
      </g>
      <g fill="#F4E9D8" fillOpacity=".22">
        <rect x="216" y="286" width="8" height="8" rx="2" />
        <rect x="216" y="296" width="8" height="8" rx="2" />
        <rect x="216" y="306" width="8" height="8" rx="2" />
        <rect x="1376" y="286" width="8" height="8" rx="2" />
        <rect x="1376" y="296" width="8" height="8" rx="2" />
        <rect x="1376" y="306" width="8" height="8" rx="2" />
      </g>
      {// boundary rope arc}
      <path d="M-100 620 Q800 -80 1700 620" fill="none" stroke="#F4E9D8" strokeOpacity=".06" strokeWidth="2" strokeDasharray="2 10" />
    </svg>
  )
}
