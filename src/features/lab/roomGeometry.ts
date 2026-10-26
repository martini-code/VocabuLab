import { LAB_COLS, LAB_FLOOR_ROW, LAB_ITEMS, LAB_ROWS, LabItemId, LabLayout } from './catalog';
import { SpotChoice } from './lexBrain';

export interface RoomGeometry {
  width: number;
  height: number;
  cell: number;
  /** Top-left corner of the item grid. */
  left: number;
  top: number;
  /** Where the wall meets the floor. */
  floorY: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fits the 4×6 grid into the room, anchored to the bottom so the wall gets the spare height. */
export function roomGeometry(width: number, height: number, bottomInset = 8): RoomGeometry {
  const cell = Math.max(
    24,
    Math.floor(Math.min((width - 24) / LAB_COLS, (height - bottomInset - 24) / LAB_ROWS))
  );
  const left = (width - cell * LAB_COLS) / 2;
  const top = height - bottomInset - cell * LAB_ROWS;
  return { width, height, cell, left, top, floorY: top + LAB_FLOOR_ROW * cell };
}

export function itemRect(g: RoomGeometry, id: LabItemId, c: number, r: number): Rect {
  const item = LAB_ITEMS[id];
  return { x: g.left + c * g.cell, y: g.top + r * g.cell, w: item.w * g.cell, h: item.h * g.cell };
}

/** Stacking order: things standing further forward are drawn on top. */
export function itemDepth(layout: LabLayout, id: LabItemId): number {
  if (id === 'rug') return 0;
  const pos = layout[id];
  return pos ? (pos.r + LAB_ITEMS[id].h + 1) * 10 : 0;
}

export interface LexPlacement {
  x: number;
  bottom: number;
  size: number;
  zIndex: number;
}

export function lexPlacement(g: RoomGeometry, layout: LabLayout, choice: SpotChoice): LexPlacement {
  const size = Math.round(g.cell * 1.75);
  const floorFront = (LAB_FLOOR_ROW + 2) * 10 + 5;
  const pos = choice.itemId ? layout[choice.itemId] : undefined;
  if (!choice.itemId || !pos) {
    return { x: g.left + 2 * g.cell, bottom: g.top + 5 * g.cell, size, zIndex: 65 };
  }
  const item = LAB_ITEMS[choice.itemId];
  const rect = itemRect(g, choice.itemId, pos.c, pos.r);
  const centre = rect.x + rect.w / 2;
  const itemBottom = rect.y + rect.h;
  const depth = itemDepth(layout, choice.itemId);

  if (item.zone === 'wall') {
    return { x: centre, bottom: g.floorY + g.cell, size, zIndex: floorFront };
  }
  if (choice.spot.behind) {
    return { x: centre, bottom: itemBottom - g.cell * 0.55, size, zIndex: depth - 5 };
  }
  if (choice.spot.pose === 'sit_chair') {
    return { x: centre, bottom: itemBottom - g.cell * 0.1, size, zIndex: depth + 5 };
  }
  if (choice.spot.pose === 'lie') {
    return { x: centre, bottom: itemBottom + g.cell * 0.15, size, zIndex: depth + 5 };
  }
  // Stand beside the item, on whichever side has room.
  const roomRight = g.left + LAB_COLS * g.cell;
  const right = rect.x + rect.w + size * 0.3;
  const x = right + size * 0.3 <= roomRight ? right : rect.x - size * 0.3;
  return { x, bottom: itemBottom, size, zIndex: depth + 5 };
}
