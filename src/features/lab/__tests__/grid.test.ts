import { STARTER_LAYOUT } from '../catalog';
import { checkPlacement, drawOrder, findFreeSpot, occupiedCells } from '../grid';

describe('lab grid', () => {
  it('starts with a valid, non-overlapping starter room', () => {
    const ids = Object.keys(STARTER_LAYOUT) as (keyof typeof STARTER_LAYOUT)[];
    ids.forEach((id) => {
      const pos = STARTER_LAYOUT[id]!;
      expect(checkPlacement(STARTER_LAYOUT, id, pos.c, pos.r)).toEqual({ ok: true });
    });
  });

  it('keeps wall items on the wall and floor items on the floor', () => {
    expect(checkPlacement({}, 'clock', 0, 3)).toEqual({ ok: false, problem: 'wall_only' });
    expect(checkPlacement({}, 'plant', 0, 1)).toEqual({ ok: false, problem: 'floor_only' });
    // A 2-tall floor item may reach up into the wall row as long as it stands on the floor.
    expect(checkPlacement({}, 'bench', 0, 2)).toEqual({ ok: true });
  });

  it('rejects spots outside the room or already taken', () => {
    expect(checkPlacement({}, 'bench', 3, 4)).toEqual({ ok: false, problem: 'outside' });
    expect(checkPlacement(STARTER_LAYOUT, 'plant', 1, 3)).toEqual({ ok: false, problem: 'taken' });
  });

  it('ignores the item itself when moving it', () => {
    expect(checkPlacement(STARTER_LAYOUT, 'desk', 1, 2)).toEqual({ ok: true });
    expect(occupiedCells(STARTER_LAYOUT, 'desk').has(2 * 4 + 1)).toBe(false);
  });

  it('finds the first free spot and returns null when full', () => {
    expect(findFreeSpot(STARTER_LAYOUT, 'clock')).toEqual({ c: 2, r: 0 });
    expect(
      findFreeSpot(
        {
          bench: { c: 0, r: 2 },
          hood: { c: 2, r: 2 },
          desk: { c: 0, r: 4 },
          armchair: { c: 2, r: 4 },
        },
        'fridge'
      )
    ).toBeNull();
  });

  it('draws rugs first and nearer items last', () => {
    expect(drawOrder(STARTER_LAYOUT)).toEqual(['rug', 'periodic', 'window', 'desk']);
  });
});
