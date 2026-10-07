import { levelColors } from '../colors';
import { levelColorsFor, levelLabel, toLevel } from '../levels';

describe('levels', () => {
  it('maps stored CEFR codes to Level 1–6', () => {
    expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(toLevel)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(toLevel('b2')).toBe(4);
    expect(levelLabel('C1')).toBe('Level 5');
  });

  it('accepts difficulty numbers and falls back to Level 1 for unknown values', () => {
    expect(toLevel(3)).toBe(3);
    expect(toLevel(9)).toBe(6);
    expect(toLevel('X9')).toBe(1);
    expect(toLevel(undefined)).toBe(1);
  });

  it('colors each level on the easy-to-hard ramp', () => {
    expect(levelColorsFor('A1')).toBe(levelColors[1]);
    expect(levelColorsFor(6)).toBe(levelColors[6]);
  });
});
