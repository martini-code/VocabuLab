import { FSRSAlgorithm } from '../algorithms/fsrs';
import { SRSRating } from '../types';
import { UserCard } from '../../types';
import { Grade, Rating, State } from 'ts-fsrs';

// Mock db/vault to isolate FSRS pure algorithm logic from database and i18n
jest.mock('../../db/vault', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
}));

import { getReviewOptions, gradeCardFSRS } from '../../services/fsrsService';

describe('FSRS Scheduling Unit Tests', () => {
  let fsrs: FSRSAlgorithm;

  // Stable fixed baseline date for deterministic testing: 2026-09-17 12:00:00 UTC
  const BASE_DATE = new Date('2026-09-17T12:00:00.000Z');

  const createInitialCard = (overrides?: Partial<UserCard>): UserCard => ({
    id: 'test-card-1',
    front_lexeme_id: 101,
    back_lexeme_id: 201,
    due_date: BASE_DATE.toISOString(),
    state: 0, // State.New
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    updated_at: BASE_DATE.toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    fsrs = new FSRSAlgorithm();
  });

  describe('Algorithm Metadata & Definition', () => {
    it('provides correct FSRS metadata and identifiers', () => {
      expect(fsrs.meta.id).toBe('fsrs');
      expect(fsrs.meta.isDefault).toBe(true);
      expect(fsrs.meta.efficiencyStars).toBe(5);
      expect(fsrs.meta.name).toContain('FSRS');
    });
  });

  describe('First Review on a New Card (Initial Ratings)', () => {
    it('grades a new card with Rating.Again correctly', () => {
      const card = createInitialCard();
      const payload = fsrs.gradeCard(card, SRSRating.Again, BASE_DATE);

      // Again on new card: moves to Learning state (1), reps = 1, lapses = 0 (lapses only increment when failing a learned review card)
      expect(payload.state).toBe(State.Learning);
      expect(payload.reps).toBe(1);
      expect(payload.lapses).toBe(0);
      expect(payload.stability).toBeGreaterThan(0);
      expect(payload.difficulty).toBeGreaterThan(0);
      expect(new Date(payload.due_date).getTime()).toBeGreaterThan(BASE_DATE.getTime());
    });

    it('grades a new card with Rating.Good correctly', () => {
      const card = createInitialCard();
      const payload = fsrs.gradeCard(card, SRSRating.Good, BASE_DATE);

      // Good on new card: moves to Learning/Review, reps = 1, lapses = 0
      expect(payload.reps).toBe(1);
      expect(payload.lapses).toBe(0);
      expect(payload.stability).toBeGreaterThan(0);
      expect(payload.difficulty).toBeGreaterThan(0);
      expect(new Date(payload.due_date).getTime()).toBeGreaterThan(BASE_DATE.getTime());
    });

    it('orders initial stability and due dates: Again < Hard < Good < Easy', () => {
      const card = createInitialCard();

      const resultAgain = fsrs.gradeCard(card, SRSRating.Again, BASE_DATE);
      const resultHard = fsrs.gradeCard(card, SRSRating.Hard, BASE_DATE);
      const resultGood = fsrs.gradeCard(card, SRSRating.Good, BASE_DATE);
      const resultEasy = fsrs.gradeCard(card, SRSRating.Easy, BASE_DATE);

      // Stability ordering
      expect(resultAgain.stability).toBeLessThan(resultHard.stability);
      expect(resultHard.stability).toBeLessThan(resultGood.stability);
      expect(resultGood.stability).toBeLessThan(resultEasy.stability);

      // Due date ordering
      const dueAgain = new Date(resultAgain.due_date).getTime();
      const dueHard = new Date(resultHard.due_date).getTime();
      const dueGood = new Date(resultGood.due_date).getTime();
      const dueEasy = new Date(resultEasy.due_date).getTime();

      expect(dueAgain).toBeLessThanOrEqual(dueHard);
      expect(dueHard).toBeLessThanOrEqual(dueGood);
      expect(dueGood).toBeLessThan(dueEasy);
    });

    it('orders initial difficulty inversely: Easy < Good < Hard < Again', () => {
      const card = createInitialCard();

      const resultAgain = fsrs.gradeCard(card, SRSRating.Again, BASE_DATE);
      const resultHard = fsrs.gradeCard(card, SRSRating.Hard, BASE_DATE);
      const resultGood = fsrs.gradeCard(card, SRSRating.Good, BASE_DATE);
      const resultEasy = fsrs.gradeCard(card, SRSRating.Easy, BASE_DATE);

      expect(resultEasy.difficulty).toBeLessThan(resultGood.difficulty);
      expect(resultGood.difficulty).toBeLessThan(resultHard.difficulty);
      expect(resultHard.difficulty).toBeLessThanOrEqual(resultAgain.difficulty);
    });
  });

  describe('Sequential Reviews (Spaced Repetition Progression)', () => {
    it('graduates card and increases stability monotonically across reviews in Review state', () => {
      let card = createInitialCard();
      let currentDate = BASE_DATE;

      // 1. Initial review with Easy: instantly graduates card to State.Review
      const easyGraduation = fsrs.gradeCard(card, SRSRating.Easy, currentDate);
      expect(easyGraduation.reps).toBe(1);
      expect(easyGraduation.state).toBe(State.Review);
      expect(easyGraduation.scheduled_days).toBeGreaterThan(0);
      expect(easyGraduation.stability).toBeGreaterThan(0);

      let lastStability = easyGraduation.stability;
      let lastScheduledDays = easyGraduation.scheduled_days;

      card = {
        ...card,
        ...easyGraduation,
        updated_at: currentDate.toISOString(),
      };

      // 2. Perform 3 consecutive successful "Good" reviews spaced at card due dates
      for (let i = 2; i <= 4; i++) {
        currentDate = new Date(card.due_date);
        const payload = fsrs.gradeCard(card, SRSRating.Good, currentDate);

        expect(payload.reps).toBe(i);
        expect(payload.state).toBe(State.Review);
        expect(payload.stability).toBeGreaterThan(lastStability);
        expect(payload.scheduled_days).toBeGreaterThan(lastScheduledDays);
        expect(payload.lapses).toBe(0);

        lastStability = payload.stability;
        lastScheduledDays = payload.scheduled_days;
        card = {
          ...card,
          ...payload,
          updated_at: currentDate.toISOString(),
        };
      }
    });

    it('handles lapses (forgetting a card in Review state) correctly', () => {
      // Create a card that has been learned and reviewed several times
      const learnedCard = createInitialCard({
        state: State.Review,
        stability: 14.5,
        difficulty: 5.2,
        reps: 5,
        lapses: 0,
        elapsed_days: 14,
        scheduled_days: 14,
        due_date: new Date('2026-10-01T12:00:00.000Z').toISOString(),
        updated_at: BASE_DATE.toISOString(),
      });

      const reviewDate = new Date('2026-10-01T12:00:00.000Z');
      const lapsedPayload = fsrs.gradeCard(learnedCard, SRSRating.Again, reviewDate);

      // Card should be marked as lapsed: reps incremented, lapses incremented
      expect(lapsedPayload.reps).toBe(6);
      expect(lapsedPayload.lapses).toBe(1);
      // Stability decreases significantly after a lapse
      expect(lapsedPayload.stability).toBeLessThan(learnedCard.stability);
      // Difficulty increases when failing a review
      expect(lapsedPayload.difficulty).toBeGreaterThanOrEqual(learnedCard.difficulty);
      // Due date is immediate/short interval (relearning)
      const lapseDue = new Date(lapsedPayload.due_date);
      const diffMinutes = (lapseDue.getTime() - reviewDate.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeLessThanOrEqual(60); // Due within minutes/short interval
    });
  });

  describe('Review Options Preview (Button Labels & Interval Formatting)', () => {
    it('returns exactly 4 review options with correct rating enum values', () => {
      const card = createInitialCard();
      const options = fsrs.getReviewOptions(card, BASE_DATE);

      expect(options.length).toBe(4);
      expect(options[0].rating).toBe(SRSRating.Again);
      expect(options[0].label).toBe('Again');
      expect(options[1].rating).toBe(SRSRating.Hard);
      expect(options[1].label).toBe('Hard');
      expect(options[2].rating).toBe(SRSRating.Good);
      expect(options[2].label).toBe('Good');
      expect(options[3].rating).toBe(SRSRating.Easy);
      expect(options[3].label).toBe('Easy');
    });

    it('formats preview intervals human-readably (m, h, or d)', () => {
      const card = createInitialCard();
      const options = fsrs.getReviewOptions(card, BASE_DATE);

      for (const opt of options) {
        expect(typeof opt.intervalText).toBe('string');
        expect(/^[0-9]+[mhd]$/.test(opt.intervalText)).toBe(true);
        expect(opt.due).toBeInstanceOf(Date);
        expect(opt.due.getTime()).toBeGreaterThan(BASE_DATE.getTime());
      }
    });

    it('formats days properly for mature cards', () => {
      const matureCard = createInitialCard({
        state: State.Review,
        stability: 30,
        difficulty: 4.0,
        reps: 6,
        lapses: 0,
        due_date: BASE_DATE.toISOString(),
      });

      const options = fsrs.getReviewOptions(matureCard, BASE_DATE);
      const goodOption = options.find((o) => o.rating === SRSRating.Good);
      const easyOption = options.find((o) => o.rating === SRSRating.Easy);

      expect(goodOption).toBeDefined();
      expect(easyOption).toBeDefined();
      expect(goodOption!.intervalText.endsWith('d')).toBe(true);
      expect(easyOption!.intervalText.endsWith('d')).toBe(true);
    });
  });

  describe('Edge Cases & Defensive Fallbacks', () => {
    it('handles null, undefined, and malformed dates gracefully without crashing', () => {
      const malformedCard = createInitialCard({
        due_date: 'invalid-date-string' as any,
        updated_at: null as any,
        stability: NaN,
        difficulty: NaN,
      });

      expect(() => {
        const payload = fsrs.gradeCard(malformedCard, SRSRating.Good, BASE_DATE);
        expect(payload.stability).toBeGreaterThan(0);
        expect(payload.difficulty).toBeGreaterThan(0);
        expect(new Date(payload.due_date).getTime()).not.toBeNaN();
      }).not.toThrow();

      expect(() => {
        const options = fsrs.getReviewOptions(malformedCard, BASE_DATE);
        expect(options.length).toBe(4);
      }).not.toThrow();
    });

    it('rounds stability and difficulty to 4 decimal places', () => {
      const card = createInitialCard();
      const payload = fsrs.gradeCard(card, SRSRating.Good, BASE_DATE);

      const stabilityDecimals = payload.stability.toString().split('.')[1]?.length || 0;
      const difficultyDecimals = payload.difficulty.toString().split('.')[1]?.length || 0;

      expect(stabilityDecimals).toBeLessThanOrEqual(4);
      expect(difficultyDecimals).toBeLessThanOrEqual(4);
    });
  });

  describe('fsrsService Integration Wrapper Functions', () => {
    it('gradeCardFSRS correctly translates ts-fsrs Grade to SRSRating and returns payload', () => {
      const card = createInitialCard();

      // Test with Grade.Good (Rating.Good)
      const payload = gradeCardFSRS(card, Rating.Good as Grade, BASE_DATE);
      expect(payload).toBeDefined();
      expect(payload.reps).toBe(1);
      expect(payload.stability).toBeGreaterThan(0);
      expect(payload.difficulty).toBeGreaterThan(0);
    });

    it('getReviewOptions wraps srsManager options with Grade compatibility', () => {
      const card = createInitialCard();
      const options = getReviewOptions(card, BASE_DATE);

      expect(options.length).toBe(4);
      expect(options.map((o) => o.label)).toEqual(['Again', 'Hard', 'Good', 'Easy']);
    });
  });
});
