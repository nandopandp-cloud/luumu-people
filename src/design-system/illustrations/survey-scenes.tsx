import { Plum } from "./luumu-plum";

/**
 * Ilustrações da página de Pesquisas (mockup "Sua opinião importa!").
 * SVG puro, decorativo (aria-hidden), com o mascote oficial (luumu-plum).
 *  - SurveysBackdrop: o ambiente de escritório desfocado ao fundo do banner;
 *  - SurveysHeroScene: o Luumu piscando no notebook, a lâmpada e o balão de fala;
 *  - SurveyCardScene: carinhas de humor, balões e o Luumu com a prancheta.
 */

const LEAF_GREENS = ["#4E9F2E", "#6DB33F", "#85C926", "#3F8A26"];

/** Folhagem de planta de vaso: folhas alongadas saindo de um ponto. */
function Foliage({ x, y, scale = 1, leaves }: { x: number; y: number; scale?: number; leaves: { angle: number; length: number; width: number }[] }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {leaves.map((l, i) => (
        <g key={i} transform={`rotate(${l.angle})`}>
          <path
            d={`M0 0C${-l.width} ${-l.length * 0.35} ${-l.width * 0.7} ${-l.length * 0.8} 0 ${-l.length}C${l.width * 0.7} ${-l.length * 0.8} ${l.width} ${-l.length * 0.35} 0 0Z`}
            fill={LEAF_GREENS[i % LEAF_GREENS.length]}
          />
          <path d={`M0 0L0 ${-l.length * 0.92}`} stroke="#2F6B1C" strokeOpacity="0.35" strokeWidth="1.5" />
        </g>
      ))}
    </g>
  );
}

/** Fundo do banner: janela iluminada, plantas e móveis fora de foco. Preenche e recorta à direita. */
export function SurveysBackdrop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 260" preserveAspectRatio="xMaxYMid slice" className={className} aria-hidden focusable="false">
      <defs>
        <filter id="pesq-fundo-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="pesq-fundo-blur-leve" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <radialGradient id="pesq-fundo-luz" cx="0.62" cy="0.18" r="0.55">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pesq-fundo-esmaecer" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="1" />
        </linearGradient>
        <mask id="pesq-fundo-mascara">
          <rect width="1000" height="260" fill="url(#pesq-fundo-esmaecer)" />
        </mask>
        <linearGradient id="pesq-fundo-piso" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#efe8fd" stopOpacity="0" />
          <stop offset="1" stopColor="#e6dcfb" />
        </linearGradient>
      </defs>
      <g mask="url(#pesq-fundo-mascara)">
        {/* janela ampla com caixilhos */}
        <g filter="url(#pesq-fundo-blur)">
          <rect x="420" y="-30" width="560" height="230" rx="10" fill="#f6f2ff" />
          <g fill="#ffffff" opacity="0.9">
            <rect x="472" y="-20" width="140" height="120" rx="4" />
            <rect x="626" y="-20" width="140" height="120" rx="4" />
            <rect x="780" y="-20" width="160" height="120" rx="4" />
            <rect x="472" y="112" width="140" height="80" rx="4" />
            <rect x="626" y="112" width="140" height="80" rx="4" />
            <rect x="780" y="112" width="160" height="80" rx="4" />
          </g>
          {/* paisagem clara lá fora */}
          <ellipse cx="560" cy="170" rx="110" ry="30" fill="#dcefd0" opacity="0.5" />
          <ellipse cx="860" cy="165" rx="140" ry="40" fill="#d8ecca" opacity="0.5" />
        </g>
        <rect width="1000" height="260" fill="url(#pesq-fundo-luz)" />
        {/* piso e mesa de canto */}
        <rect y="170" width="1000" height="90" fill="url(#pesq-fundo-piso)" />
        <g filter="url(#pesq-fundo-blur)">
          <ellipse cx="560" cy="236" rx="120" ry="30" fill="#ffffff" opacity="0.8" />
          <circle cx="905" cy="150" r="16" fill="#c4b5fd" opacity="0.8" />
        </g>
        {/* planta fora de foco atrás da cena */}
        <g filter="url(#pesq-fundo-blur)" opacity="0.7">
          <Foliage
            x={760}
            y={262}
            scale={0.9}
            leaves={[
              { angle: -40, length: 110, width: 24 },
              { angle: -12, length: 140, width: 28 },
              { angle: 16, length: 120, width: 24 },
              { angle: 42, length: 90, width: 20 },
            ]}
          />
        </g>
        {/* planta em vaso à direita, quase nítida */}
        <g filter="url(#pesq-fundo-blur-leve)">
          <Foliage
            x={955}
            y={210}
            leaves={[
              { angle: -60, length: 92, width: 22 },
              { angle: -32, length: 118, width: 25 },
              { angle: -8, length: 128, width: 24 },
              { angle: 18, length: 110, width: 22 },
              { angle: 44, length: 86, width: 18 },
              { angle: -84, length: 70, width: 16 },
            ]}
          />
          <path d="M925 206h60l-8 52h-44z" fill="#f4efe6" />
          <rect x="921" y="200" width="68" height="12" rx="4" fill="#fbf7f0" />
        </g>
      </g>
    </svg>
  );
}

/** Luumu piscando atrás do notebook, sobre a mesa, com a lâmpada da ideia e o balão de fala. */
export function SurveysHeroScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 470 250" preserveAspectRatio="xMidYMax meet" className={className} aria-hidden focusable="false">
      <defs>
        <filter id="pesq-cena-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="pesq-cena-sombra" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#5b21b6" floodOpacity="0.14" />
        </filter>
        <linearGradient id="pesq-mesa" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1ebfd" />
        </linearGradient>
        <linearGradient id="pesq-notebook" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fbfbfd" />
          <stop offset="0.55" stopColor="#e4e2ec" />
          <stop offset="1" stopColor="#c9c5d6" />
        </linearGradient>
        <radialGradient id="pesq-lampada" cx="0.4" cy="0.35" r="0.65">
          <stop offset="0" stopColor="#fff7c2" />
          <stop offset="0.6" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="pesq-brilho" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fef3c7" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fef3c7" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pesq-bolha" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#ede9fe" />
          <stop offset="1" stopColor="#c4b5fd" />
        </radialGradient>
      </defs>

      {/* almofada fora de foco e bolhas lilases */}
      <ellipse cx="96" cy="234" rx="56" ry="20" fill="#ffffff" opacity="0.8" filter="url(#pesq-cena-blur)" />
      <circle cx="352" cy="160" r="12" fill="#a78bfa" opacity="0.5" filter="url(#pesq-cena-blur)" />

      {/* balão de conversa flutuando */}
      <g transform="translate(40 40)">
        <circle r="21" fill="url(#pesq-bolha)" opacity="0.9" />
        <path d="M-9-5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H-1l-6 5v-5h-2z" fill="#ffffff" opacity="0.95" />
      </g>

      {/* lâmpada da ideia */}
      <circle cx="74" cy="118" r="40" fill="url(#pesq-brilho)" />
      <g transform="translate(74 112)">
        <path d="M0-24c13 0 22 9.5 22 21 0 8-4.4 13.4-8.6 17.6-2.2 2.2-3.4 4.6-3.4 7.4h-20c0-2.8-1.2-5.2-3.4-7.4C-17.6 10.4-22 5-22-3c0-11.5 9-21 22-21z" fill="url(#pesq-lampada)" />
        <path d="M-6-4l6 8 6-8" stroke="#d97706" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <ellipse cx="-8" cy="-11" rx="5" ry="7" fill="#ffffff" opacity="0.65" transform="rotate(25 -8 -11)" />
        <rect x="-10" y="22" width="20" height="5" rx="2" fill="#a8a3b8" />
        <rect x="-9" y="28" width="18" height="5" rx="2" fill="#8f8aa3" />
        <rect x="-5" y="34" width="10" height="4" rx="2" fill="#77718c" />
      </g>

      {/* mesa redonda */}
      <ellipse cx="220" cy="246" rx="176" ry="12" fill="#5b21b6" opacity="0.08" />
      <path d="M48 226c0-11 77-20 172-20s172 9 172 20v6c0 11-77 20-172 20S48 243 48 232z" fill="#e5dcfa" />
      <ellipse cx="220" cy="226" rx="172" ry="20" fill="url(#pesq-mesa)" />

      {/* Luumu (piscando) */}
      <Plum id="pesq-heroi" face="wink" x={158} y={14} scale={0.43} />

      {/* notebook visto por trás, à frente do Luumu */}
      <g filter="url(#pesq-cena-sombra)">
        <path d="M112 174c0-4 3-6.6 7-6.8l96-4c4-.2 7.2 2.8 7.2 6.8V216H112z" fill="url(#pesq-notebook)" />
        <path d="M112 174c0-4 3-6.6 7-6.8l96-4c4-.2 7.2 2.8 7.2 6.8" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.5" fill="none" />
        {/* logo da folha na tampa */}
        <path d="M167 204c-7-4.4-8-13-2.3-18.4 6.2 3.8 7.8 12.2 2.3 18.4z" fill="#bdb7cf" />
        <path d="M167 204c2.3-6.2.9-12.4-2.3-18.4" stroke="#dcd8e6" strokeWidth="1.3" fill="none" />
        <path d="M98 215h138c3 0 4 3 2 5l-5 5H101l-5-5c-2-2-1-5 2-5z" fill="#d3cfdf" />
        <path d="M101 225h132l-3 3H104z" fill="#b2acc4" />
      </g>
      {/* mão do Luumu segurando a lateral da tampa */}
      <g transform="rotate(-8 225 192)">
        <ellipse cx="226" cy="192" rx="10.5" ry="14" fill="#5b2990" />
        <ellipse cx="224" cy="190" rx="9.5" ry="13" fill="#7d3cba" />
        <path d="M219 182q2-5 7-6" stroke="#9e5ecb" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </g>

      {/* balão de fala */}
      <g filter="url(#pesq-cena-sombra)">
        <path d="M330 14h128a12 12 0 0 1 12 12v58a12 12 0 0 1-12 12H354l-14 13v-13h-10a12 12 0 0 1-12-12V26a12 12 0 0 1 12-12z" fill="#ffffff" />
      </g>
      <text x="334" y="40" fontSize="13.5" fontWeight="500" fill="#1e293b" style={{ fontFamily: "inherit" }}>
        <tspan x="334">Pequenas opiniões</tspan>
        <tspan x="334" dy="19">
          geram grandes
        </tspan>
        <tspan x="334" dy="19">
          mudanças! <tspan fill="#7c3aed">💜</tspan>
        </tspan>
      </text>
    </svg>
  );
}

/** Uma carinha de humor em relevo. */
function MoodFace({ x, y, r, from, to, mood }: { x: number; y: number; r: number; from: string; to: string; mood: "happy" | "neutral" | "sad" }) {
  const id = `pesq-carinha-${mood}`;
  const ink = "#2b1a3d";
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <radialGradient id={id} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </radialGradient>
      </defs>
      <circle r={r} fill="#5b21b6" opacity="0.12" transform={`translate(2 ${r * 0.18})`} />
      <circle r={r} fill={`url(#${id})`} />
      <ellipse cx={-r * 0.35} cy={-r * 0.45} rx={r * 0.32} ry={r * 0.2} fill="#ffffff" opacity="0.45" transform={`rotate(-25 ${-r * 0.35} ${-r * 0.45})`} />
      <ellipse cx={-r * 0.32} cy={-r * 0.08} rx={r * 0.09} ry={r * 0.13} fill={ink} />
      <ellipse cx={r * 0.32} cy={-r * 0.08} rx={r * 0.09} ry={r * 0.13} fill={ink} />
      {mood === "happy" ? <path d={`M${-r * 0.42} ${r * 0.22}Q0 ${r * 0.72} ${r * 0.42} ${r * 0.22}`} stroke={ink} strokeWidth={r * 0.11} strokeLinecap="round" fill="none" /> : null}
      {mood === "neutral" ? <path d={`M${-r * 0.3} ${r * 0.38}H${r * 0.3}`} stroke={ink} strokeWidth={r * 0.11} strokeLinecap="round" /> : null}
      {mood === "sad" ? <path d={`M${-r * 0.36} ${r * 0.5}Q0 ${r * 0.12} ${r * 0.36} ${r * 0.5}`} stroke={ink} strokeWidth={r * 0.11} strokeLinecap="round" fill="none" /> : null}
    </g>
  );
}

/** Arte do cartão da pesquisa aberta: carinhas, balões e o Luumu segurando a prancheta. */
export function SurveyCardScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 344 222" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="pesq-cartao-fundo" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f7f3ff" />
          <stop offset="0.5" stopColor="#ece4ff" />
          <stop offset="1" stopColor="#dccdfd" />
        </linearGradient>
        <filter id="pesq-cartao-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="pesq-cartao-sombra" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#5b21b6" floodOpacity="0.18" />
        </filter>
        <linearGradient id="pesq-cartao-balao" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#b9a2fb" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <radialGradient id="pesq-cartao-bolha" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#f3efff" />
          <stop offset="1" stopColor="#cdbdfc" />
        </radialGradient>
      </defs>
      <rect width="344" height="222" fill="url(#pesq-cartao-fundo)" />
      {/* luzes desfocadas */}
      <circle cx="310" cy="16" r="56" fill="#ffffff" opacity="0.55" filter="url(#pesq-cartao-blur)" />
      <circle cx="18" cy="196" r="46" fill="#ffffff" opacity="0.5" filter="url(#pesq-cartao-blur)" />
      <circle cx="286" cy="30" r="5" fill="#ffffff" opacity="0.9" />
      <circle cx="248" cy="18" r="3" fill="#ffffff" opacity="0.7" />

      {/* balão roxo com "texto" */}
      <g filter="url(#pesq-cartao-sombra)">
        <path d="M128 16h60a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10h-36l-10 9v-9h-14a10 10 0 0 1-10-10V26a10 10 0 0 1 10-10z" fill="url(#pesq-cartao-balao)" />
      </g>
      <circle cx="138" cy="36" r="6" fill="#ffffff" opacity="0.95" />
      <rect x="150" y="32" width="36" height="8" rx="4" fill="#ffffff" opacity="0.95" />

      {/* carinhas */}
      <g filter="url(#pesq-cartao-sombra)">
        <MoodFace x={62} y={84} r={29} from="#86efac" to="#16a34a" mood="happy" />
        <MoodFace x={164} y={98} r={24} from="#fef9c3" to="#facc15" mood="neutral" />
        <MoodFace x={122} y={134} r={29} from="#fca5a5" to="#dc2626" mood="sad" />
      </g>

      {/* balão de conversa lilás */}
      <g transform="translate(46 176)" opacity="0.9">
        <circle r="20" fill="url(#pesq-cartao-bolha)" />
        <path d="M-8-4a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H-1l-5 4v-4h-2z" fill="#ffffff" />
      </g>

      {/* Luumu com a prancheta */}
      <Plum id="pesq-cartao" face="happy" x={184} y={42} scale={0.37} />
      <g transform="translate(166 146) rotate(-10) scale(0.82)" filter="url(#pesq-cartao-sombra)">
        <rect width="70" height="88" rx="8" fill="#ffffff" />
        <rect width="70" height="88" rx="8" fill="none" stroke="#ddd6fe" strokeWidth="2" />
        <rect x="20" y="-6" width="30" height="12" rx="4" fill="#7c3aed" />
        {[22, 44, 66].map((y) => (
          <g key={y}>
            <rect x="10" y={y - 6} width="12" height="12" rx="3" fill="#ede9fe" />
            <path d={`M13 ${y}l2.6 2.6 4.4-5`} stroke="#7c3aed" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="27" y={y - 3} width="32" height="6" rx="3" fill="#ddd6fe" />
          </g>
        ))}
      </g>
      {/* mãos segurando a prancheta */}
      <g transform="rotate(-30 168 196)">
        <ellipse cx="168" cy="198" rx="11" ry="9" fill="#5b2990" />
        <ellipse cx="169" cy="196" rx="10" ry="8" fill="#7d3cba" />
      </g>
      <g transform="rotate(24 226 182)">
        <ellipse cx="226" cy="184" rx="11" ry="9" fill="#5b2990" />
        <ellipse cx="227" cy="182" rx="10" ry="8" fill="#7d3cba" />
      </g>
      <path d="M162 192q5-4 10-3" stroke="#9e5ecb" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
