/**
 * VocabuLab colour system — derived from Lex, the lab-coat mascot.
 *
 *   Lex's hair & glasses glow  → primary   (brand blue #1A80FF)
 *   Lex's eyebrows             → primary[100] (blue mist)
 *   Lex's frames, tie & suit   → neutral[800–900] (lab ink)
 *   Lex's shirt, coat seams    → neutral[300–500] (lab greys)
 *   Lex's lab coat             → neutral[0] (white)
 *   Lex's skin                 → cream (warm highlight surfaces)
 *
 * Success / danger / warning are functional colours kept for feedback states
 * (grades, errors, streak warnings) and are not part of the brand identity.
 */

export const palette = {
  primary: {
    50: '#F3F8FF',
    100: '#E8F0FD', // Lex's eyebrows
    200: '#C7DEFF',
    300: '#99C3FF',
    400: '#5CA0FF',
    500: '#1A80FF', // Brand blue
    600: '#0077FF', // Lex's hair
    700: '#005FCC',
    800: '#0049A0',
    900: '#0B3373',
    950: '#0A1F44',
  },
  neutral: {
    0: '#FFFFFF', // Lab coat
    50: '#F7F8FA',
    100: '#F0F2F5',
    200: '#E3E6EA',
    300: '#CBCFD5',
    400: '#9B9B9B', // Lex's shirt
    500: '#6B6F76',
    600: '#4E525A',
    700: '#34373D',
    800: '#1F2328', // Lex's trousers
    900: '#111114', // Lex's glasses frames
  },
  cream: {
    50: '#FFF8F3',
    100: '#FFF0E6', // Lex's skin
    200: '#FFE0CC',
    300: '#F5C6A5',
    400: '#E09B6B',
    500: '#B86B3A',
  },
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },
  danger: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
  },
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
  },
};

/**
 * Difficulty levels. The database stores CEFR (A1–C2); the app shows them as
 * Level 1–6 on an easy-to-hard ramp: green, lime, yellow, orange, red, and
 * Lex's ink for the hardest. Every label/fill pair meets 4.5:1, and the level
 * number is always shown, so color is never the only signal.
 */
export interface LevelColorSet {
  solid: string;
  solidBorder: string;
  onSolid: string;
  soft: string;
  softBorder: string;
  onSoft: string;
}

export const levelColors: Record<1 | 2 | 3 | 4 | 5 | 6, LevelColorSet> = {
  1: { solid: '#34D399', solidBorder: '#059669', onSolid: '#064E3B', soft: '#ECFDF5', softBorder: '#A7F3D0', onSoft: '#047857' },
  2: { solid: '#A3E635', solidBorder: '#65A30D', onSolid: '#365314', soft: '#F7FEE7', softBorder: '#D9F99D', onSoft: '#4D7C0F' },
  3: { solid: '#FACC15', solidBorder: '#CA8A04', onSolid: '#713F12', soft: '#FEFCE8', softBorder: '#FEF08A', onSoft: '#854D0E' },
  4: { solid: '#FB923C', solidBorder: '#EA580C', onSolid: '#431407', soft: '#FFF7ED', softBorder: '#FED7AA', onSoft: '#C2410C' },
  5: { solid: '#DC2626', solidBorder: '#991B1B', onSolid: palette.neutral[0], soft: palette.danger[50], softBorder: palette.danger[200], onSoft: palette.danger[700] },
  6: { solid: palette.neutral[800], solidBorder: palette.neutral[900], onSolid: palette.danger[300], soft: palette.neutral[100], softBorder: palette.neutral[300], onSoft: palette.neutral[800] },
};

/** The same sets keyed by the CEFR code stored in the database. */
export const cefrColors: Record<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', LevelColorSet> = {
  A1: levelColors[1],
  A2: levelColors[2],
  B1: levelColors[3],
  B2: levelColors[4],
  C1: levelColors[5],
  C2: levelColors[6],
};

/** Exact fills used in the Lex artwork. */
export const mascotColors = {
  hair: palette.primary[600],
  eyebrow: palette.primary[100],
  skin: palette.cream[100],
  coat: palette.neutral[0],
  coatSeam: '#B4B4B4',
  shirt: palette.neutral[400],
  shirtSeam: '#8C8C8C',
  buckle: '#808080',
  trousers: palette.neutral[800],
  shoes: '#141619',
  tie: '#17171B',
  tieKnot: '#1E1E24',
  ink: palette.neutral[900],
  lens: palette.neutral[0],
};

/** Semantic aliases — prefer these in components. */
export const colors = {
  ...palette,

  brand: palette.primary[500],
  brandPressed: palette.primary[700],
  brandSoft: palette.primary[100],

  background: palette.primary[50],
  surface: palette.neutral[0],
  surfaceMuted: palette.neutral[50],
  surfaceBrand: palette.primary[100],
  surfaceWarm: palette.cream[50],

  border: palette.neutral[200],
  borderStrong: palette.neutral[300],
  borderBrand: palette.primary[200],

  text: palette.neutral[800],
  textStrong: palette.neutral[900],
  textMuted: palette.neutral[500],
  textSubtle: palette.neutral[400],
  textBrand: palette.primary[700],
  textOnBrand: palette.neutral[0],

  overlay: 'rgba(17, 17, 20, 0.6)',
  shadow: palette.neutral[900],
};

/** Appends an alpha channel (0–1) to a #RRGGBB colour. */
export const withAlpha = (hex: string, alpha: number): string =>
  `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()}`;
