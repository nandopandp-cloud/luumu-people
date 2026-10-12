/**
 * Capa padrão do perfil de colegas (quando a pessoa não escolheu uma):
 * céu lilás, nuvens, morros e árvores roxas e verdes, no clima da marca.
 * SVG puro e decorativo; preenche e recorta o contêiner.
 */
function Tree({ x, y, scale = 1, crown = "#8b5cf6", shade = "#6d28d9" }: { x: number; y: number; scale?: number; crown?: string; shade?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-3" y="-6" width="6" height="26" rx="2" fill="#5b3a8e" />
      <ellipse cx="0" cy="-26" rx="20" ry="26" fill={shade} />
      <ellipse cx="-4" cy="-30" rx="16" ry="22" fill={crown} />
      <ellipse cx="-8" cy="-38" rx="6" ry="8" fill="#ffffff" opacity="0.18" />
    </g>
  );
}

export function ProfileCoverArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="capa-ceu" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="0.55" stopColor="#e9d5ff" />
          <stop offset="1" stopColor="#fce7f3" />
        </linearGradient>
        <linearGradient id="capa-morro" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#86c95a" />
          <stop offset="1" stopColor="#4e9f2e" />
        </linearGradient>
      </defs>
      <rect width="360" height="140" fill="url(#capa-ceu)" />
      <circle cx="292" cy="34" r="16" fill="#fff7d6" opacity="0.9" />
      <g fill="#ffffff" opacity="0.85">
        <ellipse cx="70" cy="30" rx="26" ry="9" />
        <ellipse cx="88" cy="24" rx="18" ry="10" />
        <ellipse cx="226" cy="44" rx="22" ry="7" />
        <ellipse cx="240" cy="39" rx="14" ry="8" />
      </g>
      <path d="M0 96C50 70 110 74 170 90S290 104 360 80V140H0Z" fill="#b8a2f0" opacity="0.7" />
      <path d="M0 112C60 92 130 96 200 108S310 116 360 100V140H0Z" fill="url(#capa-morro)" />
      <Tree x={36} y={104} scale={1.05} />
      <Tree x={70} y={110} scale={0.8} crown="#a78bfa" shade="#7c3aed" />
      <Tree x={286} y={102} scale={1.1} crown="#7cc639" shade="#4e9f2e" />
      <Tree x={324} y={108} scale={0.85} />
      <Tree x={250} y={112} scale={0.7} crown="#a78bfa" shade="#7c3aed" />
    </svg>
  );
}
