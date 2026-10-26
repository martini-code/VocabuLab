import {
  applySessionReward,
  buyItem,
  defaultLabState,
  sanitizeLabState,
  SPARKS_PER_CARD,
  storedItems,
  unlockTrophies,
} from '../labStore';

jest.mock('../../../db/vault', () => ({ getSetting: jest.fn(), setSetting: jest.fn() }));

describe('labStore', () => {
  it('starts with the basic starter room and nothing in storage', () => {
    const state = defaultLabState();
    expect(Object.keys(state.layout).sort()).toEqual(['desk', 'periodic', 'rug', 'window']);
    expect(storedItems(state)).toEqual([]);
  });

  it('awards Sparks per reviewed card and starts the celebration', () => {
    const state = applySessionReward(defaultLabState(), 12, Date.UTC(2026, 0, 2, 12));
    expect(state.sparks).toBe(12 * SPARKS_PER_CARD);
    expect(state.eurekaUntil).toBeGreaterThan(Date.UTC(2026, 0, 2, 12));
    expect(state.lastStudyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('buys shop items with Sparks and refuses when short', () => {
    const poor = buyItem(defaultLabState(), 'plant');
    expect(poor).toEqual({ ok: false, reason: 'too_expensive' });
    const rich = buyItem({ ...defaultLabState(), sparks: 1000 }, 'plant');
    expect(rich.ok).toBe(true);
    if (rich.ok) {
      expect(rich.state.sparks).toBe(800);
      expect(rich.state.layout.plant).toBeDefined();
    }
    expect(buyItem(defaultLabState(), 'telescope')).toEqual({ ok: false, reason: 'not_for_sale' });
  });

  it('unlocks trophy items from study milestones', () => {
    const { state, unlocked } = unlockTrophies(defaultLabState(), {
      streakDays: 7,
      learnedCards: 20,
      masteredCards: 0,
    });
    expect(unlocked).toEqual(['telescope']);
    expect(state.owned).toContain('telescope');
  });

  it('cleans up unknown or unowned items from old saves', () => {
    const state = sanitizeLabState({
      owned: ['desk', 'unicorn' as never],
      layout: { desk: { c: 1, r: 2 }, bench: { c: 0, r: 2 } },
      sparks: -5,
    });
    expect(state.owned).toEqual(['desk']);
    expect(state.layout).toEqual({ desk: { c: 1, r: 2 } });
    expect(state.sparks).toBe(0);
  });
});
