// Decides what Lex is doing in the lab: his state (from the learner's study
// progress) and which furniture spot he uses (automatic, or a spot the player
// suggested by tapping an item).

import { LAB_ITEMS, LabItemId, LabLayout, LexMode, LexSpot } from './catalog';

export type LexState = 'study' | 'relax' | 'doze' | 'eureka';

export interface StudySignals {
  dueCards: number;
  streakDays: number;
  studiedToday: boolean;
  /** Local hour, 0–23. */
  hour: number;
  now: number;
  /** Lex celebrates until this time after a finished review session. */
  eurekaUntil?: number;
}

/** From this hour on, an unstudied day with a running streak makes Lex doze off. */
export const DOZE_HOUR = 19;

export function decideState(signals: StudySignals): LexState {
  if (signals.eurekaUntil && signals.now < signals.eurekaUntil) return 'eureka';
  if (
    signals.dueCards > 0 &&
    signals.streakDays > 0 &&
    !signals.studiedToday &&
    signals.hour >= DOZE_HOUR
  ) {
    return 'doze';
  }
  return signals.dueCards > 0 ? 'study' : 'relax';
}

export const modeForState = (state: LexState): LexMode => (state === 'relax' ? 'relax' : 'study');

/** Where Lex goes when no furniture offers a spot for the current mode. */
export const FLOOR_SPOTS: Record<LexMode, LexSpot> = {
  study: { mode: 'study', pose: 'sit_floor', action: 'read', priority: 0 },
  relax: { mode: 'relax', pose: 'stand', action: 'stretch', priority: 0 },
};

/** Used when the player taps an item that has no spot of its own: Lex admires it. */
const ADMIRE_SPOT: LexSpot = { mode: 'relax', pose: 'stand', action: 'wave', priority: 0 };

export const FAVORITE_BONUS = 5;
/** How long Lex stays at a tapped item before going back to automatic. */
export const SUGGESTION_MS = 30_000;
/** A relax item tapped while cards are due only gets a short visit. */
export const NUDGE_SUGGESTION_MS = 8_000;
/** Relax spots rotate this often so the room feels alive. */
export const RELAX_ROTATION_MS = 3 * 60_000;

export interface Suggestion {
  itemId: LabItemId;
  until: number;
}

export interface SpotChoice {
  itemId: LabItemId | null;
  spot: LexSpot;
  suggested: boolean;
  /** Lex went to a relax spot while cards are due and should nudge the player. */
  nudge: boolean;
}

interface ChooseSpotInput {
  layout: LabLayout;
  mode: LexMode;
  now: number;
  favorite?: LabItemId | null;
  suggestion?: Suggestion | null;
  /** Increments every RELAX_ROTATION_MS; picks which relax spot is used. */
  rotation?: number;
}

/** The spot a tapped item offers for the current mode (or its other spot). */
export function spotForSuggestion(id: LabItemId, mode: LexMode): LexSpot {
  const spots = LAB_ITEMS[id].spots;
  return spots.find((sp) => sp.mode === mode) ?? spots[0] ?? ADMIRE_SPOT;
}

export function chooseSpot({
  layout,
  mode,
  now,
  favorite = null,
  suggestion = null,
  rotation = 0,
}: ChooseSpotInput): SpotChoice {
  if (suggestion && now < suggestion.until && layout[suggestion.itemId]) {
    const spot = spotForSuggestion(suggestion.itemId, mode);
    return {
      itemId: suggestion.itemId,
      spot,
      suggested: true,
      nudge: mode === 'study' && spot.mode === 'relax',
    };
  }

  const candidates: { itemId: LabItemId; spot: LexSpot; score: number }[] = [];
  (Object.keys(layout) as LabItemId[]).forEach((id) => {
    if (!layout[id]) return;
    LAB_ITEMS[id].spots
      .filter((sp) => sp.mode === mode)
      .forEach((spot) => {
        candidates.push({
          itemId: id,
          spot,
          score: spot.priority + (favorite === id ? FAVORITE_BONUS : 0),
        });
      });
  });

  if (candidates.length === 0) {
    return { itemId: null, spot: FLOOR_SPOTS[mode], suggested: false, nudge: false };
  }

  candidates.sort((a, b) => b.score - a.score || a.itemId.localeCompare(b.itemId));
  const favoriteFirst = favorite && candidates[0].itemId === favorite;
  const pick =
    mode === 'relax' && !favoriteFirst ? candidates[rotation % candidates.length] : candidates[0];
  return { itemId: pick.itemId, spot: pick.spot, suggested: false, nudge: false };
}
