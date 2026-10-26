// Lab state persisted in the user database's Settings table: what the player
// owns, where it sits, their Sparks, and the study facts Lex reacts to.

import { getSetting, setSetting } from '../../db/vault';
import {
  LAB_ITEMS,
  LAB_ITEM_IDS,
  LabItemId,
  LabLayout,
  STARTER_ITEMS,
  STARTER_LAYOUT,
} from './catalog';
import { findFreeSpot } from './grid';

const STORAGE_KEY = 'lab_state_v1';

export const SPARKS_PER_CARD = 5;
/** How long Lex celebrates after a finished session. */
export const EUREKA_MS = 60_000;

export interface LabState {
  layout: LabLayout;
  owned: LabItemId[];
  sparks: number;
  favorite: LabItemId | null;
  /** Local date (YYYY-MM-DD) of the last finished review session. */
  lastStudyDate: string | null;
  eurekaUntil: number;
  lastSessionSparks: number;
}

export interface TrophyProgress {
  streakDays: number;
  learnedCards: number;
  masteredCards: number;
}

export const localDate = (now: number): string => {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function defaultLabState(): LabState {
  return {
    layout: { ...STARTER_LAYOUT },
    owned: [...STARTER_ITEMS],
    sparks: 0,
    favorite: null,
    lastStudyDate: null,
    eurekaUntil: 0,
    lastSessionSparks: 0,
  };
}

/** Drops unknown items and anything not owned, so old saves never crash the room. */
export function sanitizeLabState(raw: Partial<LabState> | null | undefined): LabState {
  const base = defaultLabState();
  if (!raw || typeof raw !== 'object') return base;
  const known = new Set<string>(LAB_ITEM_IDS);
  const owned = Array.isArray(raw.owned)
    ? (raw.owned.filter((id) => known.has(id)) as LabItemId[])
    : base.owned;
  const layout: LabLayout = {};
  if (raw.layout && typeof raw.layout === 'object') {
    (Object.keys(raw.layout) as LabItemId[]).forEach((id) => {
      const pos = raw.layout?.[id];
      if (known.has(id) && owned.includes(id) && pos && Number.isInteger(pos.c)) {
        layout[id] = { c: pos.c, r: pos.r };
      }
    });
  }
  return {
    layout: raw.layout ? layout : base.layout,
    owned,
    sparks: Number.isFinite(raw.sparks) ? Math.max(0, Number(raw.sparks)) : 0,
    favorite: raw.favorite && known.has(raw.favorite) ? raw.favorite : null,
    lastStudyDate: typeof raw.lastStudyDate === 'string' ? raw.lastStudyDate : null,
    eurekaUntil: Number(raw.eurekaUntil) || 0,
    lastSessionSparks: Number(raw.lastSessionSparks) || 0,
  };
}

export async function loadLabState(): Promise<LabState> {
  try {
    const raw = await getSetting(STORAGE_KEY);
    return sanitizeLabState(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultLabState();
  }
}

export async function saveLabState(state: LabState): Promise<void> {
  await setSetting(STORAGE_KEY, JSON.stringify(state));
}

export const storedItems = (state: LabState): LabItemId[] =>
  state.owned.filter((id) => !state.layout[id]);

/** Sparks for a finished session; also starts Lex's Eureka celebration. */
export function applySessionReward(state: LabState, reviewed: number, now: number): LabState {
  if (reviewed <= 0) return state;
  const earned = reviewed * SPARKS_PER_CARD;
  return {
    ...state,
    sparks: state.sparks + earned,
    lastStudyDate: localDate(now),
    eurekaUntil: now + EUREKA_MS,
    lastSessionSparks: earned,
  };
}

export type BuyResult =
  { ok: true; state: LabState } | { ok: false; reason: 'owned' | 'not_for_sale' | 'too_expensive' };

/** Buys a shop item and puts it in the room if there is space, else in storage. */
export function buyItem(state: LabState, id: LabItemId): BuyResult {
  const item = LAB_ITEMS[id];
  if (state.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (item.source !== 'shop' || item.price === undefined) {
    return { ok: false, reason: 'not_for_sale' };
  }
  if (state.sparks < item.price) return { ok: false, reason: 'too_expensive' };
  return {
    ok: true,
    state: placeIfRoom(
      { ...state, sparks: state.sparks - item.price, owned: [...state.owned, id] },
      id
    ),
  };
}

function placeIfRoom(state: LabState, id: LabItemId): LabState {
  const spot = findFreeSpot(state.layout, id);
  return spot ? { ...state, layout: { ...state.layout, [id]: spot } } : state;
}

export function trophyEarned(id: LabItemId, progress: TrophyProgress): boolean {
  const rule = LAB_ITEMS[id].trophy;
  if (!rule) return false;
  if (rule.kind === 'streak') return progress.streakDays >= rule.days;
  if (rule.kind === 'learned') return progress.learnedCards >= rule.cards;
  return progress.masteredCards >= rule.cards;
}

/** Adds newly earned trophy items (placed in the room when there is space). */
export function unlockTrophies(
  state: LabState,
  progress: TrophyProgress
): { state: LabState; unlocked: LabItemId[] } {
  const unlocked = LAB_ITEM_IDS.filter(
    (id) => !state.owned.includes(id) && trophyEarned(id, progress)
  );
  let next = state;
  unlocked.forEach((id) => {
    next = placeIfRoom({ ...next, owned: [...next.owned, id] }, id);
  });
  return { state: next, unlocked };
}
