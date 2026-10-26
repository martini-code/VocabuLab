import { STARTER_LAYOUT } from '../catalog';
import { chooseSpot, decideState, FLOOR_SPOTS } from '../lexBrain';

const base = { dueCards: 0, streakDays: 3, studiedToday: false, hour: 10, now: 1000 };

describe('decideState', () => {
  it('studies when cards are due and relaxes when nothing is due', () => {
    expect(decideState({ ...base, dueCards: 12 })).toBe('study');
    expect(decideState(base)).toBe('relax');
  });

  it('dozes in the evening when the streak is at risk', () => {
    expect(decideState({ ...base, dueCards: 5, hour: 20 })).toBe('doze');
    expect(decideState({ ...base, dueCards: 5, hour: 20, studiedToday: true })).toBe('study');
  });

  it('celebrates right after a session', () => {
    expect(decideState({ ...base, dueCards: 5, eurekaUntil: 2000 })).toBe('eureka');
    expect(decideState({ ...base, dueCards: 5, eurekaUntil: 500 })).toBe('study');
  });
});

describe('chooseSpot', () => {
  it('uses the desk to study in the starter room', () => {
    const choice = chooseSpot({ layout: STARTER_LAYOUT, mode: 'study', now: 0 });
    expect(choice.itemId).toBe('desk');
    expect(choice.spot.action).toBe('read');
  });

  it('falls back to the floor in an empty room', () => {
    expect(chooseSpot({ layout: {}, mode: 'study', now: 0 }).spot).toBe(FLOOR_SPOTS.study);
    expect(chooseSpot({ layout: {}, mode: 'relax', now: 0 }).itemId).toBeNull();
  });

  it('prefers the favorite spot', () => {
    const layout = { ...STARTER_LAYOUT, armchair: { c: 2, r: 5 } };
    expect(chooseSpot({ layout, mode: 'study', now: 0, favorite: 'armchair' }).itemId).toBe(
      'armchair'
    );
  });

  it('rotates between relax spots', () => {
    const picks = [0, 1, 2, 3].map(
      (rotation) => chooseSpot({ layout: STARTER_LAYOUT, mode: 'relax', now: 0, rotation }).itemId
    );
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it('follows a tapped item and nudges when it is a relax spot during study time', () => {
    const suggestion = { itemId: 'window' as const, until: 100 };
    const choice = chooseSpot({ layout: STARTER_LAYOUT, mode: 'study', now: 50, suggestion });
    expect(choice).toMatchObject({ itemId: 'window', suggested: true, nudge: true });
    const expired = chooseSpot({ layout: STARTER_LAYOUT, mode: 'study', now: 150, suggestion });
    expect(expired.itemId).toBe('desk');
  });
});
