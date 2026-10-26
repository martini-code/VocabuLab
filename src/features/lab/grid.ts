import {
  LAB_COLS,
  LAB_FLOOR_ROW,
  LAB_ITEMS,
  LAB_ROWS,
  LabItemId,
  LabLayout,
  PlacedItem,
} from './catalog';

export type PlacementProblem = 'outside' | 'wall_only' | 'floor_only' | 'taken';

export type PlacementCheck = { ok: true } | { ok: false; problem: PlacementProblem };

const cellKey = (c: number, r: number) => r * LAB_COLS + c;

/** Cells covered by every placed item except `except`. */
export function occupiedCells(layout: LabLayout, except?: LabItemId): Set<number> {
  const taken = new Set<number>();
  (Object.keys(layout) as LabItemId[]).forEach((id) => {
    if (id === except) return;
    const pos = layout[id];
    if (!pos) return;
    const item = LAB_ITEMS[id];
    for (let i = 0; i < item.w; i++) {
      for (let j = 0; j < item.h; j++) taken.add(cellKey(pos.c + i, pos.r + j));
    }
  });
  return taken;
}

export function checkPlacement(
  layout: LabLayout,
  id: LabItemId,
  c: number,
  r: number
): PlacementCheck {
  const item = LAB_ITEMS[id];
  if (c < 0 || r < 0 || c + item.w > LAB_COLS || r + item.h > LAB_ROWS) {
    return { ok: false, problem: 'outside' };
  }
  const bottom = r + item.h - 1;
  if (item.zone === 'wall' && bottom >= LAB_FLOOR_ROW) return { ok: false, problem: 'wall_only' };
  if (item.zone === 'floor' && bottom < LAB_FLOOR_ROW) return { ok: false, problem: 'floor_only' };
  const taken = occupiedCells(layout, id);
  for (let i = 0; i < item.w; i++) {
    for (let j = 0; j < item.h; j++) {
      if (taken.has(cellKey(c + i, r + j))) return { ok: false, problem: 'taken' };
    }
  }
  return { ok: true };
}

/** First free spot for an item, scanning row by row. */
export function findFreeSpot(layout: LabLayout, id: LabItemId): PlacedItem | null {
  for (let r = 0; r < LAB_ROWS; r++) {
    for (let c = 0; c < LAB_COLS; c++) {
      if (checkPlacement(layout, id, c, r).ok) return { c, r };
    }
  }
  return null;
}

/** Back-to-front drawing order: rugs first, then by the row an item stands on. */
export function drawOrder(layout: LabLayout): LabItemId[] {
  const depth = (id: LabItemId) => {
    if (id === 'rug') return -1;
    const pos = layout[id] as PlacedItem;
    return pos.r + LAB_ITEMS[id].h;
  };
  return (Object.keys(layout) as LabItemId[])
    .filter((id) => layout[id])
    .sort((a, b) => depth(a) - depth(b));
}
