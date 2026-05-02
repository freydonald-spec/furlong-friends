import * as React from 'react'

export type AvatarCategory =
  | 'racing'
  | 'fashion'
  | 'drinks'
  | 'flora'
  | 'lifestyle'
  | 'fun'
  | 'sports'
  | 'party'
  | 'animal'
  | 'nature'

export type Avatar = {
  id: string
  label: string
  category: AvatarCategory
  /** Inner SVG markup — wrapped at render time in `<svg viewBox="0 0 60 60">`. */
  svg: string
}

// Keeping all SVGs on a 60x60 viewBox. Each starts with a colored backdrop rect so
// the avatars look like polished tokens and stay distinct at thumbnail size.

export const AVATARS: Avatar[] = [
  // ─── HORSES & RACING (1–4) ──────────────────────────────────────────────
  {
    id: 'avatar_01',
    label: 'Chestnut Racer',
    category: 'racing',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<rect x="0" y="48" width="60" height="12" fill="#5a3520"/>
<g fill="#7c4a2c" stroke="#3a2010" stroke-width="0.5">
  <ellipse cx="30" cy="34" rx="17" ry="7"/>
  <path d="M44 30 L53 17 L57 22 L48 35 Z"/>
  <ellipse cx="52" cy="20" rx="5" ry="4"/>
</g>
<path d="M43 25 L52 19 L49 32 Z" fill="#3a2010"/>
<g fill="#7c4a2c" stroke="#3a2010" stroke-width="0.5">
  <path d="M40 38 L52 51 L49 53 L36 40 Z"/>
  <path d="M33 38 L46 51 L43 53 L30 40 Z"/>
  <path d="M22 38 L10 51 L13 53 L26 40 Z"/>
  <path d="M28 38 L16 51 L19 53 L32 40 Z"/>
</g>
<path d="M13 32 Q3 34 6 43 L14 36 Z" fill="#3a2010"/>
<circle cx="53" cy="19" r="0.9" fill="#fff"/>
<circle cx="55" cy="22" r="0.6" fill="#1a1a1a"/>`,
  },
  {
    id: 'avatar_02',
    label: 'Grey Mount',
    category: 'racing',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<rect x="0" y="50" width="60" height="10" fill="#5a3520"/>
<g fill="#a3a8b1" stroke="#6b7280" stroke-width="0.4">
  <ellipse cx="28" cy="42" rx="17" ry="7"/>
  <path d="M40 40 L49 30 L53 33 L45 44 Z"/>
  <ellipse cx="50" cy="32" rx="4.5" ry="3.5"/>
  <rect x="13" y="47" width="3" height="11" rx="1"/>
  <rect x="21" y="47" width="3" height="11" rx="1"/>
  <rect x="33" y="47" width="3" height="11" rx="1"/>
  <rect x="41" y="47" width="3" height="11" rx="1"/>
</g>
<path d="M40 36 L48 32 L46 41 Z" fill="#fff"/>
<path d="M13 40 Q4 42 6 49 L14 44 Z" fill="#fff"/>
<path d="M22 28 L36 28 L34 38 L24 38 Z" fill="#8B1A2F"/>
<rect x="22" y="31" width="14" height="2" fill="#C9A84C"/>
<path d="M22 22 Q22 14 29 14 Q36 14 36 22 L36 26 L22 26 Z" fill="#8B1A2F"/>
<rect x="22" y="22" width="14" height="2" fill="#C9A84C"/>
<rect x="23" y="23" width="12" height="2" fill="#1a1a1a"/>
<rect x="26" y="25.5" width="6" height="3" fill="#f5d0a9"/>
<circle cx="51" cy="31" r="0.6" fill="#1a1a1a"/>`,
  },
  {
    id: 'avatar_03',
    label: 'Black Stallion',
    category: 'racing',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<rect x="0" y="50" width="60" height="10" fill="#5a3520"/>
<g fill="#1a1a1a" stroke="#000" stroke-width="0.4">
  <ellipse cx="30" cy="36" rx="9" ry="14"/>
  <path d="M30 18 L38 6 L42 10 L34 22 Z"/>
  <ellipse cx="40" cy="9" rx="5" ry="4" transform="rotate(-15 40 9)"/>
</g>
<path d="M30 20 L40 8 L36 22 Z" fill="#3a3a3a"/>
<path d="M28 22 L24 6 L21 22 Z" fill="#3a3a3a"/>
<path d="M22 30 L10 22 L11 20 L24 28 Z" fill="#1a1a1a"/>
<path d="M22 36 L8 30 L9 28 L24 34 Z" fill="#1a1a1a"/>
<rect x="25" y="46" width="4" height="12" rx="1.5" fill="#1a1a1a"/>
<rect x="32" y="46" width="4" height="12" rx="1.5" fill="#1a1a1a"/>
<path d="M37 46 Q44 50 42 56 L36 50 Z" fill="#3a3a3a"/>
<circle cx="42" cy="9" r="0.8" fill="#fff"/>
<circle cx="43" cy="11" r="0.5" fill="#000"/>`,
  },
  {
    id: 'avatar_04',
    label: 'Garland Winner',
    category: 'racing',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<rect x="0" y="50" width="60" height="10" fill="#5a3520"/>
<g fill="#a47148" stroke="#5a3520" stroke-width="0.4">
  <ellipse cx="28" cy="40" rx="17" ry="7"/>
  <path d="M40 38 L48 26 L52 30 L44 41 Z"/>
  <ellipse cx="49" cy="28" rx="5" ry="4"/>
  <rect x="13" y="46" width="3" height="11" rx="1"/>
  <rect x="21" y="46" width="3" height="11" rx="1"/>
  <rect x="33" y="46" width="3" height="11" rx="1"/>
  <rect x="41" y="46" width="3" height="11" rx="1"/>
</g>
<path d="M40 33 L48 28 L46 38 Z" fill="#3a2010"/>
<path d="M13 38 Q5 40 7 47 L14 42 Z" fill="#3a2010"/>
<g fill="#dc2626">
  <circle cx="36" cy="38" r="3"/>
  <circle cx="32" cy="40" r="3"/>
  <circle cx="28" cy="40" r="3"/>
  <circle cx="24" cy="40" r="3"/>
  <circle cx="20" cy="38" r="3"/>
  <circle cx="40" cy="35" r="2.5"/>
</g>
<g fill="#16a34a">
  <ellipse cx="34" cy="35" rx="2" ry="1" transform="rotate(20 34 35)"/>
  <ellipse cx="22" cy="36" rx="2" ry="1" transform="rotate(-20 22 36)"/>
</g>
<circle cx="50" cy="27" r="0.7" fill="#fff"/>
<circle cx="51" cy="30" r="0.4" fill="#1a1a1a"/>`,
  },

  // ─── JOCKEYS (5–8) ──────────────────────────────────────────────────────
  {
    id: 'avatar_05',
    label: 'Jockey · Red & White',
    category: 'racing',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<path d="M16 56 L20 36 L40 36 L44 56 Z" fill="#dc2626"/>
<rect x="20" y="36" width="4" height="20" fill="#fff"/>
<rect x="28" y="36" width="4" height="20" fill="#fff"/>
<rect x="36" y="36" width="4" height="20" fill="#fff"/>
<path d="M30 8 Q18 8 18 22 L18 30 L42 30 L42 22 Q42 8 30 8 Z" fill="#dc2626"/>
<rect x="18" y="22" width="24" height="4" fill="#fff"/>
<rect x="20" y="25" width="20" height="4" rx="1" fill="#1a1a1a"/>
<circle cx="25" cy="27" r="2" fill="#fff"/>
<circle cx="35" cy="27" r="2" fill="#fff"/>
<circle cx="25" cy="27" r="0.8" fill="#1a1a1a"/>
<circle cx="35" cy="27" r="0.8" fill="#1a1a1a"/>
<path d="M22 30 Q22 36 30 36 Q38 36 38 30 Z" fill="#f5d0a9"/>
<path d="M28 32 L32 32 L30 35 Z" fill="#d97706"/>`,
  },
  {
    id: 'avatar_06',
    label: 'Jockey · Blue & Gold',
    category: 'racing',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<path d="M16 56 L20 36 L40 36 L44 56 Z" fill="#1e3a8a"/>
<polygon points="30,38 33,44 39,45 34,49 36,55 30,52 24,55 26,49 21,45 27,44" fill="#C9A84C"/>
<path d="M30 8 Q18 8 18 22 L18 30 L42 30 L42 22 Q42 8 30 8 Z" fill="#1e3a8a"/>
<polygon points="30,11 32,17 38,17 33,21 35,27 30,23 25,27 27,21 22,17 28,17" fill="#C9A84C"/>
<rect x="20" y="25" width="20" height="4" rx="1" fill="#1a1a1a"/>
<circle cx="25" cy="27" r="2" fill="#fff"/>
<circle cx="35" cy="27" r="2" fill="#fff"/>
<circle cx="25" cy="27" r="0.8" fill="#1a1a1a"/>
<circle cx="35" cy="27" r="0.8" fill="#1a1a1a"/>
<path d="M22 30 Q22 36 30 36 Q38 36 38 30 Z" fill="#f5d0a9"/>
<path d="M28 32 L32 32 L30 35 Z" fill="#d97706"/>`,
  },
  {
    id: 'avatar_07',
    label: 'Jockey · Green',
    category: 'racing',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<path d="M16 56 L20 36 L40 36 L44 56 Z" fill="#16a34a"/>
<polygon points="22,42 26,40 30,42 26,44" fill="#fff"/>
<polygon points="34,46 38,44 42,46 38,48" fill="#fff"/>
<polygon points="22,52 26,50 30,52 26,54" fill="#fff"/>
<path d="M30 8 Q18 8 18 22 L18 30 L42 30 L42 22 Q42 8 30 8 Z" fill="#16a34a"/>
<polygon points="22,16 26,14 30,16 26,18" fill="#fff"/>
<polygon points="32,20 36,18 40,20 36,22" fill="#fff"/>
<rect x="20" y="25" width="20" height="4" rx="1" fill="#1a1a1a"/>
<circle cx="25" cy="27" r="2" fill="#fff"/>
<circle cx="35" cy="27" r="2" fill="#fff"/>
<circle cx="25" cy="27" r="0.8" fill="#1a1a1a"/>
<circle cx="35" cy="27" r="0.8" fill="#1a1a1a"/>
<path d="M22 30 Q22 36 30 36 Q38 36 38 30 Z" fill="#f5d0a9"/>
<path d="M28 32 L32 32 L30 35 Z" fill="#d97706"/>`,
  },
  {
    id: 'avatar_08',
    label: 'Jockey · Purple',
    category: 'racing',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<path d="M16 56 L20 36 L40 36 L44 56 Z" fill="#7c3aed"/>
<path d="M16 38 L20 38 L24 42 L20 46 L16 42 Z M44 38 L40 38 L36 42 L40 46 L44 42 Z M16 50 L20 50 L24 54 L20 56 L16 52 Z" fill="#fbbf24"/>
<path d="M30 8 Q18 8 18 22 L18 30 L42 30 L42 22 Q42 8 30 8 Z" fill="#7c3aed"/>
<path d="M18 14 L22 14 L26 18 L22 22 L18 18 Z M42 14 L38 14 L34 18 L38 22 L42 18 Z" fill="#fbbf24"/>
<rect x="20" y="25" width="20" height="4" rx="1" fill="#1a1a1a"/>
<circle cx="25" cy="27" r="2" fill="#fff"/>
<circle cx="35" cy="27" r="2" fill="#fff"/>
<circle cx="25" cy="27" r="0.8" fill="#1a1a1a"/>
<circle cx="35" cy="27" r="0.8" fill="#1a1a1a"/>
<path d="M22 30 Q22 36 30 36 Q38 36 38 30 Z" fill="#f5d0a9"/>
<path d="M28 32 L32 32 L30 35 Z" fill="#d97706"/>`,
  },

  // ─── DERBY FASHION (9–16) ────────────────────────────────────────────────
  {
    id: 'avatar_09',
    label: 'Pink Derby Hat',
    category: 'fashion',
    svg: `<rect width="60" height="60" rx="8" fill="#fce7f3"/>
<ellipse cx="30" cy="40" rx="26" ry="7" fill="#ec4899"/>
<ellipse cx="30" cy="38" rx="26" ry="6" fill="#f472b6"/>
<path d="M14 36 Q20 22 30 22 Q40 22 46 36 Z" fill="#ec4899"/>
<path d="M14 36 Q20 22 30 22 Q40 22 46 36" fill="none" stroke="#be185d" stroke-width="1"/>
<rect x="14" y="35" width="32" height="3" fill="#be185d"/>
<g fill="#fff">
  <circle cx="22" cy="22" r="3"/>
  <circle cx="30" cy="18" r="3.5"/>
  <circle cx="38" cy="22" r="3"/>
</g>
<g fill="#fbbf24">
  <circle cx="22" cy="22" r="1"/>
  <circle cx="30" cy="18" r="1.2"/>
  <circle cx="38" cy="22" r="1"/>
</g>
<g fill="#16a34a">
  <ellipse cx="26" cy="26" rx="2" ry="1" transform="rotate(-30 26 26)"/>
  <ellipse cx="34" cy="26" rx="2" ry="1" transform="rotate(30 34 26)"/>
</g>`,
  },
  {
    id: 'avatar_10',
    label: 'Blue Fascinator',
    category: 'fashion',
    svg: `<rect width="60" height="60" rx="8" fill="#fce7f3"/>
<ellipse cx="30" cy="44" rx="14" ry="3" fill="#1e3a8a"/>
<path d="M22 44 Q22 30 30 30 Q38 30 38 44 Z" fill="#1e3a8a"/>
<path d="M22 44 Q22 30 30 30 Q38 30 38 44" fill="none" stroke="#1e2a5e" stroke-width="0.6"/>
<rect x="22" y="40" width="16" height="3" fill="#C9A84C"/>
<g fill="#1e3a8a">
  <path d="M30 30 Q22 14 18 12 Q22 16 24 26 Z"/>
  <path d="M30 30 Q34 14 38 10 Q36 18 32 26 Z"/>
  <path d="M30 30 Q40 18 46 18 Q40 22 34 28 Z"/>
</g>
<g fill="#fff">
  <ellipse cx="22" cy="20" rx="1.5" ry="3" transform="rotate(-25 22 20)"/>
  <ellipse cx="38" cy="18" rx="1.5" ry="3" transform="rotate(20 38 18)"/>
</g>
<circle cx="32" cy="34" r="2" fill="#C9A84C"/>
<circle cx="32" cy="34" r="1" fill="#fef3c7"/>`,
  },
  {
    id: 'avatar_11',
    label: 'Blue Seersucker Suit',
    category: 'fashion',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<path d="M14 18 L24 14 L36 14 L46 18 L46 56 L14 56 Z" fill="#bfdbfe"/>
<g stroke="#1e40af" stroke-width="0.7">
  <line x1="18" y1="20" x2="18" y2="56"/>
  <line x1="22" y1="18" x2="22" y2="56"/>
  <line x1="26" y1="16" x2="26" y2="56"/>
  <line x1="34" y1="16" x2="34" y2="56"/>
  <line x1="38" y1="18" x2="38" y2="56"/>
  <line x1="42" y1="20" x2="42" y2="56"/>
</g>
<path d="M24 14 L30 26 L36 14 L36 22 L30 28 L24 22 Z" fill="#fef3c7"/>
<path d="M28 16 L30 30 L32 16 Z" fill="#1e3a8a"/>
<polygon points="26,24 34,24 32,28 28,28" fill="#dc2626"/>
<circle cx="30" cy="36" r="1" fill="#1e40af"/>
<circle cx="30" cy="44" r="1" fill="#1e40af"/>
<circle cx="30" cy="52" r="1" fill="#1e40af"/>
<rect x="40" y="38" width="4" height="8" fill="#1e3a8a"/>`,
  },
  {
    id: 'avatar_12',
    label: 'Patterned Bow Tie',
    category: 'fashion',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<path d="M30 30 L8 18 L8 42 L30 30 Z" fill="#8B1A2F"/>
<path d="M30 30 L52 18 L52 42 L30 30 Z" fill="#8B1A2F"/>
<rect x="26" y="24" width="8" height="12" rx="1" fill="#5a0f1d"/>
<g fill="#C9A84C">
  <circle cx="14" cy="24" r="1.5"/>
  <circle cx="20" cy="30" r="1.5"/>
  <circle cx="14" cy="36" r="1.5"/>
  <circle cx="46" cy="24" r="1.5"/>
  <circle cx="40" cy="30" r="1.5"/>
  <circle cx="46" cy="36" r="1.5"/>
</g>
<g fill="#fff">
  <circle cx="20" cy="22" r="0.8"/>
  <circle cx="14" cy="30" r="0.8"/>
  <circle cx="20" cy="38" r="0.8"/>
  <circle cx="40" cy="22" r="0.8"/>
  <circle cx="46" cy="30" r="0.8"/>
  <circle cx="40" cy="38" r="0.8"/>
</g>
<line x1="30" y1="6" x2="30" y2="22" stroke="#1a1a1a" stroke-width="2"/>
<line x1="22" y1="48" x2="38" y2="48" stroke="#1a1a1a" stroke-width="2"/>`,
  },
  {
    id: 'avatar_13',
    label: 'Pink Seersucker Suit',
    category: 'fashion',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<path d="M14 18 L24 14 L36 14 L46 18 L46 56 L14 56 Z" fill="#fbcfe8"/>
<g stroke="#be185d" stroke-width="0.7">
  <line x1="18" y1="20" x2="18" y2="56"/>
  <line x1="22" y1="18" x2="22" y2="56"/>
  <line x1="26" y1="16" x2="26" y2="56"/>
  <line x1="34" y1="16" x2="34" y2="56"/>
  <line x1="38" y1="18" x2="38" y2="56"/>
  <line x1="42" y1="20" x2="42" y2="56"/>
</g>
<path d="M24 14 L30 26 L36 14 L36 22 L30 28 L24 22 Z" fill="#fef3c7"/>
<path d="M28 16 L30 30 L32 16 Z" fill="#16a34a"/>
<polygon points="26,24 34,24 32,28 28,28" fill="#1e3a8a"/>
<circle cx="30" cy="36" r="1" fill="#be185d"/>
<circle cx="30" cy="44" r="1" fill="#be185d"/>
<circle cx="30" cy="52" r="1" fill="#be185d"/>
<g fill="#fff">
  <circle cx="42" cy="40" r="2"/>
  <circle cx="42" cy="40" r="1" fill="#fbbf24"/>
</g>`,
  },
  {
    id: 'avatar_14',
    label: 'Top Hat & Monocle',
    category: 'fashion',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<ellipse cx="30" cy="32" rx="20" ry="3" fill="#1a1a1a"/>
<rect x="16" y="10" width="28" height="22" fill="#1a1a1a"/>
<rect x="16" y="10" width="28" height="22" fill="none" stroke="#000" stroke-width="0.5"/>
<rect x="16" y="22" width="28" height="4" fill="#8B1A2F"/>
<rect x="16" y="22" width="28" height="4" fill="none" stroke="#5a0f1d" stroke-width="0.5"/>
<polygon points="20,26 24,22 22,26" fill="#C9A84C"/>
<path d="M22 38 Q22 50 30 50 Q38 50 38 38 Z" fill="#f5d0a9"/>
<circle cx="36" cy="42" r="5" fill="none" stroke="#1a1a1a" stroke-width="1.4"/>
<circle cx="36" cy="42" r="4" fill="#dbeafe" opacity="0.6"/>
<circle cx="36" cy="42" r="1" fill="#1a1a1a"/>
<line x1="40" y1="46" x2="44" y2="56" stroke="#1a1a1a" stroke-width="1"/>
<path d="M24 44 Q26 46 28 44" fill="none" stroke="#1a1a1a" stroke-width="0.8"/>
<path d="M26 48 Q30 52 34 48" fill="none" stroke="#1a1a1a" stroke-width="1"/>
<path d="M34 18 Q42 14 50 18" fill="none" stroke="#3a2010" stroke-width="2"/>`,
  },
  {
    id: 'avatar_15',
    label: 'Suspenders & Pocket Watch',
    category: 'fashion',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<rect x="14" y="14" width="32" height="42" fill="#fff"/>
<rect x="14" y="14" width="32" height="42" fill="none" stroke="#d6d3d1" stroke-width="0.5"/>
<g fill="#8B1A2F">
  <path d="M18 14 L42 56 L46 56 L22 14 Z"/>
  <path d="M42 14 L18 56 L22 56 L46 14 Z"/>
</g>
<rect x="26" y="14" width="8" height="4" fill="#1a1a1a"/>
<g>
  <circle cx="42" cy="32" r="6" fill="#C9A84C" stroke="#a87f1c" stroke-width="0.8"/>
  <circle cx="42" cy="32" r="4.5" fill="#fef3c7"/>
  <line x1="42" y1="32" x2="42" y2="29" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="42" y1="32" x2="44" y2="32" stroke="#1a1a1a" stroke-width="1"/>
  <circle cx="42" cy="32" r="0.6" fill="#1a1a1a"/>
  <line x1="42" y1="26" x2="42" y2="20" stroke="#C9A84C" stroke-width="1.2"/>
  <line x1="42" y1="20" x2="38" y2="18" stroke="#C9A84C" stroke-width="1.2"/>
  <rect x="36" y="16" width="4" height="3" fill="#C9A84C"/>
</g>
<g fill="#1a1a1a">
  <circle cx="22" cy="22" r="1"/>
  <circle cx="22" cy="32" r="1"/>
  <circle cx="22" cy="42" r="1"/>
</g>`,
  },
  {
    id: 'avatar_16',
    label: 'Gloves & Pearls',
    category: 'fashion',
    svg: `<rect width="60" height="60" rx="8" fill="#fce7f3"/>
<g fill="#fff" stroke="#9ca3af" stroke-width="0.6">
  <path d="M10 28 L18 24 L22 30 L28 26 L26 36 L20 50 L10 50 Z"/>
  <path d="M50 28 L42 24 L38 30 L32 26 L34 36 L40 50 L50 50 Z"/>
</g>
<g stroke="#fef3c7" stroke-width="0.5" fill="none">
  <line x1="14" y1="32" x2="20" y2="40"/>
  <line x1="46" y1="32" x2="40" y2="40"/>
</g>
<g fill="#fef3c7" stroke="#d4d4d8" stroke-width="0.4">
  <circle cx="18" cy="14" r="2"/>
  <circle cx="24" cy="11" r="2.2"/>
  <circle cx="30" cy="10" r="2.4"/>
  <circle cx="36" cy="11" r="2.2"/>
  <circle cx="42" cy="14" r="2"/>
</g>
<g fill="#fff" opacity="0.6">
  <circle cx="17.5" cy="13.5" r="0.6"/>
  <circle cx="23.5" cy="10.5" r="0.6"/>
  <circle cx="29.5" cy="9.5" r="0.7"/>
  <circle cx="35.5" cy="10.5" r="0.6"/>
  <circle cx="41.5" cy="13.5" r="0.6"/>
</g>
<path d="M18 14 Q30 22 42 14" stroke="#fef3c7" stroke-width="0.6" fill="none"/>`,
  },

  // ─── DRINKS (17–22) ──────────────────────────────────────────────────────
  {
    id: 'avatar_17',
    label: 'Mint Julep',
    category: 'drinks',
    svg: `<rect width="60" height="60" rx="8" fill="#3a2010"/>
<path d="M18 22 L42 22 L40 52 Q40 56 36 56 L24 56 Q20 56 20 52 Z" fill="#d4d4d8"/>
<path d="M18 22 L42 22 L40 52 Q40 56 36 56 L24 56 Q20 56 20 52 Z" fill="none" stroke="#a8a29e" stroke-width="0.8"/>
<path d="M22 26 L38 26 L36 30 L24 30 Z" fill="#fff" opacity="0.4"/>
<rect x="20" y="20" width="22" height="3" rx="1.5" fill="#a8a29e"/>
<g fill="#16a34a">
  <ellipse cx="28" cy="14" rx="3" ry="5" transform="rotate(-30 28 14)"/>
  <ellipse cx="32" cy="12" rx="3" ry="5"/>
  <ellipse cx="36" cy="14" rx="3" ry="5" transform="rotate(30 36 14)"/>
</g>
<g stroke="#15803d" stroke-width="0.4" fill="none">
  <line x1="28" y1="14" x2="29" y2="20"/>
  <line x1="32" y1="12" x2="32" y2="20"/>
  <line x1="36" y1="14" x2="35" y2="20"/>
</g>
<rect x="38" y="10" width="2" height="34" rx="1" fill="#fbbf24"/>
<circle cx="39" cy="9" r="2" fill="#fbbf24"/>`,
  },
  {
    id: 'avatar_18',
    label: 'Bourbon Neat',
    category: 'drinks',
    svg: `<rect width="60" height="60" rx="8" fill="#3a2010"/>
<path d="M16 24 L44 24 L42 54 L18 54 Z" fill="#fef3c7" opacity="0.25"/>
<path d="M16 24 L44 24 L42 54 L18 54 Z" fill="none" stroke="#fef3c7" stroke-width="1.2"/>
<path d="M17 38 L43 38 L42 54 L18 54 Z" fill="#a16207"/>
<path d="M17 38 L43 38 L41 42 L19 42 Z" fill="#d97706" opacity="0.7"/>
<g fill="#dbeafe" opacity="0.85" stroke="#fff" stroke-width="0.4">
  <rect x="22" y="42" width="6" height="6" rx="1"/>
  <rect x="32" y="44" width="6" height="6" rx="1"/>
  <rect x="26" y="48" width="6" height="6" rx="1"/>
</g>
<path d="M18 30 Q22 26 26 30" stroke="#fff" stroke-width="0.6" fill="none" opacity="0.6"/>`,
  },
  {
    id: 'avatar_19',
    label: 'Champagne Flute',
    category: 'drinks',
    svg: `<rect width="60" height="60" rx="8" fill="#3a2010"/>
<path d="M22 8 L38 8 L36 30 Q36 38 30 40 Q24 38 24 30 Z" fill="#fef3c7" opacity="0.3"/>
<path d="M22 8 L38 8 L36 30 Q36 38 30 40 Q24 38 24 30 Z" fill="none" stroke="#fef3c7" stroke-width="1"/>
<path d="M24 18 L36 18 L35 30 Q35 36 30 38 Q25 36 25 30 Z" fill="#fbbf24" opacity="0.8"/>
<g fill="#fff">
  <circle cx="28" cy="22" r="0.8"/>
  <circle cx="32" cy="20" r="0.6"/>
  <circle cx="30" cy="26" r="0.7"/>
  <circle cx="33" cy="28" r="0.5"/>
  <circle cx="27" cy="30" r="0.6"/>
  <circle cx="31" cy="14" r="0.4"/>
  <circle cx="29" cy="11" r="0.4"/>
</g>
<rect x="29" y="40" width="2" height="14" fill="#fef3c7" opacity="0.5"/>
<rect x="29" y="40" width="2" height="14" fill="none" stroke="#fef3c7" stroke-width="0.6"/>
<ellipse cx="30" cy="55" rx="10" ry="2" fill="#fef3c7" opacity="0.4"/>
<ellipse cx="30" cy="55" rx="10" ry="2" fill="none" stroke="#fef3c7" stroke-width="0.8"/>`,
  },
  {
    id: 'avatar_20',
    label: 'Bourbon Bottle',
    category: 'drinks',
    svg: `<rect width="60" height="60" rx="8" fill="#3a2010"/>
<rect x="26" y="6" width="8" height="10" rx="1" fill="#1a1a1a"/>
<rect x="24" y="15" width="12" height="4" rx="1" fill="#1a1a1a"/>
<path d="M22 19 L38 19 L40 26 L40 56 L20 56 L20 26 Z" fill="#a16207"/>
<path d="M22 19 L38 19 L40 26 L40 56 L20 56 L20 26 Z" fill="none" stroke="#5a3520" stroke-width="0.8"/>
<rect x="22" y="32" width="16" height="18" rx="1" fill="#fef3c7"/>
<rect x="22" y="32" width="16" height="18" rx="1" fill="none" stroke="#5a3520" stroke-width="0.5"/>
<text x="30" y="42" font-size="6" font-family="serif" font-weight="bold" fill="#8B1A2F" text-anchor="middle">DERBY</text>
<text x="30" y="48" font-size="4" font-family="serif" fill="#5a0f1d" text-anchor="middle">BOURBON</text>
<rect x="22" y="22" width="16" height="2" fill="#C9A84C"/>
<path d="M22 22 L38 22" stroke="#fef3c7" stroke-width="0.4" opacity="0.7"/>`,
  },
  {
    id: 'avatar_21',
    label: 'Sweet Tea',
    category: 'drinks',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<rect x="16" y="16" width="28" height="40" rx="2" fill="#fef3c7" opacity="0.4"/>
<rect x="16" y="16" width="28" height="40" rx="2" fill="none" stroke="#a8a29e" stroke-width="1"/>
<rect x="14" y="14" width="32" height="6" rx="2" fill="#a8a29e"/>
<rect x="14" y="14" width="32" height="6" rx="2" fill="none" stroke="#78716c" stroke-width="0.6"/>
<path d="M18 28 L42 28 L41 54 L19 54 Z" fill="#a16207"/>
<g fill="#dbeafe" stroke="#fff" stroke-width="0.4">
  <rect x="22" y="30" width="5" height="5" rx="0.8"/>
  <rect x="32" y="32" width="5" height="5" rx="0.8"/>
  <rect x="26" y="38" width="5" height="5" rx="0.8"/>
</g>
<g fill="#facc15" stroke="#ca8a04" stroke-width="0.5">
  <ellipse cx="40" cy="26" rx="6" ry="3"/>
</g>
<g stroke="#ca8a04" stroke-width="0.4">
  <line x1="35" y1="26" x2="45" y2="26"/>
  <line x1="40" y1="23" x2="40" y2="29"/>
</g>
<rect x="34" y="10" width="1.5" height="22" rx="0.5" fill="#16a34a"/>`,
  },
  {
    id: 'avatar_22',
    label: 'Cocktail Shaker',
    category: 'drinks',
    svg: `<rect width="60" height="60" rx="8" fill="#3a2010"/>
<path d="M22 56 L20 24 L40 24 L38 56 Z" fill="#d4d4d8"/>
<path d="M22 56 L20 24 L40 24 L38 56 Z" fill="none" stroke="#a8a29e" stroke-width="0.8"/>
<path d="M24 28 L36 28 L34 36 L26 36 Z" fill="#fff" opacity="0.4"/>
<rect x="18" y="20" width="24" height="6" rx="2" fill="#a8a29e"/>
<rect x="18" y="20" width="24" height="6" rx="2" fill="none" stroke="#78716c" stroke-width="0.6"/>
<rect x="22" y="14" width="16" height="8" rx="2" fill="#d4d4d8"/>
<rect x="22" y="14" width="16" height="8" rx="2" fill="none" stroke="#78716c" stroke-width="0.6"/>
<ellipse cx="30" cy="12" rx="6" ry="2" fill="#a8a29e"/>
<g stroke="#fff" stroke-width="0.4" opacity="0.5">
  <line x1="24" y1="40" x2="36" y2="40"/>
  <line x1="24" y1="46" x2="36" y2="46"/>
  <line x1="25" y1="52" x2="35" y2="52"/>
</g>`,
  },

  // ─── FLORA & CEREMONY (23–28) ────────────────────────────────────────────
  {
    id: 'avatar_23',
    label: 'Red Rose Bouquet',
    category: 'flora',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<g fill="#dc2626" stroke="#7f1d1d" stroke-width="0.4">
  <circle cx="22" cy="22" r="6"/>
  <circle cx="38" cy="22" r="6"/>
  <circle cx="30" cy="14" r="6"/>
  <circle cx="30" cy="26" r="6"/>
  <circle cx="18" cy="32" r="5"/>
  <circle cx="42" cy="32" r="5"/>
</g>
<g fill="#7f1d1d">
  <circle cx="22" cy="22" r="1.5"/>
  <circle cx="38" cy="22" r="1.5"/>
  <circle cx="30" cy="14" r="1.5"/>
  <circle cx="30" cy="26" r="1.5"/>
</g>
<g fill="#16a34a" stroke="#14532d" stroke-width="0.3">
  <ellipse cx="14" cy="36" rx="3" ry="1.5" transform="rotate(-30 14 36)"/>
  <ellipse cx="46" cy="36" rx="3" ry="1.5" transform="rotate(30 46 36)"/>
  <ellipse cx="22" cy="36" rx="2.5" ry="1.2" transform="rotate(-15 22 36)"/>
  <ellipse cx="38" cy="36" rx="2.5" ry="1.2" transform="rotate(15 38 36)"/>
</g>
<path d="M24 38 L20 56 L40 56 L36 38 Z" fill="#C9A84C"/>
<path d="M24 38 L20 56 L40 56 L36 38" fill="none" stroke="#a87f1c" stroke-width="0.5"/>
<line x1="22" y1="48" x2="38" y2="48" stroke="#a87f1c" stroke-width="0.5"/>`,
  },
  {
    id: 'avatar_24',
    label: 'Horseshoe of Roses',
    category: 'flora',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<path d="M14 20 Q14 50 30 52 Q46 50 46 20 L40 20 Q40 46 30 46 Q20 46 20 20 Z" fill="#C9A84C" stroke="#a87f1c" stroke-width="0.8"/>
<g fill="#1a1a1a">
  <circle cx="14" cy="22" r="0.9"/>
  <circle cx="20" cy="22" r="0.9"/>
  <circle cx="40" cy="22" r="0.9"/>
  <circle cx="46" cy="22" r="0.9"/>
  <circle cx="16" cy="46" r="0.9"/>
  <circle cx="44" cy="46" r="0.9"/>
</g>
<g fill="#dc2626" stroke="#7f1d1d" stroke-width="0.3">
  <circle cx="17" cy="18" r="3.5"/>
  <circle cx="25" cy="14" r="3.5"/>
  <circle cx="35" cy="14" r="3.5"/>
  <circle cx="43" cy="18" r="3.5"/>
</g>
<g fill="#7f1d1d">
  <circle cx="17" cy="18" r="1"/>
  <circle cx="25" cy="14" r="1"/>
  <circle cx="35" cy="14" r="1"/>
  <circle cx="43" cy="18" r="1"/>
</g>
<g fill="#16a34a">
  <ellipse cx="13" cy="14" rx="2.5" ry="1.2" transform="rotate(-30 13 14)"/>
  <ellipse cx="47" cy="14" rx="2.5" ry="1.2" transform="rotate(30 47 14)"/>
  <ellipse cx="30" cy="10" rx="2.5" ry="1.2"/>
</g>`,
  },
  {
    id: 'avatar_25',
    label: 'Single Red Rose',
    category: 'flora',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<g fill="#dc2626" stroke="#7f1d1d" stroke-width="0.5">
  <circle cx="30" cy="20" r="11"/>
</g>
<g fill="#7f1d1d">
  <path d="M26 14 Q30 12 34 14 Q34 18 30 18 Q26 18 26 14 Z"/>
  <path d="M22 22 Q26 26 30 26 Q26 22 22 22 Z"/>
  <path d="M38 22 Q34 26 30 26 Q34 22 38 22 Z"/>
  <circle cx="30" cy="20" r="2"/>
</g>
<line x1="30" y1="30" x2="30" y2="56" stroke="#16a34a" stroke-width="2"/>
<g fill="#16a34a" stroke="#14532d" stroke-width="0.4">
  <path d="M30 38 Q20 38 18 44 Q26 44 30 42 Z"/>
  <path d="M30 46 Q40 46 42 52 Q34 52 30 50 Z"/>
</g>
<g fill="#15803d">
  <circle cx="22" cy="36" r="0.8"/>
  <circle cx="38" cy="48" r="0.8"/>
</g>`,
  },
  {
    id: 'avatar_26',
    label: 'Lily Flowers',
    category: 'flora',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<g fill="#fff" stroke="#d4d4d8" stroke-width="0.6">
  <path d="M30 12 L24 22 L36 22 Z"/>
  <path d="M30 12 L20 18 L26 24 Z"/>
  <path d="M30 12 L40 18 L34 24 Z"/>
  <path d="M30 12 L26 26 L34 26 Z"/>
</g>
<g fill="#fbbf24">
  <ellipse cx="28" cy="20" rx="0.7" ry="2"/>
  <ellipse cx="32" cy="20" rx="0.7" ry="2"/>
  <ellipse cx="30" cy="18" rx="0.7" ry="2"/>
</g>
<line x1="30" y1="22" x2="30" y2="50" stroke="#16a34a" stroke-width="2"/>
<g fill="#fff" stroke="#d4d4d8" stroke-width="0.4">
  <path d="M16 36 L12 42 L20 42 Z"/>
  <path d="M16 36 L10 40 L14 44 Z"/>
  <path d="M16 36 L22 40 L18 44 Z"/>
</g>
<g fill="#fff" stroke="#d4d4d8" stroke-width="0.4">
  <path d="M44 40 L40 46 L48 46 Z"/>
  <path d="M44 40 L38 44 L42 48 Z"/>
  <path d="M44 40 L50 44 L46 48 Z"/>
</g>
<line x1="16" y1="42" x2="30" y2="40" stroke="#16a34a" stroke-width="1.2"/>
<line x1="44" y1="46" x2="30" y2="44" stroke="#16a34a" stroke-width="1.2"/>
<g fill="#fbbf24">
  <circle cx="16" cy="40" r="0.6"/>
  <circle cx="44" cy="44" r="0.6"/>
</g>`,
  },
  {
    id: 'avatar_27',
    label: 'Kentucky Bluegrass',
    category: 'flora',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<rect x="0" y="48" width="60" height="12" fill="#7c4a2c"/>
<g fill="#3b82f6" stroke="#1e40af" stroke-width="0.4">
  <path d="M8 50 Q6 32 10 14 L12 14 Q14 32 12 50 Z"/>
  <path d="M16 50 Q12 28 18 8 L20 8 Q22 28 20 50 Z"/>
  <path d="M22 50 Q22 30 26 18 L28 18 Q26 30 26 50 Z"/>
  <path d="M30 50 Q28 28 34 10 L36 10 Q34 28 34 50 Z"/>
  <path d="M38 50 Q40 30 42 16 L44 16 Q40 30 42 50 Z"/>
  <path d="M44 50 Q42 28 50 12 L52 12 Q44 28 48 50 Z"/>
</g>
<g fill="#1d4ed8" opacity="0.5">
  <ellipse cx="10" cy="20" rx="1" ry="3"/>
  <ellipse cx="20" cy="14" rx="1" ry="3"/>
  <ellipse cx="34" cy="16" rx="1" ry="3"/>
  <ellipse cx="44" cy="22" rx="1" ry="3"/>
  <ellipse cx="50" cy="18" rx="1" ry="3"/>
</g>`,
  },
  {
    id: 'avatar_28',
    label: 'Winner\'s Wreath',
    category: 'flora',
    svg: `<rect width="60" height="60" rx="8" fill="#fef3c7"/>
<circle cx="30" cy="32" r="20" fill="none" stroke="#16a34a" stroke-width="3"/>
<g fill="#16a34a" stroke="#14532d" stroke-width="0.4">
  <ellipse cx="14" cy="22" rx="3" ry="1.5" transform="rotate(-45 14 22)"/>
  <ellipse cx="10" cy="32" rx="3" ry="1.5" transform="rotate(0 10 32)"/>
  <ellipse cx="14" cy="42" rx="3" ry="1.5" transform="rotate(45 14 42)"/>
  <ellipse cx="22" cy="50" rx="3" ry="1.5" transform="rotate(75 22 50)"/>
  <ellipse cx="38" cy="50" rx="3" ry="1.5" transform="rotate(-75 38 50)"/>
  <ellipse cx="46" cy="42" rx="3" ry="1.5" transform="rotate(-45 46 42)"/>
  <ellipse cx="50" cy="32" rx="3" ry="1.5" transform="rotate(0 50 32)"/>
  <ellipse cx="46" cy="22" rx="3" ry="1.5" transform="rotate(45 46 22)"/>
  <ellipse cx="22" cy="14" rx="3" ry="1.5" transform="rotate(-75 22 14)"/>
  <ellipse cx="38" cy="14" rx="3" ry="1.5" transform="rotate(75 38 14)"/>
</g>
<path d="M22 50 L26 58 M38 50 L34 58" stroke="#dc2626" stroke-width="2"/>
<polygon points="30,28 32,34 38,34 33,38 35,44 30,40 25,44 27,38 22,34 28,34" fill="#C9A84C" stroke="#a87f1c" stroke-width="0.5"/>`,
  },

  // ─── LIFESTYLE & ACCESSORIES (29–34) ─────────────────────────────────────
  {
    id: 'avatar_29',
    label: 'Cigar with Smoke',
    category: 'lifestyle',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<rect x="4" y="34" width="46" height="6" rx="3" fill="#7c4a2c" stroke="#3a2010" stroke-width="0.5"/>
<rect x="4" y="34" width="10" height="6" fill="#5a3520"/>
<rect x="44" y="34" width="6" height="6" fill="#fbbf24"/>
<circle cx="50" cy="37" r="2" fill="#dc2626"/>
<circle cx="51" cy="36" r="0.8" fill="#fef3c7"/>
<g fill="none" stroke="#9ca3af" stroke-width="1.5" opacity="0.6">
  <path d="M52 32 Q56 28 54 22"/>
  <path d="M54 24 Q50 20 54 16"/>
  <path d="M52 18 Q56 14 52 10"/>
</g>
<g fill="#9ca3af" opacity="0.4">
  <circle cx="50" cy="28" r="1.5"/>
  <circle cx="56" cy="22" r="2"/>
  <circle cx="50" cy="14" r="2"/>
  <circle cx="54" cy="8" r="2.5"/>
</g>
<line x1="14" y1="34" x2="14" y2="40" stroke="#3a2010" stroke-width="0.8"/>
<line x1="20" y1="34" x2="20" y2="40" stroke="#3a2010" stroke-width="0.4"/>`,
  },
  {
    id: 'avatar_30',
    label: 'Gold Pocket Watch',
    category: 'lifestyle',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<g stroke="#a87f1c" stroke-width="0.6" fill="#C9A84C">
  <rect x="28" y="6" width="4" height="4" rx="1"/>
  <line x1="30" y1="10" x2="30" y2="14"/>
</g>
<circle cx="30" cy="32" r="18" fill="#C9A84C" stroke="#a87f1c" stroke-width="1.4"/>
<circle cx="30" cy="32" r="14" fill="#fef3c7" stroke="#a87f1c" stroke-width="0.6"/>
<g font-family="serif" font-size="3.5" font-weight="bold" fill="#1a1a1a" text-anchor="middle">
  <text x="30" y="22">XII</text>
  <text x="42" y="33">III</text>
  <text x="30" y="46">VI</text>
  <text x="18" y="33">IX</text>
</g>
<g fill="#1a1a1a" stroke="#1a1a1a">
  <line x1="30" y1="32" x2="30" y2="24" stroke-width="1.5"/>
  <line x1="30" y1="32" x2="38" y2="34" stroke-width="1"/>
</g>
<circle cx="30" cy="32" r="1.2" fill="#8B1A2F"/>
<g stroke="#C9A84C" stroke-width="1.5" fill="none">
  <path d="M48 18 L54 12 L52 16 L56 12"/>
</g>
<g fill="#fff" opacity="0.4">
  <ellipse cx="22" cy="22" rx="3" ry="2"/>
</g>`,
  },
  {
    id: 'avatar_31',
    label: 'Binoculars',
    category: 'lifestyle',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<rect x="22" y="20" width="16" height="6" rx="1" fill="#3a3a3a"/>
<g fill="#3a3a3a" stroke="#000" stroke-width="0.6">
  <rect x="6" y="20" width="20" height="28" rx="4"/>
  <rect x="34" y="20" width="20" height="28" rx="4"/>
</g>
<g fill="#1a1a1a" stroke="#000" stroke-width="0.6">
  <rect x="8" y="24" width="16" height="20" rx="3"/>
  <rect x="36" y="24" width="16" height="20" rx="3"/>
</g>
<g fill="#3b82f6" opacity="0.7">
  <circle cx="16" cy="34" r="6"/>
  <circle cx="44" cy="34" r="6"/>
</g>
<g fill="#fff" opacity="0.7">
  <circle cx="13" cy="31" r="1.5"/>
  <circle cx="41" cy="31" r="1.5"/>
</g>
<g fill="none" stroke="#C9A84C" stroke-width="0.6">
  <circle cx="16" cy="34" r="6"/>
  <circle cx="44" cy="34" r="6"/>
</g>
<rect x="6" y="46" width="20" height="3" rx="1" fill="#000"/>
<rect x="34" y="46" width="20" height="3" rx="1" fill="#000"/>
<line x1="22" y1="22" x2="38" y2="22" stroke="#C9A84C" stroke-width="0.8"/>`,
  },
  {
    id: 'avatar_32',
    label: 'Money Bag',
    category: 'lifestyle',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<path d="M18 22 Q14 36 14 46 Q14 56 30 56 Q46 56 46 46 Q46 36 42 22 Z" fill="#C9A84C" stroke="#a87f1c" stroke-width="0.8"/>
<path d="M18 22 Q14 36 14 46 Q14 56 30 56 Q46 56 46 46 Q46 36 42 22 Z" fill="none" stroke="#a87f1c" stroke-width="0.8"/>
<rect x="18" y="14" width="24" height="10" rx="1" fill="#a87f1c"/>
<path d="M14 24 Q30 20 46 24 L42 26 Q30 24 18 26 Z" fill="#a87f1c"/>
<g stroke="#fff" stroke-width="0.4" fill="none" opacity="0.4">
  <path d="M18 30 Q22 36 26 30"/>
  <path d="M34 36 Q38 42 42 36"/>
</g>
<text x="30" y="46" font-size="20" font-family="serif" font-weight="bold" fill="#1B4332" text-anchor="middle">$</text>
<g fill="#C9A84C">
  <rect x="22" y="6" width="3" height="14" rx="0.5"/>
  <rect x="28" y="6" width="3" height="14" rx="0.5"/>
  <rect x="35" y="6" width="3" height="14" rx="0.5"/>
</g>`,
  },
  {
    id: 'avatar_33',
    label: 'Gold Trophy Cup',
    category: 'lifestyle',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<path d="M16 12 L44 12 L44 30 Q44 38 30 38 Q16 38 16 30 Z" fill="#C9A84C" stroke="#a87f1c" stroke-width="0.8"/>
<g fill="none" stroke="#a87f1c" stroke-width="2.5">
  <path d="M16 16 Q4 16 4 24 Q4 32 12 30"/>
  <path d="M44 16 Q56 16 56 24 Q56 32 48 30"/>
</g>
<rect x="24" y="38" width="12" height="4" fill="#a87f1c"/>
<rect x="20" y="42" width="20" height="4" rx="1" fill="#C9A84C" stroke="#a87f1c" stroke-width="0.5"/>
<rect x="14" y="46" width="32" height="6" rx="1" fill="#7c4a2c" stroke="#3a2010" stroke-width="0.5"/>
<text x="30" y="51" font-size="3.5" font-family="serif" font-weight="bold" fill="#C9A84C" text-anchor="middle">DERBY</text>
<g fill="#fef3c7" opacity="0.5">
  <ellipse cx="22" cy="22" rx="2.5" ry="6"/>
</g>
<polygon points="30,18 32,24 38,24 33,28 35,34 30,30 25,34 27,28 22,24 28,24" fill="#fef3c7" opacity="0.6"/>
<polygon points="30,18 32,24 38,24 33,28 35,34 30,30 25,34 27,28 22,24 28,24" fill="none" stroke="#a87f1c" stroke-width="0.4"/>`,
  },
  {
    id: 'avatar_34',
    label: 'Racing Program',
    category: 'lifestyle',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<rect x="14" y="8" width="32" height="46" rx="1" fill="#fef3c7" stroke="#7c4a2c" stroke-width="0.6"/>
<rect x="14" y="8" width="32" height="14" fill="#8B1A2F"/>
<text x="30" y="14" font-size="4" font-family="serif" font-weight="bold" fill="#C9A84C" text-anchor="middle">DERBY</text>
<text x="30" y="20" font-size="6" font-family="serif" font-weight="bold" fill="#C9A84C" text-anchor="middle">RACING</text>
<g stroke="#5a3520" stroke-width="0.4" fill="none">
  <line x1="18" y1="26" x2="42" y2="26"/>
  <line x1="18" y1="30" x2="42" y2="30"/>
  <line x1="18" y1="34" x2="42" y2="34"/>
  <line x1="18" y1="38" x2="42" y2="38"/>
  <line x1="18" y1="42" x2="42" y2="42"/>
  <line x1="18" y1="46" x2="36" y2="46"/>
  <line x1="18" y1="50" x2="42" y2="50"/>
</g>
<g font-size="3" font-family="monospace" fill="#1a1a1a">
  <text x="20" y="29">1</text>
  <text x="20" y="33">2</text>
  <text x="20" y="37">3</text>
  <text x="20" y="41">4</text>
  <text x="20" y="45">5</text>
  <text x="20" y="49">6</text>
</g>
<text x="40" y="51" font-size="6" font-family="serif" font-weight="bold" fill="#8B1A2F" text-anchor="end">$2</text>`,
  },

  // ─── FUN & LUCKY (35–40) ─────────────────────────────────────────────────
  {
    id: 'avatar_35',
    label: 'Lucky Horseshoe',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<path d="M12 18 Q12 50 30 52 Q48 50 48 18 L40 18 Q40 44 30 44 Q20 44 20 18 Z" fill="#C9A84C" stroke="#a87f1c" stroke-width="1.4"/>
<g fill="#1a1a1a">
  <circle cx="14" cy="22" r="1.2"/>
  <circle cx="20" cy="22" r="1.2"/>
  <circle cx="40" cy="22" r="1.2"/>
  <circle cx="46" cy="22" r="1.2"/>
  <circle cx="14" cy="32" r="1.2"/>
  <circle cx="20" cy="32" r="1.2"/>
  <circle cx="40" cy="32" r="1.2"/>
  <circle cx="46" cy="32" r="1.2"/>
  <circle cx="16" cy="42" r="1.2"/>
  <circle cx="44" cy="42" r="1.2"/>
</g>
<g fill="#fef3c7" opacity="0.5">
  <ellipse cx="20" cy="20" rx="2" ry="4"/>
</g>
<g fill="#fff">
  <circle cx="30" cy="14" r="1.5"/>
  <circle cx="14" cy="14" r="0.8"/>
  <circle cx="46" cy="14" r="0.8"/>
</g>`,
  },
  {
    id: 'avatar_36',
    label: 'Lucky Sevens',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<g fill="#fff" stroke="#1a1a1a" stroke-width="0.8">
  <rect x="6" y="18" width="22" height="22" rx="3" transform="rotate(-12 17 29)"/>
  <rect x="32" y="22" width="22" height="22" rx="3" transform="rotate(12 43 33)"/>
</g>
<g fill="#dc2626" transform="rotate(-12 17 29)">
  <circle cx="11" cy="23" r="1.6"/>
  <circle cx="17" cy="29" r="1.6"/>
  <circle cx="23" cy="35" r="1.6"/>
</g>
<g fill="#dc2626" transform="rotate(12 43 33)">
  <circle cx="37" cy="27" r="1.6"/>
  <circle cx="49" cy="27" r="1.6"/>
  <circle cx="37" cy="39" r="1.6"/>
  <circle cx="49" cy="39" r="1.6"/>
</g>
<text x="30" y="58" font-size="9" font-family="serif" font-weight="bold" fill="#C9A84C" text-anchor="middle">LUCKY 7</text>`,
  },
  {
    id: 'avatar_37',
    label: 'Poker Chip Stack',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<g stroke="#1a1a1a" stroke-width="0.6">
  <ellipse cx="30" cy="46" rx="20" ry="6" fill="#1a1a1a"/>
  <ellipse cx="30" cy="44" rx="20" ry="5" fill="#1a1a1a"/>
  <ellipse cx="30" cy="40" rx="20" ry="6" fill="#dc2626"/>
  <ellipse cx="30" cy="38" rx="20" ry="5" fill="#dc2626"/>
  <ellipse cx="30" cy="34" rx="20" ry="6" fill="#fff"/>
  <ellipse cx="30" cy="32" rx="20" ry="5" fill="#fff"/>
  <ellipse cx="30" cy="28" rx="20" ry="6" fill="#1e3a8a"/>
  <ellipse cx="30" cy="26" rx="20" ry="5" fill="#1e3a8a"/>
  <ellipse cx="30" cy="22" rx="20" ry="6" fill="#C9A84C"/>
  <ellipse cx="30" cy="20" rx="20" ry="5" fill="#C9A84C"/>
</g>
<g fill="none" stroke="#fff" stroke-width="0.8" stroke-dasharray="2 1.5">
  <ellipse cx="30" cy="20" rx="14" ry="3.5"/>
  <ellipse cx="30" cy="26" rx="14" ry="3.5" stroke="#fff"/>
  <ellipse cx="30" cy="32" rx="14" ry="3.5" stroke="#1a1a1a"/>
  <ellipse cx="30" cy="38" rx="14" ry="3.5" stroke="#fff"/>
  <ellipse cx="30" cy="44" rx="14" ry="3.5" stroke="#fff"/>
</g>
<text x="30" y="22" font-size="5" font-family="serif" font-weight="bold" fill="#1a1a1a" text-anchor="middle">$</text>`,
  },
  {
    id: 'avatar_38',
    label: 'Ace of Spades',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<rect x="12" y="6" width="36" height="48" rx="3" fill="#fef3c7" stroke="#1a1a1a" stroke-width="0.8"/>
<text x="16" y="16" font-size="6" font-family="serif" font-weight="bold" fill="#1a1a1a">A</text>
<path d="M18 18 Q16 22 18 24 Q20 22 18 18 Z" fill="#1a1a1a"/>
<text x="44" y="50" font-size="6" font-family="serif" font-weight="bold" fill="#1a1a1a" text-anchor="end" transform="rotate(180 44 50)">A</text>
<g transform="rotate(180 44 44)">
  <path d="M44 42 Q42 46 44 48 Q46 46 44 42 Z" fill="#1a1a1a"/>
</g>
<g transform="translate(30 30) scale(2.4)">
  <path d="M0 -6 Q-5 -2 -5 2 Q-5 5 -2 5 Q-1 5 0 4 Q1 5 2 5 Q5 5 5 2 Q5 -2 0 -6 Z" fill="#1a1a1a"/>
  <path d="M-1 4 L-2 7 L2 7 L1 4 Z" fill="#1a1a1a"/>
</g>`,
  },
  {
    id: 'avatar_39',
    label: 'Cowboy Boot',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<rect x="0" y="50" width="60" height="10" fill="#5a3520"/>
<path d="M16 8 L34 8 L36 36 L52 36 L52 50 L16 50 Z" fill="#7c4a2c" stroke="#3a2010" stroke-width="0.8"/>
<rect x="16" y="50" width="40" height="4" fill="#3a2010"/>
<line x1="16" y1="14" x2="34" y2="14" stroke="#C9A84C" stroke-width="1"/>
<line x1="16" y1="20" x2="34" y2="20" stroke="#C9A84C" stroke-width="0.6"/>
<g stroke="#C9A84C" stroke-width="0.5" fill="none">
  <path d="M18 22 Q22 28 26 22"/>
  <path d="M28 22 Q32 28 34 22"/>
  <path d="M20 30 Q24 36 28 30"/>
  <path d="M30 30 Q34 36 32 32"/>
</g>
<g fill="#C9A84C" stroke="#a87f1c" stroke-width="0.4">
  <circle cx="44" cy="46" r="3"/>
</g>
<g stroke="#a87f1c" stroke-width="0.4">
  <line x1="41" y1="46" x2="47" y2="46"/>
  <line x1="44" y1="43" x2="44" y2="49"/>
  <line x1="42" y1="44" x2="46" y2="48"/>
  <line x1="46" y1="44" x2="42" y2="48"/>
</g>
<g fill="#3a2010">
  <circle cx="20" cy="46" r="0.8"/>
  <circle cx="26" cy="46" r="0.8"/>
  <circle cx="32" cy="46" r="0.8"/>
</g>`,
  },
  {
    id: 'avatar_40',
    label: 'Four Leaf Clover',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<g fill="#16a34a" stroke="#14532d" stroke-width="0.6">
  <path d="M30 30 Q22 14 16 16 Q14 24 26 28 Z"/>
  <path d="M30 30 Q22 46 16 44 Q14 36 26 32 Z"/>
  <path d="M30 30 Q38 14 44 16 Q46 24 34 28 Z"/>
  <path d="M30 30 Q38 46 44 44 Q46 36 34 32 Z"/>
</g>
<g fill="#22c55e" opacity="0.5">
  <path d="M22 22 Q18 18 20 20 Z"/>
  <path d="M22 38 Q18 42 20 40 Z"/>
  <path d="M38 22 Q42 18 40 20 Z"/>
  <path d="M38 38 Q42 42 40 40 Z"/>
</g>
<circle cx="30" cy="30" r="2.5" fill="#15803d"/>
<line x1="30" y1="32" x2="30" y2="56" stroke="#15803d" stroke-width="2"/>
<g fill="#fef3c7" opacity="0.7">
  <circle cx="22" cy="20" r="0.8"/>
  <circle cx="38" cy="20" r="0.8"/>
  <circle cx="22" cy="40" r="0.8"/>
  <circle cx="38" cy="40" r="0.8"/>
</g>`,
  },

  // ─── SPORTS (41–46) ──────────────────────────────────────────────────────
  {
    id: 'avatar_41',
    label: 'Football Helmet',
    category: 'sports',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<path d="M14 28 Q14 14 30 14 Q46 14 46 28 L46 40 Q46 46 40 48 L24 48 Q14 46 14 40 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.8"/>
<rect x="14" y="36" width="32" height="2" fill="#fff"/>
<g stroke="#1a1a1a" stroke-width="1.4" fill="none">
  <path d="M14 38 L46 38"/>
  <path d="M14 42 L46 42"/>
  <path d="M22 38 L22 42"/>
  <path d="M30 38 L30 42"/>
  <path d="M38 38 L38 42"/>
</g>
<rect x="6" y="38" width="6" height="6" rx="1" fill="#3a3a3a"/>
<g fill="#fef3c7" opacity="0.4">
  <ellipse cx="22" cy="22" rx="4" ry="6"/>
</g>
<circle cx="40" cy="20" r="2.5" fill="#fff"/>
<circle cx="40" cy="20" r="1.4" fill="#dc2626"/>`,
  },
  {
    id: 'avatar_42',
    label: 'Baseball Cap',
    category: 'sports',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<path d="M14 36 Q14 22 30 22 Q46 22 46 36 L46 38 L14 38 Z" fill="#1e3a8a" stroke="#0f172a" stroke-width="0.6"/>
<rect x="14" y="36" width="32" height="3" fill="#0f172a"/>
<path d="M8 42 Q14 38 30 38 Q46 38 52 42 L48 46 Q30 40 12 46 Z" fill="#1e3a8a" stroke="#0f172a" stroke-width="0.6"/>
<circle cx="30" cy="28" r="5" fill="#fff" stroke="#0f172a" stroke-width="0.6"/>
<text x="30" y="31" font-size="7" font-family="serif" font-weight="bold" fill="#dc2626" text-anchor="middle">B</text>
<g fill="#fff" opacity="0.3">
  <ellipse cx="22" cy="26" rx="3" ry="4"/>
</g>`,
  },
  {
    id: 'avatar_43',
    label: 'Basketball',
    category: 'sports',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<circle cx="30" cy="30" r="20" fill="#ea580c" stroke="#7c2d12" stroke-width="1"/>
<g fill="none" stroke="#1a1a1a" stroke-width="1.4">
  <line x1="30" y1="10" x2="30" y2="50"/>
  <line x1="10" y1="30" x2="50" y2="30"/>
  <path d="M16 16 Q22 30 16 44"/>
  <path d="M44 16 Q38 30 44 44"/>
</g>
<g fill="#fef3c7" opacity="0.5">
  <ellipse cx="22" cy="22" rx="4" ry="3"/>
</g>`,
  },
  {
    id: 'avatar_44',
    label: 'Golf Flag',
    category: 'sports',
    svg: `<rect width="60" height="60" rx="8" fill="#16a34a"/>
<rect x="0" y="48" width="60" height="12" fill="#15803d"/>
<line x1="14" y1="6" x2="14" y2="52" stroke="#1a1a1a" stroke-width="2"/>
<path d="M14 8 L42 12 L36 18 L42 24 L14 20 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.5"/>
<text x="22" y="19" font-size="6" font-family="serif" font-weight="bold" fill="#fff">18</text>
<circle cx="36" cy="50" r="3.5" fill="#fff" stroke="#1a1a1a" stroke-width="0.4"/>
<g fill="#1a1a1a">
  <circle cx="35" cy="49" r="0.3"/>
  <circle cx="37" cy="50" r="0.3"/>
  <circle cx="35" cy="51" r="0.3"/>
  <circle cx="37" cy="48.5" r="0.3"/>
  <circle cx="36" cy="50" r="0.3"/>
</g>
<g stroke="#22c55e" stroke-width="1" fill="none">
  <path d="M44 50 Q48 47 52 50"/>
  <path d="M46 53 Q50 50 54 53"/>
  <path d="M2 52 Q6 49 10 52"/>
</g>`,
  },
  {
    id: 'avatar_45',
    label: 'Soccer Ball',
    category: 'sports',
    svg: `<rect width="60" height="60" rx="8" fill="#16a34a"/>
<circle cx="30" cy="30" r="20" fill="#fff" stroke="#1a1a1a" stroke-width="1"/>
<polygon points="30,24 37,28 34,35 26,35 23,28" fill="#1a1a1a"/>
<g stroke="#1a1a1a" stroke-width="1.2" fill="none">
  <line x1="30" y1="24" x2="30" y2="14"/>
  <line x1="37" y1="28" x2="46" y2="25"/>
  <line x1="34" y1="35" x2="40" y2="44"/>
  <line x1="26" y1="35" x2="20" y2="44"/>
  <line x1="23" y1="28" x2="14" y2="25"/>
</g>
<g fill="#fef3c7" opacity="0.5">
  <ellipse cx="22" cy="22" rx="3" ry="2"/>
</g>`,
  },
  {
    id: 'avatar_46',
    label: 'Tennis Racket',
    category: 'sports',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<ellipse cx="24" cy="24" rx="14" ry="16" fill="#fff" stroke="#1a1a1a" stroke-width="1"/>
<g stroke="#dc2626" stroke-width="0.5" fill="none">
  <line x1="11" y1="20" x2="37" y2="20"/>
  <line x1="11" y1="24" x2="37" y2="24"/>
  <line x1="11" y1="28" x2="37" y2="28"/>
  <line x1="11" y1="16" x2="37" y2="16"/>
  <line x1="13" y1="32" x2="35" y2="32"/>
  <line x1="24" y1="9" x2="24" y2="39"/>
  <line x1="20" y1="10" x2="20" y2="38"/>
  <line x1="28" y1="10" x2="28" y2="38"/>
  <line x1="16" y1="11" x2="16" y2="37"/>
  <line x1="32" y1="11" x2="32" y2="37"/>
</g>
<ellipse cx="24" cy="24" rx="14" ry="16" fill="none" stroke="#1a1a1a" stroke-width="2.5"/>
<rect x="34" y="34" width="22" height="6" rx="2" transform="rotate(35 34 34)" fill="#1a1a1a"/>
<rect x="34" y="34" width="22" height="6" rx="2" transform="rotate(35 34 34)" fill="none" stroke="#C9A84C" stroke-width="0.6"/>
<circle cx="48" cy="14" r="4.5" fill="#bef264" stroke="#65a30d" stroke-width="0.6"/>
<path d="M45 12 Q48 11 51 13" stroke="#fff" stroke-width="0.5" fill="none"/>`,
  },

  // ─── PARTY (47–54) ───────────────────────────────────────────────────────
  {
    id: 'avatar_47',
    label: 'Party Hat',
    category: 'party',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<polygon points="30,8 18,46 42,46" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.8"/>
<g fill="#fef3c7">
  <circle cx="30" cy="8" r="3"/>
</g>
<g fill="#C9A84C">
  <circle cx="30" cy="8" r="1.5"/>
</g>
<g fill="#16a34a">
  <circle cx="22" cy="38" r="2"/>
  <circle cx="38" cy="38" r="2"/>
  <circle cx="30" cy="42" r="2"/>
  <circle cx="26" cy="30" r="1.5"/>
  <circle cx="34" cy="30" r="1.5"/>
  <circle cx="30" cy="22" r="1.5"/>
</g>
<g fill="#3b82f6">
  <circle cx="22" cy="32" r="1.5"/>
  <circle cx="38" cy="32" r="1.5"/>
  <circle cx="26" cy="40" r="1.5"/>
  <circle cx="34" cy="40" r="1.5"/>
</g>
<rect x="14" y="46" width="32" height="3" rx="1" fill="#7c4a2c"/>
<g fill="#fef3c7" opacity="0.4">
  <polygon points="22,18 24,18 22,30"/>
</g>`,
  },
  {
    id: 'avatar_48',
    label: 'Confetti',
    category: 'party',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<g>
  <rect x="10" y="10" width="3" height="6" fill="#dc2626" transform="rotate(20 11 13)"/>
  <rect x="46" y="8" width="3" height="6" fill="#3b82f6" transform="rotate(-30 47 11)"/>
  <rect x="22" y="14" width="3" height="6" fill="#C9A84C" transform="rotate(45 23 17)"/>
  <rect x="36" y="20" width="3" height="6" fill="#16a34a" transform="rotate(60 37 23)"/>
  <rect x="14" y="26" width="3" height="6" fill="#a855f7" transform="rotate(-20 15 29)"/>
  <rect x="44" y="32" width="3" height="6" fill="#ea580c" transform="rotate(50 45 35)"/>
  <rect x="8" y="38" width="3" height="6" fill="#dc2626" transform="rotate(15 9 41)"/>
  <rect x="28" y="36" width="3" height="6" fill="#3b82f6" transform="rotate(-40 29 39)"/>
  <rect x="42" y="46" width="3" height="6" fill="#C9A84C" transform="rotate(70 43 49)"/>
  <rect x="20" y="48" width="3" height="6" fill="#16a34a" transform="rotate(-25 21 51)"/>
</g>
<g>
  <circle cx="30" cy="22" r="2" fill="#fef3c7"/>
  <circle cx="18" cy="42" r="1.5" fill="#a855f7"/>
  <circle cx="50" cy="22" r="1.5" fill="#ea580c"/>
  <circle cx="30" cy="50" r="1.5" fill="#dc2626"/>
  <circle cx="38" cy="14" r="1.2" fill="#16a34a"/>
</g>
<g stroke="#fff" stroke-width="0.6" fill="none">
  <path d="M16 20 Q20 18 24 20"/>
  <path d="M40 40 Q44 42 48 40"/>
</g>`,
  },
  {
    id: 'avatar_49',
    label: 'Champagne Bottle',
    category: 'party',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<rect x="24" y="6" width="12" height="6" fill="#1a1a1a" stroke="#000"/>
<rect x="22" y="12" width="16" height="4" rx="0.5" fill="#C9A84C"/>
<path d="M22 16 L22 22 Q20 24 20 28 L20 50 Q20 54 24 54 L36 54 Q40 54 40 50 L40 28 Q40 24 38 22 L38 16 Z" fill="#16a34a" stroke="#14532d" stroke-width="0.8"/>
<rect x="22" y="32" width="16" height="14" fill="#fef3c7" stroke="#a87f1c" stroke-width="0.4"/>
<text x="30" y="38" font-size="3" font-family="serif" font-weight="bold" fill="#8B1A2F" text-anchor="middle">DERBY</text>
<text x="30" y="42" font-size="2.5" font-family="serif" fill="#1a1a1a" text-anchor="middle">VINTAGE</text>
<text x="30" y="45" font-size="2" font-family="serif" fill="#1a1a1a" text-anchor="middle">2026</text>
<g stroke="#C9A84C" stroke-width="0.5" fill="none">
  <line x1="22" y1="32" x2="38" y2="32"/>
  <line x1="22" y1="46" x2="38" y2="46"/>
</g>
<g fill="#fef3c7" opacity="0.4">
  <ellipse cx="26" cy="28" rx="2" ry="8"/>
</g>
<g fill="#fef3c7">
  <circle cx="14" cy="12" r="1"/>
  <circle cx="46" cy="14" r="1.2"/>
  <circle cx="50" cy="20" r="0.8"/>
  <circle cx="10" cy="20" r="0.8"/>
  <circle cx="44" cy="8" r="0.6"/>
</g>`,
  },
  {
    id: 'avatar_50',
    label: 'Cocktail Glass',
    category: 'party',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<path d="M12 14 L48 14 L34 34 L26 34 Z" fill="#fb7185" fill-opacity="0.4" stroke="#fff" stroke-width="0.8"/>
<path d="M12 14 L48 14 L46 18 L14 18 Z" fill="#fb7185" stroke="#fff" stroke-width="0.4"/>
<rect x="29" y="34" width="2" height="14" fill="#fff"/>
<rect x="20" y="48" width="20" height="2" rx="1" fill="#fff"/>
<g fill="#16a34a">
  <circle cx="40" cy="14" r="2.5"/>
  <path d="M40 11 L41 8 L43 8 L42 11 Z"/>
</g>
<g stroke="#fef3c7" stroke-width="0.6" fill="none">
  <line x1="44" y1="6" x2="44" y2="22"/>
</g>
<g fill="#fef3c7">
  <circle cx="30" cy="22" r="1.2"/>
  <circle cx="24" cy="20" r="0.8"/>
  <circle cx="36" cy="20" r="0.8"/>
  <circle cx="30" cy="16" r="0.6" opacity="0.6"/>
</g>`,
  },
  {
    id: 'avatar_51',
    label: 'Sunglasses',
    category: 'party',
    svg: `<rect width="60" height="60" rx="8" fill="#fbbf24"/>
<rect x="0" y="48" width="60" height="12" fill="#f59e0b"/>
<g fill="#1a1a1a" stroke="#000" stroke-width="0.6">
  <ellipse cx="18" cy="30" rx="10" ry="9"/>
  <ellipse cx="42" cy="30" rx="10" ry="9"/>
</g>
<rect x="27" y="28" width="6" height="2" fill="#1a1a1a"/>
<g fill="#3b82f6" stroke="#1e3a8a" stroke-width="0.4">
  <ellipse cx="18" cy="30" rx="8" ry="7"/>
  <ellipse cx="42" cy="30" rx="8" ry="7"/>
</g>
<g fill="#fef3c7" opacity="0.7">
  <ellipse cx="14" cy="26" rx="3" ry="2"/>
  <ellipse cx="38" cy="26" rx="3" ry="2"/>
</g>
<g stroke="#1a1a1a" stroke-width="1.5" fill="none">
  <path d="M8 30 L4 26"/>
  <path d="M52 30 L56 26"/>
</g>
<g fill="#fff" opacity="0.6">
  <circle cx="50" cy="14" r="3"/>
  <circle cx="50" cy="14" r="5" fill="none" stroke="#fff" stroke-width="0.4"/>
</g>`,
  },
  {
    id: 'avatar_52',
    label: 'Red Bow Tie',
    category: 'party',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<rect x="12" y="20" width="36" height="3" fill="#fff" opacity="0.3"/>
<polygon points="6,20 26,28 26,40 6,48" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.8"/>
<polygon points="54,20 34,28 34,40 54,48" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.8"/>
<rect x="26" y="26" width="8" height="16" rx="1" fill="#7f1d1d"/>
<g fill="#fef3c7" opacity="0.4">
  <polygon points="10,26 18,32 12,38 8,32"/>
  <polygon points="50,26 42,32 48,38 52,32"/>
</g>
<g stroke="#7f1d1d" stroke-width="0.4">
  <line x1="26" y1="30" x2="34" y2="30"/>
  <line x1="26" y1="38" x2="34" y2="38"/>
</g>
<g fill="#C9A84C">
  <circle cx="30" cy="34" r="1.5"/>
</g>
<g stroke="#fff" stroke-width="0.4" fill="none" opacity="0.5">
  <path d="M30 12 Q30 18 30 20"/>
  <path d="M30 48 Q30 52 30 56"/>
</g>`,
  },
  {
    id: 'avatar_53',
    label: 'Birthday Cake',
    category: 'party',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<g stroke="#a87f1c" stroke-width="0.4">
  <rect x="10" y="34" width="40" height="16" fill="#fef3c7"/>
  <rect x="10" y="34" width="40" height="3" fill="#fb7185"/>
  <rect x="10" y="46" width="40" height="2" fill="#fb7185"/>
  <rect x="14" y="22" width="32" height="14" fill="#fef3c7"/>
  <rect x="14" y="22" width="32" height="3" fill="#3b82f6"/>
</g>
<g fill="#dc2626">
  <rect x="20" y="14" width="2" height="10" rx="1"/>
  <rect x="29" y="12" width="2" height="12" rx="1"/>
  <rect x="38" y="14" width="2" height="10" rx="1"/>
</g>
<g fill="#fbbf24">
  <ellipse cx="21" cy="12" rx="1.5" ry="2.5"/>
  <ellipse cx="30" cy="10" rx="1.5" ry="2.5"/>
  <ellipse cx="39" cy="12" rx="1.5" ry="2.5"/>
</g>
<g fill="#fff" opacity="0.7">
  <circle cx="21" cy="11" r="0.6"/>
  <circle cx="30" cy="9" r="0.6"/>
  <circle cx="39" cy="11" r="0.6"/>
</g>
<g fill="#16a34a">
  <circle cx="18" cy="40" r="1.2"/>
  <circle cx="30" cy="42" r="1.2"/>
  <circle cx="42" cy="40" r="1.2"/>
</g>
<g fill="#a855f7">
  <circle cx="24" cy="44" r="1"/>
  <circle cx="36" cy="44" r="1"/>
</g>`,
  },
  {
    id: 'avatar_54',
    label: 'Disco Ball',
    category: 'party',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<line x1="30" y1="6" x2="30" y2="14" stroke="#a87f1c" stroke-width="1"/>
<rect x="26" y="14" width="8" height="3" fill="#3a3a3a"/>
<circle cx="30" cy="36" r="18" fill="#6b7280" stroke="#3a3a3a" stroke-width="0.8"/>
<g stroke="#a3a8b1" stroke-width="0.3" fill="none">
  <line x1="12" y1="36" x2="48" y2="36"/>
  <line x1="14" y1="28" x2="46" y2="28"/>
  <line x1="14" y1="44" x2="46" y2="44"/>
  <line x1="18" y1="22" x2="42" y2="22"/>
  <line x1="18" y1="50" x2="42" y2="50"/>
  <line x1="30" y1="18" x2="30" y2="54"/>
  <line x1="22" y1="20" x2="22" y2="52"/>
  <line x1="38" y1="20" x2="38" y2="52"/>
</g>
<g fill="#fef3c7" opacity="0.9">
  <rect x="20" y="22" width="3" height="3"/>
  <rect x="34" y="26" width="3" height="3"/>
  <rect x="26" y="30" width="3" height="3"/>
  <rect x="40" y="34" width="3" height="3"/>
  <rect x="16" y="36" width="3" height="3"/>
  <rect x="32" y="42" width="3" height="3"/>
  <rect x="22" y="46" width="3" height="3"/>
  <rect x="38" y="44" width="3" height="3"/>
</g>
<g fill="#3b82f6" opacity="0.8">
  <rect x="28" y="20" width="3" height="3"/>
  <rect x="20" y="32" width="3" height="3"/>
  <rect x="42" y="38" width="3" height="3"/>
  <rect x="28" y="48" width="3" height="3"/>
</g>
<g fill="#dc2626" opacity="0.8">
  <rect x="36" y="20" width="3" height="3"/>
  <rect x="14" y="40" width="3" height="3"/>
  <rect x="34" y="36" width="3" height="3"/>
</g>
<g stroke="#fef3c7" stroke-width="0.5" fill="none" opacity="0.5">
  <line x1="6" y1="50" x2="14" y2="46"/>
  <line x1="54" y1="50" x2="46" y2="46"/>
  <line x1="6" y1="22" x2="14" y2="26"/>
</g>`,
  },

  // ─── ANIMALS (55–62) ─────────────────────────────────────────────────────
  {
    id: 'avatar_55',
    label: 'Horse Head',
    category: 'animal',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<g fill="#7c4a2c" stroke="#3a2010" stroke-width="0.6">
  <path d="M22 16 Q22 8 30 8 Q40 8 42 18 L44 30 Q44 42 38 50 L24 50 Q22 42 22 30 Z"/>
</g>
<path d="M22 14 L18 6 L24 12 Z" fill="#5a3520"/>
<path d="M40 12 L44 4 L42 14 Z" fill="#5a3520"/>
<path d="M30 12 Q22 14 22 26 Q22 30 26 28 Q30 24 30 16 Z" fill="#3a2010"/>
<g fill="#1a1a1a">
  <ellipse cx="36" cy="26" rx="1.6" ry="2"/>
</g>
<g fill="#fff">
  <circle cx="36" cy="26" r="0.5"/>
</g>
<g fill="#3a2010">
  <ellipse cx="36" cy="42" rx="3" ry="2"/>
</g>
<g fill="#1a1a1a">
  <circle cx="35" cy="40" r="0.6"/>
  <circle cx="37" cy="40" r="0.6"/>
</g>
<path d="M22 16 Q14 22 12 36 Q14 30 22 28 Z" fill="#1a1a1a"/>
<path d="M30 8 Q34 6 38 8 L36 12 Z" fill="#5a3520"/>`,
  },
  {
    id: 'avatar_56',
    label: 'Loyal Dog',
    category: 'animal',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<g fill="#a47148" stroke="#5a3520" stroke-width="0.6">
  <ellipse cx="30" cy="34" rx="14" ry="12"/>
  <path d="M14 22 Q12 12 18 14 Q20 22 22 26 Z"/>
  <path d="M46 22 Q48 12 42 14 Q40 22 38 26 Z"/>
</g>
<g fill="#7c4a2c">
  <path d="M14 22 Q12 12 18 14 Q20 22 22 26 Z"/>
  <path d="M46 22 Q48 12 42 14 Q40 22 38 26 Z"/>
</g>
<ellipse cx="30" cy="42" rx="10" ry="8" fill="#fef3c7"/>
<g fill="#1a1a1a">
  <circle cx="24" cy="32" r="1.6"/>
  <circle cx="36" cy="32" r="1.6"/>
  <ellipse cx="30" cy="40" rx="2.5" ry="2"/>
</g>
<g fill="#fff">
  <circle cx="24" cy="31.5" r="0.5"/>
  <circle cx="36" cy="31.5" r="0.5"/>
</g>
<path d="M28 44 Q30 47 32 44" stroke="#1a1a1a" stroke-width="0.8" fill="none"/>
<path d="M30 42 L30 44" stroke="#1a1a1a" stroke-width="0.8"/>
<g fill="#dc2626">
  <ellipse cx="30" cy="46" rx="1.5" ry="1"/>
</g>
<g fill="#7c4a2c" opacity="0.5">
  <ellipse cx="22" cy="34" rx="3" ry="2"/>
  <ellipse cx="38" cy="34" rx="3" ry="2"/>
</g>`,
  },
  {
    id: 'avatar_57',
    label: 'Black Cat',
    category: 'animal',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<g fill="#1f2937" stroke="#000" stroke-width="0.6">
  <ellipse cx="30" cy="34" rx="14" ry="12"/>
  <polygon points="16,22 18,12 24,22"/>
  <polygon points="44,22 42,12 36,22"/>
</g>
<g fill="#fb7185">
  <polygon points="18,16 19,12 21,18"/>
  <polygon points="42,16 41,12 39,18"/>
</g>
<g fill="#22c55e">
  <ellipse cx="24" cy="30" rx="2.5" ry="3.5"/>
  <ellipse cx="36" cy="30" rx="2.5" ry="3.5"/>
</g>
<g fill="#1a1a1a">
  <ellipse cx="24" cy="30" rx="0.8" ry="3"/>
  <ellipse cx="36" cy="30" rx="0.8" ry="3"/>
</g>
<g fill="#fff">
  <circle cx="23" cy="29" r="0.5"/>
  <circle cx="35" cy="29" r="0.5"/>
</g>
<polygon points="30,38 28,40 32,40" fill="#fb7185"/>
<g stroke="#fff" stroke-width="0.5" fill="none">
  <line x1="14" y1="38" x2="22" y2="38"/>
  <line x1="14" y1="40" x2="22" y2="40"/>
  <line x1="38" y1="38" x2="46" y2="38"/>
  <line x1="38" y1="40" x2="46" y2="40"/>
</g>
<path d="M28 41 Q30 43 32 41" stroke="#fff" stroke-width="0.8" fill="none"/>
<path d="M30 40 L30 42" stroke="#fff" stroke-width="0.8"/>`,
  },
  {
    id: 'avatar_58',
    label: 'Songbird',
    category: 'animal',
    svg: `<rect width="60" height="60" rx="8" fill="#3b82f6"/>
<g fill="#fef3c7">
  <circle cx="14" cy="14" r="2"/>
  <circle cx="46" cy="14" r="1.5"/>
  <circle cx="50" cy="22" r="1"/>
</g>
<g fill="#fbbf24" stroke="#a87f1c" stroke-width="0.5">
  <ellipse cx="30" cy="36" rx="14" ry="11"/>
</g>
<g fill="#fb923c" stroke="#a87f1c" stroke-width="0.5">
  <circle cx="22" cy="28" r="9"/>
</g>
<polygon points="14,28 8,30 14,32" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.4"/>
<g fill="#1a1a1a">
  <circle cx="22" cy="26" r="1.6"/>
</g>
<g fill="#fff">
  <circle cx="22" cy="25.5" r="0.6"/>
</g>
<g fill="#fbbf24" opacity="0.7">
  <path d="M30 38 Q42 32 44 42 Q40 44 30 42 Z"/>
</g>
<path d="M40 28 Q44 24 48 26 Q46 30 42 30 Z" fill="#fbbf24" stroke="#a87f1c" stroke-width="0.4"/>
<g fill="#fef3c7" opacity="0.5">
  <ellipse cx="20" cy="22" rx="3" ry="2"/>
</g>
<g fill="#a87f1c">
  <rect x="26" y="46" width="2" height="6"/>
  <rect x="32" y="46" width="2" height="6"/>
  <path d="M24 52 L30 52 L28 54 Z"/>
  <path d="M30 52 L36 52 L32 54 Z"/>
</g>`,
  },
  {
    id: 'avatar_59',
    label: 'Sly Fox',
    category: 'animal',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<g fill="#ea580c" stroke="#7c2d12" stroke-width="0.6">
  <polygon points="30,16 18,28 22,40 38,40 42,28"/>
  <polygon points="14,12 22,28 18,16"/>
  <polygon points="46,12 38,28 42,16"/>
</g>
<g fill="#fef3c7">
  <polygon points="16,14 19,22 16,18"/>
  <polygon points="44,14 41,22 44,18"/>
  <polygon points="30,30 26,40 34,40"/>
</g>
<g fill="#1a1a1a">
  <circle cx="24" cy="28" r="1.4"/>
  <circle cx="36" cy="28" r="1.4"/>
</g>
<g fill="#fff">
  <circle cx="24" cy="27.5" r="0.5"/>
  <circle cx="36" cy="27.5" r="0.5"/>
</g>
<polygon points="30,34 28,36 32,36" fill="#1a1a1a"/>
<path d="M28 36 Q30 38 32 36" stroke="#1a1a1a" stroke-width="0.8" fill="none"/>
<g stroke="#fff" stroke-width="0.4" fill="none">
  <line x1="20" y1="32" x2="24" y2="32"/>
  <line x1="36" y1="32" x2="40" y2="32"/>
</g>
<path d="M40 40 Q50 44 52 54 Q42 50 38 44 Z" fill="#ea580c" stroke="#7c2d12" stroke-width="0.6"/>
<path d="M48 50 Q52 52 50 54 Q46 52 46 50 Z" fill="#fef3c7"/>`,
  },
  {
    id: 'avatar_60',
    label: 'Brown Bear',
    category: 'animal',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<g fill="#7c4a2c" stroke="#3a2010" stroke-width="0.6">
  <circle cx="16" cy="20" r="6"/>
  <circle cx="44" cy="20" r="6"/>
  <ellipse cx="30" cy="34" rx="16" ry="14"/>
</g>
<g fill="#fbbf24" opacity="0.5">
  <circle cx="16" cy="20" r="3"/>
  <circle cx="44" cy="20" r="3"/>
</g>
<ellipse cx="30" cy="40" rx="9" ry="7" fill="#fef3c7"/>
<g fill="#1a1a1a">
  <circle cx="24" cy="30" r="1.6"/>
  <circle cx="36" cy="30" r="1.6"/>
  <ellipse cx="30" cy="38" rx="3" ry="2.5"/>
</g>
<g fill="#fff">
  <circle cx="24" cy="29.5" r="0.5"/>
  <circle cx="36" cy="29.5" r="0.5"/>
</g>
<path d="M30 40 L30 43 M27 43 Q30 46 33 43" stroke="#1a1a1a" stroke-width="0.8" fill="none"/>
<g fill="#7c4a2c" opacity="0.6">
  <ellipse cx="22" cy="36" rx="3" ry="2"/>
  <ellipse cx="38" cy="36" rx="3" ry="2"/>
</g>`,
  },
  {
    id: 'avatar_61',
    label: 'Wise Owl',
    category: 'animal',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<g fill="#7c4a2c" stroke="#3a2010" stroke-width="0.6">
  <ellipse cx="30" cy="34" rx="16" ry="18"/>
  <polygon points="14,18 20,12 22,22"/>
  <polygon points="46,18 40,12 38,22"/>
</g>
<g fill="#fef3c7" stroke="#a87f1c" stroke-width="0.5">
  <circle cx="22" cy="28" r="7"/>
  <circle cx="38" cy="28" r="7"/>
</g>
<g fill="#1a1a1a">
  <circle cx="22" cy="28" r="4"/>
  <circle cx="38" cy="28" r="4"/>
</g>
<g fill="#fbbf24">
  <circle cx="22" cy="28" r="2.5"/>
  <circle cx="38" cy="28" r="2.5"/>
</g>
<g fill="#1a1a1a">
  <circle cx="22" cy="28" r="1.2"/>
  <circle cx="38" cy="28" r="1.2"/>
</g>
<g fill="#fff">
  <circle cx="21" cy="27" r="0.5"/>
  <circle cx="37" cy="27" r="0.5"/>
</g>
<polygon points="30,32 27,37 33,37" fill="#ea580c" stroke="#7c2d12" stroke-width="0.4"/>
<g fill="#5a3520">
  <ellipse cx="20" cy="42" rx="3" ry="2.5"/>
  <ellipse cx="40" cy="42" rx="3" ry="2.5"/>
  <ellipse cx="30" cy="46" rx="3" ry="2.5"/>
</g>
<g fill="#3a2010">
  <ellipse cx="24" cy="38" rx="2" ry="1.5"/>
  <ellipse cx="36" cy="38" rx="2" ry="1.5"/>
  <ellipse cx="26" cy="44" rx="2" ry="1.5"/>
  <ellipse cx="34" cy="44" rx="2" ry="1.5"/>
</g>
<g fill="#fef3c7">
  <ellipse cx="22" cy="20" rx="2" ry="3"/>
</g>`,
  },
  {
    id: 'avatar_62',
    label: 'Forest Deer',
    category: 'animal',
    svg: `<rect width="60" height="60" rx="8" fill="#1B4332"/>
<g fill="#a47148" stroke="#5a3520" stroke-width="0.6">
  <ellipse cx="30" cy="36" rx="12" ry="14"/>
</g>
<g stroke="#3a2010" stroke-width="1.4" fill="none">
  <path d="M22 18 L18 8"/>
  <path d="M20 14 L14 10"/>
  <path d="M18 16 L14 14"/>
  <path d="M19 12 L20 18"/>
  <path d="M38 18 L42 8"/>
  <path d="M40 14 L46 10"/>
  <path d="M42 16 L46 14"/>
  <path d="M41 12 L40 18"/>
</g>
<g fill="#fef3c7">
  <circle cx="22" cy="32" r="1"/>
  <circle cx="36" cy="34" r="1"/>
  <circle cx="28" cy="40" r="1"/>
  <circle cx="34" cy="46" r="1"/>
  <circle cx="24" cy="44" r="1"/>
</g>
<g fill="#1a1a1a">
  <circle cx="24" cy="28" r="1.4"/>
  <circle cx="36" cy="28" r="1.4"/>
  <ellipse cx="30" cy="36" rx="2" ry="1.5"/>
</g>
<g fill="#fff">
  <circle cx="24" cy="27.5" r="0.4"/>
  <circle cx="36" cy="27.5" r="0.4"/>
</g>
<path d="M28 38 Q30 40 32 38" stroke="#1a1a1a" stroke-width="0.6" fill="none"/>
<g fill="#7c4a2c" opacity="0.6">
  <ellipse cx="20" cy="32" rx="3" ry="4"/>
  <ellipse cx="40" cy="32" rx="3" ry="4"/>
</g>`,
  },

  // ─── NATURE (63–70) ──────────────────────────────────────────────────────
  {
    id: 'avatar_63',
    label: 'Lightning Bolt',
    category: 'nature',
    svg: `<rect width="60" height="60" rx="8" fill="#1e3a8a"/>
<g fill="#fbbf24" stroke="#a87f1c" stroke-width="0.8">
  <polygon points="32,4 14,32 26,32 22,56 46,24 32,24"/>
</g>
<g fill="#fef3c7" opacity="0.6">
  <polygon points="30,8 22,28 28,28 24,42 38,24 30,24"/>
</g>
<g fill="#fff" opacity="0.8">
  <circle cx="10" cy="10" r="0.8"/>
  <circle cx="50" cy="14" r="0.8"/>
  <circle cx="48" cy="40" r="0.6"/>
  <circle cx="8" cy="44" r="1"/>
  <circle cx="14" cy="50" r="0.6"/>
</g>
<g stroke="#fff" stroke-width="0.5" fill="none" opacity="0.4">
  <path d="M8 30 Q4 30 6 32"/>
  <path d="M52 32 Q56 32 54 34"/>
</g>`,
  },
  {
    id: 'avatar_64',
    label: 'Bright Star',
    category: 'nature',
    svg: `<rect width="60" height="60" rx="8" fill="#1e1b4b"/>
<polygon points="30,6 36,22 54,22 39,32 45,50 30,40 15,50 21,32 6,22 24,22" fill="#fbbf24" stroke="#a87f1c" stroke-width="0.8"/>
<polygon points="30,12 34,24 46,24 36,32 40,44 30,38 20,44 24,32 14,24 26,24" fill="#fef3c7" opacity="0.6"/>
<g fill="#fff" opacity="0.9">
  <circle cx="10" cy="10" r="1"/>
  <circle cx="50" cy="12" r="1.2"/>
  <circle cx="14" cy="48" r="0.8"/>
  <circle cx="48" cy="50" r="1"/>
  <circle cx="8" cy="32" r="0.6"/>
  <circle cx="52" cy="36" r="0.6"/>
</g>
<g stroke="#fff" stroke-width="0.4" fill="none" opacity="0.6">
  <line x1="48" y1="8" x2="52" y2="12"/>
  <line x1="10" y1="48" x2="14" y2="52"/>
</g>
<polygon points="30,20 32,26 38,26 33,30 35,36 30,32 25,36 27,30 22,26 28,26" fill="#fff" opacity="0.5"/>`,
  },
  {
    id: 'avatar_65',
    label: 'Crescent Moon',
    category: 'nature',
    svg: `<rect width="60" height="60" rx="8" fill="#1e1b4b"/>
<g fill="#fef3c7">
  <circle cx="50" cy="10" r="1.2"/>
  <circle cx="46" cy="20" r="0.8"/>
  <circle cx="10" cy="14" r="1"/>
  <circle cx="6" cy="34" r="0.7"/>
  <circle cx="52" cy="44" r="1"/>
  <circle cx="14" cy="50" r="0.6"/>
  <circle cx="48" cy="32" r="0.6"/>
</g>
<g stroke="#fef3c7" stroke-width="0.4" fill="none" opacity="0.6">
  <line x1="8" y1="12" x2="12" y2="16"/>
  <line x1="48" y1="42" x2="56" y2="46"/>
</g>
<path d="M40 12 Q26 14 22 32 Q22 50 40 52 Q26 50 24 32 Q26 16 40 12 Z" fill="#fef3c7" stroke="#a87f1c" stroke-width="0.6"/>
<g fill="#a87f1c" opacity="0.5">
  <circle cx="28" cy="22" r="2"/>
  <circle cx="34" cy="36" r="3"/>
  <circle cx="30" cy="48" r="1.5"/>
</g>
<g fill="#fef3c7" opacity="0.4">
  <ellipse cx="30" cy="20" rx="2" ry="1"/>
</g>`,
  },
  {
    id: 'avatar_66',
    label: 'Smiling Sun',
    category: 'nature',
    svg: `<rect width="60" height="60" rx="8" fill="#3b82f6"/>
<g fill="#fbbf24" stroke="#a87f1c" stroke-width="0.6">
  <polygon points="30,2 33,12 27,12"/>
  <polygon points="30,58 33,48 27,48"/>
  <polygon points="58,30 48,33 48,27"/>
  <polygon points="2,30 12,33 12,27"/>
  <polygon points="50,10 44,16 40,12"/>
  <polygon points="10,10 16,16 20,12"/>
  <polygon points="50,50 44,44 40,48"/>
  <polygon points="10,50 16,44 20,48"/>
</g>
<circle cx="30" cy="30" r="14" fill="#fbbf24" stroke="#a87f1c" stroke-width="1"/>
<circle cx="30" cy="30" r="10" fill="#fef3c7" opacity="0.5"/>
<g fill="#1a1a1a">
  <circle cx="25" cy="28" r="1.2"/>
  <circle cx="35" cy="28" r="1.2"/>
</g>
<g fill="#fff">
  <circle cx="25" cy="27.5" r="0.4"/>
  <circle cx="35" cy="27.5" r="0.4"/>
</g>
<path d="M24 33 Q30 38 36 33" stroke="#1a1a1a" stroke-width="1" fill="none"/>
<g fill="#fb7185" opacity="0.6">
  <ellipse cx="22" cy="33" rx="2.5" ry="1.5"/>
  <ellipse cx="38" cy="33" rx="2.5" ry="1.5"/>
</g>`,
  },
  {
    id: 'avatar_67',
    label: 'Rainbow',
    category: 'nature',
    svg: `<rect width="60" height="60" rx="8" fill="#3b82f6"/>
<g fill="none" stroke-width="3.6">
  <path d="M6 50 Q30 14 54 50" stroke="#dc2626"/>
  <path d="M9 50 Q30 18 51 50" stroke="#ea580c"/>
  <path d="M12 50 Q30 22 48 50" stroke="#fbbf24"/>
  <path d="M15 50 Q30 26 45 50" stroke="#22c55e"/>
  <path d="M18 50 Q30 30 42 50" stroke="#3b82f6"/>
  <path d="M21 50 Q30 34 39 50" stroke="#a855f7"/>
</g>
<g fill="#fff">
  <ellipse cx="10" cy="48" rx="6" ry="3" opacity="0.9"/>
  <ellipse cx="50" cy="48" rx="6" ry="3" opacity="0.9"/>
</g>
<g fill="#e5e7eb">
  <ellipse cx="8" cy="50" rx="4" ry="2"/>
  <ellipse cx="52" cy="50" rx="4" ry="2"/>
</g>
<g fill="#fef3c7" opacity="0.8">
  <circle cx="46" cy="14" r="3"/>
  <polygon points="46,7 47,11 51,11 48,14 49,18 46,16 43,18 44,14 41,11 45,11"/>
</g>
<g fill="#fff">
  <circle cx="14" cy="14" r="0.8"/>
  <circle cx="38" cy="22" r="0.6"/>
  <circle cx="22" cy="20" r="0.6"/>
</g>`,
  },
  {
    id: 'avatar_68',
    label: 'Snowflake',
    category: 'nature',
    svg: `<rect width="60" height="60" rx="8" fill="#1e3a8a"/>
<g stroke="#fef3c7" stroke-width="1.4" fill="none">
  <line x1="30" y1="6" x2="30" y2="54"/>
  <line x1="6" y1="30" x2="54" y2="30"/>
  <line x1="13" y1="13" x2="47" y2="47"/>
  <line x1="13" y1="47" x2="47" y2="13"/>
</g>
<g stroke="#fef3c7" stroke-width="1" fill="none">
  <path d="M30 12 L26 16 M30 12 L34 16"/>
  <path d="M30 48 L26 44 M30 48 L34 44"/>
  <path d="M12 30 L16 26 M12 30 L16 34"/>
  <path d="M48 30 L44 26 M48 30 L44 34"/>
  <path d="M16 16 L18 20 M16 16 L20 18"/>
  <path d="M44 44 L42 40 M44 44 L40 42"/>
  <path d="M16 44 L20 42 M16 44 L18 40"/>
  <path d="M44 16 L40 18 M44 16 L42 20"/>
</g>
<g fill="#fff">
  <circle cx="30" cy="30" r="3"/>
  <circle cx="30" cy="14" r="1.5"/>
  <circle cx="30" cy="46" r="1.5"/>
  <circle cx="14" cy="30" r="1.5"/>
  <circle cx="46" cy="30" r="1.5"/>
</g>
<g fill="#3b82f6">
  <circle cx="30" cy="30" r="1.4"/>
</g>
<g fill="#fff" opacity="0.9">
  <circle cx="10" cy="10" r="0.8"/>
  <circle cx="50" cy="12" r="0.6"/>
  <circle cx="8" cy="50" r="0.6"/>
  <circle cx="52" cy="48" r="0.8"/>
</g>`,
  },
  {
    id: 'avatar_69',
    label: 'Rain Cloud',
    category: 'nature',
    svg: `<rect width="60" height="60" rx="8" fill="#3b82f6"/>
<g fill="#fef3c7" opacity="0.9">
  <circle cx="50" cy="10" r="3"/>
  <polygon points="50,4 51,8 55,8 52,11 53,16 50,13 47,16 48,11 45,8 49,8"/>
</g>
<g fill="#fff" stroke="#9ca3af" stroke-width="0.6">
  <ellipse cx="20" cy="30" rx="10" ry="9"/>
  <ellipse cx="36" cy="26" rx="11" ry="10"/>
  <ellipse cx="40" cy="34" rx="9" ry="7"/>
  <ellipse cx="28" cy="34" rx="10" ry="6"/>
</g>
<g fill="#e5e7eb" opacity="0.7">
  <ellipse cx="26" cy="34" rx="14" ry="3"/>
</g>
<g stroke="#bfdbfe" stroke-width="2" fill="none" stroke-linecap="round">
  <line x1="20" y1="44" x2="18" y2="50"/>
  <line x1="28" y1="44" x2="26" y2="52"/>
  <line x1="36" y1="44" x2="34" y2="50"/>
  <line x1="42" y1="44" x2="40" y2="52"/>
</g>
<g fill="#bfdbfe">
  <ellipse cx="18" cy="52" rx="1" ry="1.5"/>
  <ellipse cx="26" cy="54" rx="1" ry="1.5"/>
  <ellipse cx="34" cy="52" rx="1" ry="1.5"/>
  <ellipse cx="40" cy="54" rx="1" ry="1.5"/>
</g>`,
  },
  {
    id: 'avatar_70',
    label: 'Palm Tree',
    category: 'nature',
    svg: `<rect width="60" height="60" rx="8" fill="#fbbf24"/>
<rect x="0" y="46" width="60" height="14" fill="#fde68a"/>
<g stroke="#3b82f6" stroke-width="0.4" fill="none" opacity="0.6">
  <path d="M0 50 Q10 48 20 50"/>
  <path d="M40 52 Q50 50 60 52"/>
</g>
<g fill="#7c4a2c" stroke="#3a2010" stroke-width="0.6">
  <path d="M28 14 Q26 30 28 50 L32 50 Q34 30 32 14 Z"/>
</g>
<g stroke="#5a3520" stroke-width="0.4" fill="none">
  <path d="M28 22 Q30 24 32 22"/>
  <path d="M28 30 Q30 32 32 30"/>
  <path d="M28 38 Q30 40 32 38"/>
</g>
<g fill="#16a34a" stroke="#14532d" stroke-width="0.4">
  <path d="M30 14 Q14 8 8 18 Q18 14 30 18 Z"/>
  <path d="M30 14 Q46 8 52 18 Q42 14 30 18 Z"/>
  <path d="M30 14 Q14 16 6 28 Q18 20 30 20 Z"/>
  <path d="M30 14 Q46 16 54 28 Q42 20 30 20 Z"/>
  <path d="M30 12 Q24 4 16 6 Q24 10 30 16 Z"/>
  <path d="M30 12 Q36 4 44 6 Q36 10 30 16 Z"/>
</g>
<g fill="#7c2d12">
  <circle cx="28" cy="16" r="1.2"/>
  <circle cx="32" cy="16" r="1.2"/>
  <circle cx="30" cy="18" r="1.2"/>
</g>
<circle cx="48" cy="10" r="3" fill="#fef3c7" opacity="0.9"/>
<circle cx="48" cy="10" r="5" fill="none" stroke="#fef3c7" stroke-width="0.4" opacity="0.6"/>`,
  },

  // ─── FUN EXTENDED (71–80) ────────────────────────────────────────────────
  {
    id: 'avatar_71',
    label: 'Rocket Ship',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#0f172a"/>
<g fill="#fff">
  <circle cx="10" cy="10" r="0.8"/>
  <circle cx="48" cy="14" r="1"/>
  <circle cx="8" cy="32" r="0.6"/>
  <circle cx="52" cy="40" r="0.8"/>
  <circle cx="12" cy="50" r="0.6"/>
</g>
<g fill="#e5e7eb" stroke="#6b7280" stroke-width="0.6">
  <path d="M30 6 Q22 18 22 36 L22 42 L38 42 L38 36 Q38 18 30 6 Z"/>
</g>
<g fill="#dc2626" stroke="#7f1d1d" stroke-width="0.5">
  <path d="M22 30 L14 38 L14 44 L22 42 Z"/>
  <path d="M38 30 L46 38 L46 44 L38 42 Z"/>
</g>
<circle cx="30" cy="22" r="4" fill="#3b82f6" stroke="#1e3a8a" stroke-width="0.6"/>
<circle cx="30" cy="22" r="2.5" fill="#bfdbfe"/>
<circle cx="29" cy="21" r="0.8" fill="#fff"/>
<rect x="26" y="32" width="8" height="2" fill="#1a1a1a"/>
<g fill="#fbbf24">
  <path d="M26 42 L24 50 L28 46 Z"/>
  <path d="M30 42 L28 54 L32 50 Z"/>
  <path d="M34 42 L32 50 L36 46 Z"/>
</g>
<g fill="#dc2626">
  <path d="M28 42 L26 48 L30 44 Z"/>
  <path d="M32 42 L30 48 L34 44 Z"/>
</g>
<g fill="#fef3c7" opacity="0.6">
  <ellipse cx="26" cy="20" rx="1.5" ry="3"/>
</g>`,
  },
  {
    id: 'avatar_72',
    label: 'Royal Crown',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<g fill="#C9A84C" stroke="#a87f1c" stroke-width="0.8">
  <path d="M10 24 L18 38 L26 18 L30 38 L34 18 L42 38 L50 24 L48 50 L12 50 Z"/>
</g>
<rect x="12" y="46" width="36" height="4" fill="#a87f1c"/>
<g fill="#dc2626">
  <circle cx="18" cy="40" r="2"/>
  <circle cx="42" cy="40" r="2"/>
</g>
<g fill="#3b82f6">
  <circle cx="30" cy="40" r="2.4"/>
</g>
<g fill="#22c55e">
  <circle cx="24" cy="38" r="1.6"/>
  <circle cx="36" cy="38" r="1.6"/>
</g>
<g fill="#fef3c7">
  <circle cx="10" cy="24" r="2"/>
  <circle cx="50" cy="24" r="2"/>
  <circle cx="26" cy="18" r="1.4"/>
  <circle cx="34" cy="18" r="1.4"/>
  <circle cx="30" cy="14" r="1.6"/>
</g>
<g fill="#fef3c7" opacity="0.5">
  <ellipse cx="22" cy="32" rx="2" ry="4"/>
</g>
<g fill="#fef3c7" opacity="0.6">
  <circle cx="50" cy="12" r="0.8"/>
  <circle cx="14" cy="14" r="0.6"/>
</g>`,
  },
  {
    id: 'avatar_73',
    label: 'Diamond Gem',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<g fill="#a3a8b1" stroke="#6b7280" stroke-width="0.5">
  <polygon points="14,22 22,12 38,12 46,22 30,52"/>
</g>
<g fill="#fef3c7">
  <polygon points="14,22 22,12 30,22"/>
  <polygon points="22,12 38,12 30,22"/>
  <polygon points="38,12 46,22 30,22"/>
</g>
<g stroke="#6b7280" stroke-width="0.4" fill="none">
  <line x1="14" y1="22" x2="46" y2="22"/>
  <line x1="22" y1="12" x2="30" y2="22"/>
  <line x1="38" y1="12" x2="30" y2="22"/>
  <line x1="14" y1="22" x2="30" y2="52"/>
  <line x1="46" y1="22" x2="30" y2="52"/>
  <line x1="30" y1="22" x2="30" y2="52"/>
</g>
<g fill="#bfdbfe" opacity="0.7">
  <polygon points="22,12 26,12 24,18"/>
  <polygon points="30,22 30,32 26,26"/>
</g>
<g fill="#fff" opacity="0.9">
  <polygon points="22,14 24,14 23,17"/>
  <circle cx="35" cy="30" r="0.8"/>
</g>
<g stroke="#fef3c7" stroke-width="0.4" fill="none" opacity="0.6">
  <line x1="6" y1="20" x2="10" y2="22"/>
  <line x1="50" y1="22" x2="54" y2="20"/>
  <line x1="30" y1="6" x2="30" y2="10"/>
</g>`,
  },
  {
    id: 'avatar_74',
    label: 'Roaring Fire',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<path d="M30 6 Q20 16 22 28 Q14 22 12 32 Q10 46 22 52 Q26 46 30 50 Q34 46 38 52 Q50 46 48 32 Q46 22 38 28 Q40 16 30 6 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.6"/>
<path d="M30 14 Q24 22 26 32 Q20 28 20 38 Q20 46 28 50 Q30 44 30 50 Q30 44 32 50 Q40 46 40 38 Q40 28 34 32 Q36 22 30 14 Z" fill="#ea580c"/>
<path d="M30 22 Q26 28 28 36 Q24 32 24 40 Q24 46 30 48 Q30 42 32 48 Q36 46 36 40 Q36 32 32 36 Q34 28 30 22 Z" fill="#fbbf24"/>
<path d="M30 32 Q28 36 30 42 Q32 36 30 32 Z" fill="#fef3c7"/>
<g fill="#fef3c7" opacity="0.8">
  <circle cx="22" cy="22" r="0.6"/>
  <circle cx="38" cy="22" r="0.6"/>
  <circle cx="14" cy="34" r="0.4"/>
  <circle cx="46" cy="34" r="0.4"/>
</g>`,
  },
  {
    id: 'avatar_75',
    label: 'Music Notes',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#a855f7"/>
<g fill="#1a1a1a" stroke="#000" stroke-width="0.5">
  <ellipse cx="20" cy="44" rx="6" ry="4" transform="rotate(-20 20 44)"/>
  <ellipse cx="44" cy="40" rx="6" ry="4" transform="rotate(-20 44 40)"/>
  <rect x="22" y="14" width="2.5" height="30"/>
  <rect x="46" y="10" width="2.5" height="30"/>
  <path d="M22 14 Q34 8 48 10 L48 18 Q34 16 22 22 Z"/>
</g>
<g fill="#fef3c7" opacity="0.5">
  <ellipse cx="18" cy="42" rx="2" ry="1" transform="rotate(-20 18 42)"/>
  <ellipse cx="42" cy="38" rx="2" ry="1" transform="rotate(-20 42 38)"/>
</g>
<g fill="#fff" opacity="0.6">
  <circle cx="10" cy="10" r="1"/>
  <circle cx="52" cy="50" r="1.2"/>
  <circle cx="14" cy="50" r="0.8"/>
  <circle cx="50" cy="14" r="0.8"/>
</g>
<g stroke="#fff" stroke-width="0.4" fill="none" opacity="0.5">
  <path d="M6 26 Q12 24 18 26"/>
  <path d="M50 30 Q54 28 56 30"/>
</g>`,
  },
  {
    id: 'avatar_76',
    label: 'Pizza Slice',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<polygon points="30,6 8,52 52,52" fill="#fbbf24" stroke="#a87f1c" stroke-width="0.8"/>
<polygon points="30,12 14,48 46,48" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.4"/>
<g fill="#fef3c7" opacity="0.7">
  <ellipse cx="26" cy="22" rx="2" ry="2.5"/>
  <ellipse cx="34" cy="32" rx="2.5" ry="2"/>
  <ellipse cx="22" cy="36" rx="2" ry="2.5"/>
  <ellipse cx="38" cy="44" rx="2" ry="2"/>
  <ellipse cx="30" cy="42" rx="2" ry="2"/>
</g>
<g fill="#7c2d12">
  <circle cx="24" cy="28" r="1.4"/>
  <circle cx="32" cy="22" r="1.2"/>
  <circle cx="36" cy="38" r="1.4"/>
  <circle cx="20" cy="44" r="1.2"/>
  <circle cx="42" cy="46" r="1.4"/>
  <circle cx="28" cy="36" r="1.2"/>
  <circle cx="32" cy="46" r="1.2"/>
</g>
<g fill="#16a34a">
  <ellipse cx="28" cy="32" rx="0.8" ry="1.2"/>
  <ellipse cx="36" cy="28" rx="0.8" ry="1.2"/>
  <ellipse cx="26" cy="42" rx="0.8" ry="1.2"/>
</g>
<g fill="#a87f1c" opacity="0.6">
  <ellipse cx="30" cy="50" rx="20" ry="3"/>
</g>`,
  },
  {
    id: 'avatar_77',
    label: 'Loaded Taco',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<path d="M6 24 Q30 8 54 24 Q54 50 50 50 Q30 38 10 50 Q6 50 6 24 Z" fill="#fbbf24" stroke="#a87f1c" stroke-width="0.8"/>
<path d="M6 24 Q30 8 54 24 L54 28 Q30 14 6 28 Z" fill="#a87f1c"/>
<g fill="#16a34a">
  <ellipse cx="14" cy="32" rx="3" ry="2"/>
  <ellipse cx="22" cy="30" rx="3" ry="2"/>
  <ellipse cx="30" cy="32" rx="3" ry="2"/>
  <ellipse cx="38" cy="30" rx="3" ry="2"/>
  <ellipse cx="46" cy="32" rx="3" ry="2"/>
</g>
<g fill="#7c4a2c">
  <ellipse cx="18" cy="36" rx="3" ry="1.5"/>
  <ellipse cx="26" cy="36" rx="3" ry="1.5"/>
  <ellipse cx="34" cy="36" rx="3" ry="1.5"/>
  <ellipse cx="42" cy="36" rx="3" ry="1.5"/>
</g>
<g fill="#dc2626">
  <ellipse cx="14" cy="40" rx="2" ry="1.5"/>
  <ellipse cx="22" cy="40" rx="2" ry="1.5"/>
  <ellipse cx="30" cy="40" rx="2" ry="1.5"/>
  <ellipse cx="38" cy="40" rx="2" ry="1.5"/>
  <ellipse cx="46" cy="40" rx="2" ry="1.5"/>
</g>
<g fill="#fef3c7">
  <rect x="16" y="42" width="4" height="2" rx="0.5"/>
  <rect x="24" y="44" width="4" height="2" rx="0.5"/>
  <rect x="32" y="42" width="4" height="2" rx="0.5"/>
  <rect x="40" y="44" width="4" height="2" rx="0.5"/>
</g>
<g fill="#fef3c7" opacity="0.5">
  <ellipse cx="20" cy="22" rx="3" ry="1.5"/>
</g>`,
  },
  {
    id: 'avatar_78',
    label: 'Cheeseburger',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<path d="M8 26 Q8 14 30 14 Q52 14 52 26 L8 26 Z" fill="#a47148" stroke="#5a3520" stroke-width="0.6"/>
<g fill="#fef3c7" opacity="0.6">
  <circle cx="18" cy="20" r="1"/>
  <circle cx="26" cy="18" r="1"/>
  <circle cx="34" cy="22" r="1"/>
  <circle cx="42" cy="20" r="1"/>
</g>
<rect x="6" y="26" width="48" height="3" fill="#16a34a"/>
<rect x="6" y="29" width="48" height="3" fill="#fbbf24"/>
<rect x="6" y="32" width="48" height="3" fill="#dc2626"/>
<rect x="6" y="35" width="48" height="4" fill="#7c2d12" stroke="#3a2010" stroke-width="0.4"/>
<rect x="6" y="39" width="48" height="2" fill="#fef3c7"/>
<path d="M6 41 Q6 50 30 50 Q54 50 54 41 L6 41 Z" fill="#a47148" stroke="#5a3520" stroke-width="0.6"/>
<g fill="#fef3c7" opacity="0.5">
  <ellipse cx="20" cy="18" rx="3" ry="2"/>
</g>`,
  },
  {
    id: 'avatar_79',
    label: 'Triple Scoop',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#fb7185"/>
<path d="M22 30 L30 56 L38 30 Z" fill="#a47148" stroke="#5a3520" stroke-width="0.4"/>
<g stroke="#5a3520" stroke-width="0.3" fill="none">
  <line x1="24" y1="34" x2="36" y2="34"/>
  <line x1="25" y1="40" x2="35" y2="40"/>
  <line x1="26" y1="46" x2="34" y2="46"/>
  <line x1="22" y1="30" x2="38" y2="30"/>
  <line x1="30" y1="30" x2="30" y2="56"/>
</g>
<circle cx="30" cy="22" r="10" fill="#fef3c7" stroke="#a87f1c" stroke-width="0.6"/>
<circle cx="22" cy="14" r="8" fill="#fb7185" stroke="#9f1239" stroke-width="0.6"/>
<circle cx="38" cy="14" r="8" fill="#7c4a2c" stroke="#3a2010" stroke-width="0.6"/>
<g fill="#fef3c7" opacity="0.5">
  <ellipse cx="18" cy="10" rx="2.5" ry="2"/>
  <ellipse cx="34" cy="10" rx="2.5" ry="2"/>
  <ellipse cx="26" cy="18" rx="2" ry="1.5"/>
</g>
<g fill="#dc2626">
  <circle cx="30" cy="6" r="2"/>
</g>
<g fill="#16a34a">
  <path d="M28 6 Q26 4 28 2 Q30 4 28 6 Z"/>
</g>
<g fill="#fbbf24">
  <circle cx="22" cy="18" r="0.6"/>
  <circle cx="38" cy="18" r="0.6"/>
  <circle cx="30" cy="24" r="0.6"/>
  <circle cx="14" cy="14" r="0.5"/>
  <circle cx="46" cy="14" r="0.5"/>
</g>`,
  },
  {
    id: 'avatar_80',
    label: 'Sprinkle Donut',
    category: 'fun',
    svg: `<rect width="60" height="60" rx="8" fill="#1a1a1a"/>
<circle cx="30" cy="30" r="22" fill="#a47148" stroke="#5a3520" stroke-width="0.8"/>
<path d="M30 8 Q14 14 8 30 Q14 16 30 12 Z" fill="#fb7185" stroke="#9f1239" stroke-width="0.6"/>
<path d="M30 8 Q46 14 52 30 Q46 16 30 12 Z" fill="#fb7185" stroke="#9f1239" stroke-width="0.6"/>
<path d="M8 30 Q14 46 30 52 Q16 46 12 30 Z" fill="#fb7185" stroke="#9f1239" stroke-width="0.6"/>
<path d="M52 30 Q46 46 30 52 Q44 46 48 30 Z" fill="#fb7185" stroke="#9f1239" stroke-width="0.6"/>
<circle cx="30" cy="30" r="8" fill="#1a1a1a"/>
<g fill="#fbbf24">
  <rect x="14" y="14" width="3" height="1.4" rx="0.4" transform="rotate(30 14 14)"/>
  <rect x="44" y="14" width="3" height="1.4" rx="0.4" transform="rotate(-30 44 14)"/>
  <rect x="44" y="44" width="3" height="1.4" rx="0.4" transform="rotate(30 44 44)"/>
  <rect x="14" y="44" width="3" height="1.4" rx="0.4" transform="rotate(-30 14 44)"/>
</g>
<g fill="#3b82f6">
  <rect x="22" y="10" width="3" height="1.4" rx="0.4"/>
  <rect x="36" y="48" width="3" height="1.4" rx="0.4"/>
  <rect x="48" y="22" width="3" height="1.4" rx="0.4" transform="rotate(90 48 22)"/>
  <rect x="10" y="38" width="3" height="1.4" rx="0.4" transform="rotate(90 10 38)"/>
</g>
<g fill="#fef3c7">
  <rect x="36" y="14" width="3" height="1.4" rx="0.4" transform="rotate(60 36 14)"/>
  <rect x="20" y="44" width="3" height="1.4" rx="0.4" transform="rotate(-60 20 44)"/>
  <rect x="44" y="34" width="3" height="1.4" rx="0.4" transform="rotate(-30 44 34)"/>
  <rect x="14" y="22" width="3" height="1.4" rx="0.4" transform="rotate(60 14 22)"/>
</g>
<g fill="#dc2626">
  <rect x="28" y="44" width="3" height="1.4" rx="0.4"/>
  <rect x="40" y="20" width="3" height="1.4" rx="0.4" transform="rotate(45 40 20)"/>
</g>
<g fill="#22c55e">
  <rect x="20" y="22" width="3" height="1.4" rx="0.4" transform="rotate(-30 20 22)"/>
  <rect x="38" y="36" width="3" height="1.4" rx="0.4" transform="rotate(120 38 36)"/>
</g>
<g fill="#fef3c7" opacity="0.4">
  <ellipse cx="20" cy="20" rx="3" ry="2"/>
</g>`,
  },
]

const FALLBACK_AVATAR: Avatar = AVATARS[0]

export function getAvatar(id: string | null | undefined): Avatar {
  if (!id) return FALLBACK_AVATAR
  return AVATARS.find(a => a.id === id) ?? FALLBACK_AVATAR
}

function sampleAvatars(count: number, exclude?: Set<string>): Avatar[] {
  const pool = exclude && exclude.size > 0
    ? AVATARS.filter(a => !exclude.has(a.id))
    : AVATARS
  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, count)
}

/**
 * Hook for paged avatar pickers: shows `count` random avatars, with shuffle and
 * "see all" controls. The currently-selected avatar is forced into the visible
 * slice so users can always see what they have selected.
 *
 * `excludeIds` filters avatars out of the random sample (used by /join to
 * keep already-claimed avatars from appearing in the selection pool). The
 * "see all" expanded view still returns every avatar so the caller can mark
 * taken ones with their own UI; in random-sample mode they're hidden outright.
 */
export function useAvatarSampler(options: {
  currentId?: string | null
  count?: number
  excludeIds?: string[]
} = {}) {
  const { currentId = null, count = 12, excludeIds } = options
  // Stable key for the exclude set — change identity only when the actual
  // contents differ, so the resample effect doesn't fire on every render.
  const excludeKey = (excludeIds ?? []).slice().sort().join(',')
  const excludeSet = React.useMemo(
    () => new Set(excludeIds ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [excludeKey],
  )
  const [expanded, setExpanded] = React.useState(false)
  const [base, setBase] = React.useState<Avatar[]>(() => sampleAvatars(count, excludeSet))

  // Re-sample when the excluded set changes and the current sample contains
  // anything that was just taken — replace stale picks with fresh ones from
  // the still-available pool.
  React.useEffect(() => {
    // Functional setState here is the right shape: we need the previous
    // sample to decide if anything is stale. Disable the lint rule because
    // the set-state-in-effect pattern is intentional sync from external prop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBase(prev => {
      const stale = prev.some(a => excludeSet.has(a.id))
      if (!stale) return prev
      const kept = prev.filter(a => !excludeSet.has(a.id))
      const fresh = sampleAvatars(count, excludeSet)
      const merged: Avatar[] = [...kept]
      for (const a of fresh) {
        if (merged.length >= count) break
        if (!merged.some(b => b.id === a.id)) merged.push(a)
      }
      return merged.slice(0, count)
    })
  }, [excludeSet, count])

  const visible = React.useMemo(() => {
    if (expanded) return AVATARS
    if (!currentId || base.some(a => a.id === currentId)) return base
    const cur = AVATARS.find(a => a.id === currentId)
    if (!cur) return base
    return [cur, ...base.slice(0, count - 1)]
  }, [base, currentId, expanded, count])

  return {
    visible,
    expanded,
    expand: () => setExpanded(true),
    collapse: () => setExpanded(false),
    shuffle: () => setBase(sampleAvatars(count, excludeSet)),
    /** Pool size after excludes — drives the "See all N" label so the count
     *  matches what the player can actually choose from. */
    total: AVATARS.length - excludeSet.size,
  }
}

type AvatarIconProps = {
  /** Avatar id (e.g. "avatar_07"). Unknown ids fall back to the first avatar. */
  id?: string | null
  className?: string
  /** Override the rendered title/aria-label if you don't want the default avatar name. */
  title?: string
} & Omit<React.SVGProps<SVGSVGElement>, 'id' | 'className' | 'children' | 'dangerouslySetInnerHTML'>

/**
 * Renders an avatar as a self-contained SVG.
 * Inject into a regular DOM tree with `<AvatarIcon id={...} className="w-10 h-10"/>`.
 * For embedding inside a parent SVG (e.g. the track), use the markup directly:
 *   <svg viewBox="0 0 60 60" dangerouslySetInnerHTML={{__html: getAvatar(id).svg}}/>
 */
export function AvatarIcon({ id, className, title, ...rest }: AvatarIconProps) {
  const av = getAvatar(id)
  return (
    <svg
      {...rest}
      viewBox="0 0 60 60"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title ?? av.label}
      dangerouslySetInnerHTML={{ __html: av.svg }}
    />
  )
}
