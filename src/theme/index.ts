import { colors } from './colors';

export { colors, palette, mascotColors, cefrColors, withAlpha } from './colors';

/** 4-pt spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Corner radii — Lex is all round lenses, so the UI leans soft. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '800' },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '600' },
  overline: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  button: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
} as const;

export const shadows = {
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  brand: {
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;

export const theme = { colors, spacing, radii, typography, shadows } as const;
export type Theme = typeof theme;
