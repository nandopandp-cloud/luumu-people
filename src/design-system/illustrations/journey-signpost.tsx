/**
 * Ilustração do hero da Início: o mascote com uma bússola diante das placas
 * APRENDER · DESENVOLVER · CRESCER · CONQUISTAR (mockup da Home).
 * SVG puro: escala sem perda, sem requisição extra e decorativo (aria-hidden).
 */
function Board({ y, label, fill, shade, text, direction, rotate }: { y: number; label: string; fill: string; shade: string; text: string; direction: "left" | "right"; rotate: number }) {
  const width = 180;
  const height = 40;
  const tip = 20;
  const x = direction === "right" ? 262 : 244;
  const path =
    direction === "right"
      ? `M${x} ${y} h${width - tip} l${tip} ${height / 2} l${-tip} ${height / 2} h${-(width - tip)} z`
      : `M${x + tip} ${y} h${width - tip} v${height} h${-(width - tip)} l${-tip} ${-height / 2} z`;
  const cx = x + (direction === "right" ? (width - tip) / 2 : tip + (width - tip) / 2);
  return (
    <g transform={`rotate(${rotate} ${x + width / 2} ${y + height / 2})`}>
      <path d={path} transform="translate(0 4)" fill={shade} />
      <path d={path} fill={fill} />
      <text x={cx} y={y + height / 2 + 6} textAnchor="middle" fontSize="16" fontWeight="800" letterSpacing="0.6" fill={text} style={{ fontFamily: "inherit" }}>
        {label}
      </text>
    </g>
  );
}

function Leaf({ x, y, scale = 1, rotate = 0, flip = false }: { x: number; y: number; scale?: number; rotate?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${flip ? -scale : scale} ${scale})`}>
      <path d="M0 0C-16-18-14-46 0-62 14-46 16-18 0 0Z" fill="#7CC639" />
      <path d="M0 0C-4-20-2-44 0-62 14-46 16-18 0 0Z" fill="#4E9F2E" />
    </g>
  );
}

export function JourneySignpost({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 440 330" className={className} aria-hidden focusable="false">
      {/* nuvens e luz */}
      <circle cx="180" cy="120" r="120" fill="#ffffff" opacity="0.18" />
      <g fill="#ffffff" opacity="0.75">
        <ellipse cx="205" cy="70" rx="34" ry="16" />
        <ellipse cx="228" cy="60" rx="26" ry="18" />
        <ellipse cx="250" cy="72" rx="24" ry="13" />
      </g>
      {/* colinas */}
      <path d="M0 300C70 262 150 270 230 288S380 300 440 278V330H0Z" fill="#9DD25C" />
      <path d="M0 316C90 292 180 300 270 312S400 316 440 304V330H0Z" fill="#6DB33F" />
      {/* poste */}
      <rect x="328" y="22" width="16" height="292" rx="3" fill="#7A4A22" />
      <rect x="324" y="16" width="24" height="12" rx="4" fill="#5E3815" />
      <Board y={40} label="APRENDER" fill="#F7931E" shade="#C96A0A" text="#ffffff" direction="right" rotate={-5} />
      <Board y={96} label="DESENVOLVER" fill="#7C3AED" shade="#5B21B6" text="#ffffff" direction="left" rotate={4} />
      <Board y={152} label="CRESCER" fill="#4CAF50" shade="#2E7D32" text="#ffffff" direction="right" rotate={-3} />
      <Board y={208} label="CONQUISTAR" fill="#FBBF24" shade="#D69E0B" text="#5B3A06" direction="right" rotate={-6} />
      {/* plantas */}
      <Leaf x={70} y={308} scale={1.1} rotate={-30} />
      <Leaf x={86} y={308} scale={0.9} rotate={10} flip />
      <Leaf x={300} y={312} scale={0.8} rotate={20} />
      {/* mascote */}
      <image href="/brand/mascot.svg" x="96" y="96" width="192" height="230" />
      {/* bússola */}
      <g transform="translate(258 254)">
        <circle r="30" fill="#4B5563" />
        <circle r="26" fill="#9CA3AF" />
        <circle r="21" fill="#F9FAFB" />
        <path d="M0-17 5 0 0 17-5 0Z" fill="#EF4444" />
        <path d="M0 0 5 0 0 17-5 0Z" fill="#1D4ED8" />
        <circle r="2.5" fill="#111827" />
        <rect x="-4" y="-36" width="8" height="8" rx="2" fill="#4B5563" />
      </g>
    </svg>
  );
}
