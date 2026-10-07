import i18n from 'i18next';
import { LevelColorSet, levelColors } from './colors';

/**
 * Learner-facing difficulty levels. The lexicon stores CEFR codes (A1–C2);
 * the app never shows them and presents Level 1–6 instead.
 */
export type LevelNumber = 1 | 2 | 3 | 4 | 5 | 6;

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** A1 → 1 … C2 → 6. Accepts a CEFR code or a difficulty number; anything unknown is 1. */
export function toLevel(value: string | number | null | undefined): LevelNumber {
  if (typeof value === 'number') {
    return (Math.min(6, Math.max(1, Math.round(value))) || 1) as LevelNumber;
  }
  const i = CEFR_ORDER.indexOf((value || '').toUpperCase() as (typeof CEFR_ORDER)[number]);
  return (i === -1 ? 1 : i + 1) as LevelNumber;
}

/** "Level 3" */
export function levelLabel(value: string | number | null | undefined): string {
  const n = toLevel(value);
  const fallback = `Level ${n}`;
  if (!i18n.isInitialized) return fallback;
  const label: string = i18n.t('levels.label', { n, defaultValue: 'Level {{n}}' });
  return label && label !== 'levels.label' ? label : fallback;
}

export function levelColorsFor(value: string | number | null | undefined): LevelColorSet {
  return levelColors[toLevel(value)];
}
