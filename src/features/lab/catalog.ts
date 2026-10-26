// Furniture catalog for Lex's lab.
//
// Every item takes a block of cells on the room grid and lists the "spots" Lex
// can use it from. A spot is a body pose plus an action, so new items reuse the
// same handful of Lex animations instead of needing their own.

export type LabItemId =
  | 'window'
  | 'periodic'
  | 'desk'
  | 'rug'
  | 'clock'
  | 'specimens'
  | 'whiteboard'
  | 'firstaid'
  | 'plant'
  | 'stool'
  | 'armchair'
  | 'bench'
  | 'microscope'
  | 'fridge'
  | 'hood'
  | 'telescope'
  | 'globe';

export type LabZone = 'wall' | 'floor';
export type LexMode = 'study' | 'relax';
export type LexPose = 'stand' | 'sit_chair' | 'sit_floor' | 'lie' | 'lean';
export type LexAction =
  'read' | 'write' | 'pour' | 'peer' | 'doodle' | 'sip' | 'nap' | 'stretch' | 'water' | 'wave';

export interface LexSpot {
  mode: LexMode;
  pose: LexPose;
  action: LexAction;
  /** Higher wins when Lex picks a spot on his own. */
  priority: number;
  /** Lex is drawn behind the item (sitting at a desk) instead of in front. */
  behind?: boolean;
}

export type TrophyRule =
  | { kind: 'streak'; days: number }
  | { kind: 'learned'; cards: number }
  | { kind: 'mastered'; cards: number };

export interface LabItem {
  id: LabItemId;
  name: string;
  w: number;
  h: number;
  zone: LabZone;
  /** Inner padding of the drawing inside its cells, in px at a 84px cell. */
  pad: number;
  source: 'starter' | 'shop' | 'trophy';
  price?: number;
  trophy?: TrophyRule;
  spots: LexSpot[];
}

export const LAB_COLS = 4;
export const LAB_ROWS = 6;
/** Rows 0–2 are wall, rows 3–5 are floor. Floor items must touch row 3 or lower. */
export const LAB_FLOOR_ROW = 3;

const s = (
  mode: LexMode,
  pose: LexPose,
  action: LexAction,
  priority: number,
  behind = false
): LexSpot => ({ mode, pose, action, priority, behind });

export const LAB_ITEMS: Record<LabItemId, LabItem> = {
  window: {
    id: 'window',
    name: 'Window',
    w: 2,
    h: 2,
    zone: 'wall',
    pad: 6,
    source: 'starter',
    spots: [s('relax', 'stand', 'wave', 2)],
  },
  periodic: {
    id: 'periodic',
    name: 'Periodic table',
    w: 1,
    h: 1,
    zone: 'wall',
    pad: 4,
    source: 'starter',
    spots: [],
  },
  desk: {
    id: 'desk',
    name: 'Desk',
    w: 2,
    h: 2,
    zone: 'floor',
    pad: 2,
    source: 'starter',
    spots: [s('study', 'sit_chair', 'read', 3, true), s('relax', 'sit_chair', 'doodle', 1, true)],
  },
  rug: {
    id: 'rug',
    name: 'Round rug',
    w: 2,
    h: 1,
    zone: 'floor',
    pad: 4,
    source: 'starter',
    spots: [s('study', 'lie', 'read', 1), s('relax', 'lie', 'stretch', 2)],
  },
  clock: {
    id: 'clock',
    name: 'Wall clock',
    w: 1,
    h: 1,
    zone: 'wall',
    pad: 18,
    source: 'shop',
    price: 150,
    spots: [],
  },
  specimens: {
    id: 'specimens',
    name: 'Specimen shelf',
    w: 2,
    h: 1,
    zone: 'wall',
    pad: 4,
    source: 'shop',
    price: 300,
    spots: [],
  },
  whiteboard: {
    id: 'whiteboard',
    name: 'Whiteboard',
    w: 2,
    h: 1,
    zone: 'wall',
    pad: 4,
    source: 'shop',
    price: 400,
    spots: [s('study', 'stand', 'write', 2), s('relax', 'stand', 'doodle', 1)],
  },
  firstaid: {
    id: 'firstaid',
    name: 'First-aid kit',
    w: 1,
    h: 1,
    zone: 'wall',
    pad: 14,
    source: 'shop',
    price: 120,
    spots: [],
  },
  plant: {
    id: 'plant',
    name: 'Monstera',
    w: 1,
    h: 1,
    zone: 'floor',
    pad: 4,
    source: 'shop',
    price: 200,
    spots: [s('relax', 'stand', 'water', 1)],
  },
  stool: {
    id: 'stool',
    name: 'Lab stool',
    w: 1,
    h: 1,
    zone: 'floor',
    pad: 14,
    source: 'shop',
    price: 150,
    spots: [],
  },
  armchair: {
    id: 'armchair',
    name: 'Armchair',
    w: 2,
    h: 1,
    zone: 'floor',
    pad: 4,
    source: 'shop',
    price: 600,
    spots: [s('study', 'sit_chair', 'read', 1), s('relax', 'sit_chair', 'nap', 3)],
  },
  bench: {
    id: 'bench',
    name: 'Lab bench',
    w: 2,
    h: 2,
    zone: 'floor',
    pad: 2,
    source: 'shop',
    price: 800,
    spots: [s('study', 'lean', 'pour', 2, true), s('relax', 'lean', 'peer', 1, true)],
  },
  microscope: {
    id: 'microscope',
    name: 'Microscope cart',
    w: 1,
    h: 1,
    zone: 'floor',
    pad: 6,
    source: 'shop',
    price: 500,
    spots: [s('study', 'stand', 'peer', 2)],
  },
  fridge: {
    id: 'fridge',
    name: 'Reagent fridge',
    w: 1,
    h: 2,
    zone: 'floor',
    pad: 6,
    source: 'shop',
    price: 700,
    spots: [s('relax', 'stand', 'sip', 1)],
  },
  hood: {
    id: 'hood',
    name: 'Fume hood',
    w: 2,
    h: 2,
    zone: 'floor',
    pad: 2,
    source: 'shop',
    price: 900,
    spots: [s('study', 'stand', 'pour', 2)],
  },
  telescope: {
    id: 'telescope',
    name: 'Telescope',
    w: 1,
    h: 2,
    zone: 'floor',
    pad: 6,
    source: 'trophy',
    trophy: { kind: 'streak', days: 7 },
    spots: [s('relax', 'stand', 'peer', 2)],
  },
  globe: {
    id: 'globe',
    name: 'Globe',
    w: 1,
    h: 1,
    zone: 'floor',
    pad: 10,
    source: 'trophy',
    trophy: { kind: 'learned', cards: 100 },
    spots: [s('relax', 'stand', 'wave', 1)],
  },
};

export const LAB_ITEM_IDS = Object.keys(LAB_ITEMS) as LabItemId[];

export interface PlacedItem {
  c: number;
  r: number;
}

export type LabLayout = Partial<Record<LabItemId, PlacedItem>>;

/** The basic room every player starts with. */
export const STARTER_LAYOUT: LabLayout = {
  window: { c: 0, r: 0 },
  periodic: { c: 3, r: 0 },
  desk: { c: 1, r: 2 },
  rug: { c: 1, r: 4 },
};

export const STARTER_ITEMS: LabItemId[] = LAB_ITEM_IDS.filter(
  (id) => LAB_ITEMS[id].source === 'starter'
);
