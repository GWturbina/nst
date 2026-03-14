/**
 * DiamondShapes.jsx — Реалистичные SVG огранки (face-up view)
 * Соответствие международным стандартам GIA
 * Round, Princess, Cushion, Oval, Emerald, Radiant, Marquise, Pear, Heart, Asscher, Trillion
 */

export function ShapeSVG({ shape, size = 48, active = false }) {
  const c = active ? '#ffd700' : 'rgba(255,255,255,0.4)'
  const c2 = active ? 'rgba(255,215,0,0.55)' : 'rgba(255,255,255,0.18)'
  const w = active ? 1.2 : 0.8
  const w2 = active ? 0.7 : 0.45

  const shapes = {

    // ═══ ROUND BRILLIANT — circular, octagonal table, 8 kite + 8 star facets ═══
    round: (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="47" stroke={c} strokeWidth={w} fill="none" />
        {/* Octagonal table */}
        <polygon points="40,32 60,32 68,40 68,60 60,68 40,68 32,60 32,40" stroke={c} strokeWidth={w} fill="none" />
        {/* 8 main bezel/kite facets — girdle cardinal to table corners */}
        <line x1="50" y1="3" x2="40" y2="32" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="3" x2="60" y2="32" stroke={c} strokeWidth={w2} />
        <line x1="97" y1="50" x2="68" y2="40" stroke={c} strokeWidth={w2} />
        <line x1="97" y1="50" x2="68" y2="60" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="97" x2="60" y2="68" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="97" x2="40" y2="68" stroke={c} strokeWidth={w2} />
        <line x1="3" y1="50" x2="32" y2="60" stroke={c} strokeWidth={w2} />
        <line x1="3" y1="50" x2="32" y2="40" stroke={c} strokeWidth={w2} />
        {/* 8 star facets — table midpoints to girdle diagonals */}
        <line x1="50" y1="32" x2="83" y2="10" stroke={c2} strokeWidth={w2} />
        <line x1="68" y1="50" x2="90" y2="83" stroke={c2} strokeWidth={w2} />
        <line x1="50" y1="68" x2="17" y2="90" stroke={c2} strokeWidth={w2} />
        <line x1="32" y1="50" x2="10" y2="17" stroke={c2} strokeWidth={w2} />
        <line x1="60" y1="32" x2="83" y2="10" stroke={c2} strokeWidth={w2} />
        <line x1="68" y1="60" x2="90" y2="83" stroke={c2} strokeWidth={w2} />
        <line x1="40" y1="68" x2="17" y2="90" stroke={c2} strokeWidth={w2} />
        <line x1="32" y1="40" x2="10" y2="17" stroke={c2} strokeWidth={w2} />
        {/* Upper girdle facets — filling */}
        <line x1="83" y1="10" x2="68" y2="40" stroke={c2} strokeWidth={w2} />
        <line x1="83" y1="10" x2="60" y2="32" stroke={c} strokeWidth={w2} />
        <line x1="90" y1="83" x2="68" y2="60" stroke={c} strokeWidth={w2} />
        <line x1="90" y1="83" x2="60" y2="68" stroke={c2} strokeWidth={w2} />
        <line x1="17" y1="90" x2="32" y2="60" stroke={c2} strokeWidth={w2} />
        <line x1="17" y1="90" x2="40" y2="68" stroke={c} strokeWidth={w2} />
        <line x1="10" y1="17" x2="32" y2="40" stroke={c} strokeWidth={w2} />
        <line x1="10" y1="17" x2="40" y2="32" stroke={c2} strokeWidth={w2} />
      </svg>
    ),

    // ═══ PRINCESS — square, bold X diagonals + V-chevron patterns from each side ═══
    princess: (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <rect x="5" y="5" width="90" height="90" stroke={c} strokeWidth={w} fill="none" />
        {/* Inner table */}
        <rect x="28" y="28" width="44" height="44" stroke={c} strokeWidth={w} fill="none" />
        {/* Bold corner diagonals */}
        <line x1="5" y1="5" x2="28" y2="28" stroke={c} strokeWidth={w} />
        <line x1="95" y1="5" x2="72" y2="28" stroke={c} strokeWidth={w} />
        <line x1="95" y1="95" x2="72" y2="72" stroke={c} strokeWidth={w} />
        <line x1="5" y1="95" x2="28" y2="72" stroke={c} strokeWidth={w} />
        {/* Top V-chevrons */}
        <line x1="5" y1="5" x2="50" y2="28" stroke={c2} strokeWidth={w2} />
        <line x1="95" y1="5" x2="50" y2="28" stroke={c2} strokeWidth={w2} />
        <line x1="28" y1="5" x2="36" y2="28" stroke={c2} strokeWidth={w2} />
        <line x1="72" y1="5" x2="64" y2="28" stroke={c2} strokeWidth={w2} />
        {/* Bottom V-chevrons */}
        <line x1="5" y1="95" x2="50" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="95" y1="95" x2="50" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="28" y1="95" x2="36" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="72" y1="95" x2="64" y2="72" stroke={c2} strokeWidth={w2} />
        {/* Left V-chevrons */}
        <line x1="5" y1="5" x2="28" y2="50" stroke={c2} strokeWidth={w2} />
        <line x1="5" y1="95" x2="28" y2="50" stroke={c2} strokeWidth={w2} />
        <line x1="5" y1="28" x2="28" y2="36" stroke={c2} strokeWidth={w2} />
        <line x1="5" y1="72" x2="28" y2="64" stroke={c2} strokeWidth={w2} />
        {/* Right V-chevrons */}
        <line x1="95" y1="5" x2="72" y2="50" stroke={c2} strokeWidth={w2} />
        <line x1="95" y1="95" x2="72" y2="50" stroke={c2} strokeWidth={w2} />
        <line x1="95" y1="28" x2="72" y2="36" stroke={c2} strokeWidth={w2} />
        <line x1="95" y1="72" x2="72" y2="64" stroke={c2} strokeWidth={w2} />
      </svg>
    ),

    // ═══ CUSHION — rounded/pillow square with brilliant facets ═══
    cushion: (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Pillow-shaped outline — very rounded corners */}
        <rect x="5" y="5" width="90" height="90" rx="22" ry="22" stroke={c} strokeWidth={w} fill="none" />
        {/* Rounded table */}
        <rect x="28" y="28" width="44" height="44" rx="6" ry="6" stroke={c} strokeWidth={w} fill="none" />
        {/* Corner facets */}
        <line x1="14" y1="14" x2="28" y2="28" stroke={c} strokeWidth={w2} />
        <line x1="86" y1="14" x2="72" y2="28" stroke={c} strokeWidth={w2} />
        <line x1="86" y1="86" x2="72" y2="72" stroke={c} strokeWidth={w2} />
        <line x1="14" y1="86" x2="28" y2="72" stroke={c} strokeWidth={w2} />
        {/* Cardinal kite facets */}
        <line x1="50" y1="5" x2="50" y2="28" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="95" x2="50" y2="72" stroke={c} strokeWidth={w2} />
        <line x1="5" y1="50" x2="28" y2="50" stroke={c} strokeWidth={w2} />
        <line x1="95" y1="50" x2="72" y2="50" stroke={c} strokeWidth={w2} />
        {/* Star/kite brilliant fills */}
        <line x1="14" y1="14" x2="50" y2="28" stroke={c2} strokeWidth={w2} />
        <line x1="86" y1="14" x2="50" y2="28" stroke={c2} strokeWidth={w2} />
        <line x1="86" y1="86" x2="50" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="14" y1="86" x2="50" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="14" y1="14" x2="28" y2="50" stroke={c2} strokeWidth={w2} />
        <line x1="14" y1="86" x2="28" y2="50" stroke={c2} strokeWidth={w2} />
        <line x1="86" y1="14" x2="72" y2="50" stroke={c2} strokeWidth={w2} />
        <line x1="86" y1="86" x2="72" y2="50" stroke={c2} strokeWidth={w2} />
      </svg>
    ),

    // ═══ OVAL — vertical ellipse with brilliant facets ═══
    oval: (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <ellipse cx="50" cy="50" rx="30" ry="46" stroke={c} strokeWidth={w} fill="none" />
        {/* Oval table */}
        <ellipse cx="50" cy="50" rx="14" ry="22" stroke={c} strokeWidth={w} fill="none" />
        {/* Top kite */}
        <line x1="50" y1="4" x2="42" y2="28" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="4" x2="58" y2="28" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="4" x2="50" y2="28" stroke={c2} strokeWidth={w2} />
        {/* Bottom kite */}
        <line x1="50" y1="96" x2="42" y2="72" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="96" x2="58" y2="72" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="96" x2="50" y2="72" stroke={c2} strokeWidth={w2} />
        {/* Side kites */}
        <line x1="20" y1="50" x2="36" y2="42" stroke={c} strokeWidth={w2} />
        <line x1="20" y1="50" x2="36" y2="58" stroke={c} strokeWidth={w2} />
        <line x1="80" y1="50" x2="64" y2="42" stroke={c} strokeWidth={w2} />
        <line x1="80" y1="50" x2="64" y2="58" stroke={c} strokeWidth={w2} />
        {/* Diagonal facets */}
        <line x1="27" y1="18" x2="42" y2="28" stroke={c2} strokeWidth={w2} />
        <line x1="27" y1="18" x2="36" y2="42" stroke={c2} strokeWidth={w2} />
        <line x1="73" y1="18" x2="58" y2="28" stroke={c2} strokeWidth={w2} />
        <line x1="73" y1="18" x2="64" y2="42" stroke={c2} strokeWidth={w2} />
        <line x1="27" y1="82" x2="42" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="27" y1="82" x2="36" y2="58" stroke={c2} strokeWidth={w2} />
        <line x1="73" y1="82" x2="58" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="73" y1="82" x2="64" y2="58" stroke={c2} strokeWidth={w2} />
      </svg>
    ),

    // ═══ EMERALD — RECTANGULAR step cut, wider than tall ═══
    emerald: (
      <svg width={size} height={size} viewBox="0 0 100 80">
        {/* Outer — rectangular with cut corners */}
        <polygon points="14,2 86,2 98,14 98,66 86,78 14,78 2,66 2,14" stroke={c} strokeWidth={w} fill="none" />
        {/* Step 1 */}
        <polygon points="22,12 78,12 88,22 88,58 78,68 22,68 12,58 12,22" stroke={c2} strokeWidth={w2} fill="none" />
        {/* Step 2 */}
        <polygon points="30,20 70,20 78,28 78,52 70,60 30,60 22,52 22,28" stroke={c2} strokeWidth={w2} fill="none" />
        {/* Table — innermost */}
        <polygon points="36,26 64,26 70,32 70,48 64,54 36,54 30,48 30,32" stroke={c} strokeWidth={w} fill="none" />
        {/* Corner lines through all steps */}
        <line x1="14" y1="2" x2="36" y2="26" stroke={c} strokeWidth={w2} />
        <line x1="86" y1="2" x2="64" y2="26" stroke={c} strokeWidth={w2} />
        <line x1="98" y1="14" x2="70" y2="32" stroke={c} strokeWidth={w2} />
        <line x1="98" y1="66" x2="70" y2="48" stroke={c} strokeWidth={w2} />
        <line x1="86" y1="78" x2="64" y2="54" stroke={c} strokeWidth={w2} />
        <line x1="14" y1="78" x2="36" y2="54" stroke={c} strokeWidth={w2} />
        <line x1="2" y1="66" x2="30" y2="48" stroke={c} strokeWidth={w2} />
        <line x1="2" y1="14" x2="30" y2="32" stroke={c} strokeWidth={w2} />
      </svg>
    ),

    // ═══ RADIANT — octagonal with cut corners + brilliant (not step) facets ═══
    radiant: (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Outer — cut corners */}
        <polygon points="16,4 84,4 96,16 96,84 84,96 16,96 4,84 4,16" stroke={c} strokeWidth={w} fill="none" />
        {/* Table */}
        <polygon points="34,28 66,28 72,34 72,66 66,72 34,72 28,66 28,34" stroke={c} strokeWidth={w} fill="none" />
        {/* Corner lines */}
        <line x1="16" y1="4" x2="34" y2="28" stroke={c} strokeWidth={w2} />
        <line x1="84" y1="4" x2="66" y2="28" stroke={c} strokeWidth={w2} />
        <line x1="96" y1="16" x2="72" y2="34" stroke={c} strokeWidth={w2} />
        <line x1="96" y1="84" x2="72" y2="66" stroke={c} strokeWidth={w2} />
        <line x1="84" y1="96" x2="66" y2="72" stroke={c} strokeWidth={w2} />
        <line x1="16" y1="96" x2="34" y2="72" stroke={c} strokeWidth={w2} />
        <line x1="4" y1="84" x2="28" y2="66" stroke={c} strokeWidth={w2} />
        <line x1="4" y1="16" x2="28" y2="34" stroke={c} strokeWidth={w2} />
        {/* Brilliant cross from midpoints — key difference from Emerald */}
        <line x1="50" y1="4" x2="50" y2="28" stroke={c2} strokeWidth={w2} />
        <line x1="50" y1="96" x2="50" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="4" y1="50" x2="28" y2="50" stroke={c2} strokeWidth={w2} />
        <line x1="96" y1="50" x2="72" y2="50" stroke={c2} strokeWidth={w2} />
        {/* V-pattern from midpoints to table */}
        <line x1="50" y1="4" x2="34" y2="28" stroke={c2} strokeWidth={w2} />
        <line x1="50" y1="4" x2="66" y2="28" stroke={c2} strokeWidth={w2} />
        <line x1="50" y1="96" x2="34" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="50" y1="96" x2="66" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="4" y1="50" x2="28" y2="34" stroke={c2} strokeWidth={w2} />
        <line x1="4" y1="50" x2="28" y2="66" stroke={c2} strokeWidth={w2} />
        <line x1="96" y1="50" x2="72" y2="34" stroke={c2} strokeWidth={w2} />
        <line x1="96" y1="50" x2="72" y2="66" stroke={c2} strokeWidth={w2} />
      </svg>
    ),

    // ═══ MARQUISE — elongated pointed boat/eye, narrow body ═══
    marquise: (
      <svg width={size} height={size} viewBox="0 0 70 100">
        {/* Narrow elongated eye — very sharp points */}
        <path d="M35 2 C55 10, 68 30, 68 50 C68 70, 55 90, 35 98 C15 90, 2 70, 2 50 C2 30, 15 10, 35 2Z" stroke={c} strokeWidth={w} fill="none" />
        {/* Elongated table */}
        <path d="M35 20 C44 24, 50 36, 50 50 C50 64, 44 76, 35 80 C26 76, 20 64, 20 50 C20 36, 26 24, 35 20Z" stroke={c} strokeWidth={w} fill="none" />
        {/* Top point facets */}
        <line x1="35" y1="2" x2="28" y2="20" stroke={c} strokeWidth={w2} />
        <line x1="35" y1="2" x2="42" y2="20" stroke={c} strokeWidth={w2} />
        <line x1="35" y1="2" x2="35" y2="20" stroke={c2} strokeWidth={w2} />
        {/* Bottom point facets */}
        <line x1="35" y1="98" x2="28" y2="80" stroke={c} strokeWidth={w2} />
        <line x1="35" y1="98" x2="42" y2="80" stroke={c} strokeWidth={w2} />
        <line x1="35" y1="98" x2="35" y2="80" stroke={c2} strokeWidth={w2} />
        {/* Side kites */}
        <line x1="2" y1="50" x2="20" y2="42" stroke={c} strokeWidth={w2} />
        <line x1="2" y1="50" x2="20" y2="58" stroke={c} strokeWidth={w2} />
        <line x1="68" y1="50" x2="50" y2="42" stroke={c} strokeWidth={w2} />
        <line x1="68" y1="50" x2="50" y2="58" stroke={c} strokeWidth={w2} />
        {/* Diagonals */}
        <line x1="12" y1="22" x2="28" y2="20" stroke={c2} strokeWidth={w2} />
        <line x1="12" y1="22" x2="20" y2="42" stroke={c2} strokeWidth={w2} />
        <line x1="58" y1="22" x2="42" y2="20" stroke={c2} strokeWidth={w2} />
        <line x1="58" y1="22" x2="50" y2="42" stroke={c2} strokeWidth={w2} />
        <line x1="12" y1="78" x2="28" y2="80" stroke={c2} strokeWidth={w2} />
        <line x1="12" y1="78" x2="20" y2="58" stroke={c2} strokeWidth={w2} />
        <line x1="58" y1="78" x2="42" y2="80" stroke={c2} strokeWidth={w2} />
        <line x1="58" y1="78" x2="50" y2="58" stroke={c2} strokeWidth={w2} />
      </svg>
    ),

    // ═══ PEAR — teardrop: POINTED at TOP, ROUND at BOTTOM ═══
    pear: (
      <svg width={size} height={size} viewBox="0 0 80 100">
        {/* Teardrop — pointed top, rounded bottom */}
        <path d="M40 2 C18 16, 2 42, 2 62 C2 82, 18 98, 40 98 C62 98, 78 82, 78 62 C78 42, 62 16, 40 2Z" stroke={c} strokeWidth={w} fill="none" />
        {/* Table — offset toward bottom */}
        <path d="M40 24 C30 30, 22 44, 22 56 C22 68, 30 78, 40 78 C50 78, 58 68, 58 56 C58 44, 50 30, 40 24Z" stroke={c} strokeWidth={w} fill="none" />
        {/* Top point — sharp */}
        <line x1="40" y1="2" x2="34" y2="24" stroke={c} strokeWidth={w2} />
        <line x1="40" y1="2" x2="46" y2="24" stroke={c} strokeWidth={w2} />
        <line x1="40" y1="2" x2="40" y2="24" stroke={c2} strokeWidth={w2} />
        {/* Bottom — wide round */}
        <line x1="40" y1="98" x2="34" y2="78" stroke={c} strokeWidth={w2} />
        <line x1="40" y1="98" x2="46" y2="78" stroke={c} strokeWidth={w2} />
        <line x1="40" y1="98" x2="40" y2="78" stroke={c2} strokeWidth={w2} />
        {/* Side facets */}
        <line x1="2" y1="62" x2="22" y2="52" stroke={c} strokeWidth={w2} />
        <line x1="2" y1="62" x2="22" y2="68" stroke={c} strokeWidth={w2} />
        <line x1="78" y1="62" x2="58" y2="52" stroke={c} strokeWidth={w2} />
        <line x1="78" y1="62" x2="58" y2="68" stroke={c} strokeWidth={w2} />
        {/* Upper diagonals */}
        <line x1="14" y1="30" x2="34" y2="24" stroke={c2} strokeWidth={w2} />
        <line x1="14" y1="30" x2="22" y2="44" stroke={c2} strokeWidth={w2} />
        <line x1="66" y1="30" x2="46" y2="24" stroke={c2} strokeWidth={w2} />
        <line x1="66" y1="30" x2="58" y2="44" stroke={c2} strokeWidth={w2} />
        {/* Lower diagonals */}
        <line x1="8" y1="82" x2="22" y2="68" stroke={c2} strokeWidth={w2} />
        <line x1="8" y1="82" x2="34" y2="78" stroke={c2} strokeWidth={w2} />
        <line x1="72" y1="82" x2="58" y2="68" stroke={c2} strokeWidth={w2} />
        <line x1="72" y1="82" x2="46" y2="78" stroke={c2} strokeWidth={w2} />
      </svg>
    ),

    // ═══ HEART — heart shape with cleft, brilliant facets ═══
    heart: (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Heart outline */}
        <path d="M50 96 L4 42 C-2 26, 4 10, 20 8 C30 6, 42 12, 50 26 C58 12, 70 6, 80 8 C96 10, 102 26, 96 42 Z" stroke={c} strokeWidth={w} fill="none" />
        {/* Inner table heart */}
        <path d="M50 72 L22 44 C18 36, 22 26, 30 24 C36 22, 44 26, 50 36 C56 26, 64 22, 70 24 C78 26, 82 36, 78 44 Z" stroke={c} strokeWidth={w} fill="none" />
        {/* Cleft line */}
        <line x1="50" y1="26" x2="50" y2="12" stroke={c} strokeWidth={w} />
        {/* Lobe crown facets */}
        <line x1="20" y1="8" x2="30" y2="24" stroke={c} strokeWidth={w2} />
        <line x1="80" y1="8" x2="70" y2="24" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="12" x2="30" y2="24" stroke={c2} strokeWidth={w2} />
        <line x1="50" y1="12" x2="70" y2="24" stroke={c2} strokeWidth={w2} />
        {/* Side kites */}
        <line x1="4" y1="42" x2="22" y2="44" stroke={c} strokeWidth={w2} />
        <line x1="96" y1="42" x2="78" y2="44" stroke={c} strokeWidth={w2} />
        <line x1="4" y1="42" x2="22" y2="36" stroke={c2} strokeWidth={w2} />
        <line x1="96" y1="42" x2="78" y2="36" stroke={c2} strokeWidth={w2} />
        {/* Bottom point */}
        <line x1="50" y1="96" x2="50" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="50" y1="96" x2="22" y2="50" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="96" x2="78" y2="50" stroke={c} strokeWidth={w2} />
        {/* Lower side facets */}
        <line x1="14" y1="62" x2="22" y2="44" stroke={c2} strokeWidth={w2} />
        <line x1="86" y1="62" x2="78" y2="44" stroke={c2} strokeWidth={w2} />
        <line x1="14" y1="62" x2="50" y2="72" stroke={c2} strokeWidth={w2} />
        <line x1="86" y1="62" x2="50" y2="72" stroke={c2} strokeWidth={w2} />
      </svg>
    ),

    // ═══ ASSCHER — SQUARE step cut (4 concentric octagons + corner lines) ═══
    asscher: (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Outer octagonal — larger cut corners than radiant */}
        <polygon points="22,4 78,4 96,22 96,78 78,96 22,96 4,78 4,22" stroke={c} strokeWidth={w} fill="none" />
        {/* Step 1 */}
        <polygon points="28,14 72,14 86,28 86,72 72,86 28,86 14,72 14,28" stroke={c2} strokeWidth={w2} fill="none" />
        {/* Step 2 */}
        <polygon points="34,24 66,24 76,34 76,66 66,76 34,76 24,66 24,34" stroke={c2} strokeWidth={w2} fill="none" />
        {/* Table — innermost */}
        <polygon points="40,34 60,34 66,40 66,60 60,66 40,66 34,60 34,40" stroke={c} strokeWidth={w} fill="none" />
        {/* Corner lines through all steps */}
        <line x1="22" y1="4" x2="40" y2="34" stroke={c} strokeWidth={w2} />
        <line x1="78" y1="4" x2="60" y2="34" stroke={c} strokeWidth={w2} />
        <line x1="96" y1="22" x2="66" y2="40" stroke={c} strokeWidth={w2} />
        <line x1="96" y1="78" x2="66" y2="60" stroke={c} strokeWidth={w2} />
        <line x1="78" y1="96" x2="60" y2="66" stroke={c} strokeWidth={w2} />
        <line x1="22" y1="96" x2="40" y2="66" stroke={c} strokeWidth={w2} />
        <line x1="4" y1="78" x2="34" y2="60" stroke={c} strokeWidth={w2} />
        <line x1="4" y1="22" x2="34" y2="40" stroke={c} strokeWidth={w2} />
      </svg>
    ),

    // ═══ TRILLION — triangular brilliant with curved sides ═══
    trillion: (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Triangle with slightly curved sides */}
        <path d="M50 4 C52 4, 96 82, 92 90 C90 94, 86 96, 82 96 L18 96 C14 96, 10 94, 8 90 C4 82, 48 4, 50 4Z" stroke={c} strokeWidth={w} fill="none" />
        {/* Table triangle */}
        <polygon points="50,30 72,74 28,74" stroke={c} strokeWidth={w} fill="none" />
        {/* Top vertex */}
        <line x1="50" y1="4" x2="50" y2="30" stroke={c} strokeWidth={w2} />
        <line x1="50" y1="4" x2="38" y2="30" stroke={c2} strokeWidth={w2} />
        <line x1="50" y1="4" x2="62" y2="30" stroke={c2} strokeWidth={w2} />
        {/* Bottom-left vertex */}
        <line x1="8" y1="90" x2="28" y2="74" stroke={c} strokeWidth={w2} />
        <line x1="8" y1="90" x2="40" y2="74" stroke={c2} strokeWidth={w2} />
        <line x1="8" y1="90" x2="28" y2="58" stroke={c2} strokeWidth={w2} />
        {/* Bottom-right vertex */}
        <line x1="92" y1="90" x2="72" y2="74" stroke={c} strokeWidth={w2} />
        <line x1="92" y1="90" x2="60" y2="74" stroke={c2} strokeWidth={w2} />
        <line x1="92" y1="90" x2="72" y2="58" stroke={c2} strokeWidth={w2} />
        {/* Side facets */}
        <line x1="24" y1="42" x2="38" y2="30" stroke={c2} strokeWidth={w2} />
        <line x1="24" y1="42" x2="28" y2="58" stroke={c2} strokeWidth={w2} />
        <line x1="76" y1="42" x2="62" y2="30" stroke={c2} strokeWidth={w2} />
        <line x1="76" y1="42" x2="72" y2="58" stroke={c2} strokeWidth={w2} />
        {/* Bottom facets */}
        <line x1="20" y1="96" x2="50" y2="74" stroke={c2} strokeWidth={w2} />
        <line x1="80" y1="96" x2="50" y2="74" stroke={c2} strokeWidth={w2} />
      </svg>
    ),
  }

  return shapes[shape] || shapes.round
}

export default ShapeSVG
