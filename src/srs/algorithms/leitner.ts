import { UserCard } from '../../types';
import { SRSAlgorithm, AlgorithmMeta, ReviewOption, SRSRating, SRSUpdatePayload } from '../types';

/**
 * Leitner 5-Box Spaced Repetition System
 * Developed by German science journalist Sebastian Leitner (1972).
 * The foundational, most intuitive flashcard box system.
 */
export class LeitnerAlgorithm implements SRSAlgorithm {
  readonly meta: AlgorithmMeta = {
    id: 'leitner',
    name: 'Leitner 5-Box System',
    shortName: 'Leitner',
    tagline: 'Intuitive Tiered Boxes with Graduated Step Intervals',
    description:
      'The classic 5-compartment flashcard system created by Sebastian Leitner in 1972. Correct answers promote cards to the next box (1d -> 3d -> 7d -> 14d -> 30d); incorrect answers reset to Box 1.',
    efficiencyScore: 72,
    efficiencyStars: 3,
    isDefault: false,
    history:
      'Introduced by Sebastian Leitner in his 1972 book "So lernt man lernen" (How to Learn to Learn). It introduced physical compartment-box spaced review before personal computers existed.',
    howItWorks:
      'Cards live in 5 progressive boxes. Recalling correctly moves cards to higher boxes with doubled/tripled intervals. Forgetting resets a card back to Box 1.',
    bestFor: 'Learners who want transparent, predictable, step-by-step box intervals without complex mathematical curves.',
    badgeLabel: '5-BOX SYSTEM',
    iconName: 'layers',
  };

  // 5 discrete box intervals in days
  private readonly BOX_INTERVALS: Record<number, number> = {
    1: 1,  // Box 1: daily
    2: 3,  // Box 2: every 3 days
    3: 7,  // Box 3: weekly
    4: 14, // Box 4: bi-weekly
    5: 30, // Box 5: monthly (mastered)
  };

  private getCurrentBox(card: UserCard): number {
    const days = card.scheduled_days || 0;
    if (days >= 30 || (card.stability && card.stability >= 25)) return 5;
    if (days >= 14 || (card.stability && card.stability >= 12)) return 4;
    if (days >= 7 || (card.stability && card.stability >= 6)) return 3;
    if (days >= 3 || (card.stability && card.stability >= 2.5)) return 2;
    return 1;
  }

  private calculateStep(card: UserCard, rating: SRSRating, now: Date) {
    const currentBox = this.getCurrentBox(card);
    const currentReps = card.reps || 0;
    const currentLapses = card.lapses || 0;

    let targetBox = 1;
    let nextReps = currentReps;
    let nextLapses = currentLapses;
    let intervalText = '1d';
    let dueTime = now.getTime();
    let state = 2; // Review

    if (rating === SRSRating.Again) {
      // Mistake: card drops all the way back to Box 1
      targetBox = 1;
      nextReps = 0;
      nextLapses = currentLapses + 1;
      state = 3; // Relearning
      // 10m intraday step if today, or 1 day
      intervalText = '10m';
      dueTime += 10 * 60 * 1000;
    } else if (rating === SRSRating.Hard) {
      // Struggled: stay in current box (or drop 1 box if above Box 1)
      targetBox = Math.max(1, currentBox - 1);
      nextReps = currentReps + 1;
      const days = this.BOX_INTERVALS[targetBox];
      intervalText = `${days}d`;
      dueTime += days * 24 * 60 * 60 * 1000;
    } else if (rating === SRSRating.Good) {
      // Success: advance +1 box
      targetBox = Math.min(5, currentBox + 1);
      nextReps = currentReps + 1;
      const days = this.BOX_INTERVALS[targetBox];
      intervalText = `${days}d`;
      dueTime += days * 24 * 60 * 60 * 1000;
    } else {
      // Easy: advance +2 boxes (or graduate straight to Box 5)
      targetBox = Math.min(5, currentBox + 2);
      nextReps = currentReps + 2;
      const days = this.BOX_INTERVALS[targetBox];
      intervalText = `${days}d`;
      dueTime += days * 24 * 60 * 60 * 1000;
    }

    const scheduledDays = this.BOX_INTERVALS[targetBox];
    const stability = targetBox === 5 ? 30.0 : scheduledDays;

    return {
      due_date: new Date(dueTime).toISOString(),
      state,
      stability,
      difficulty: targetBox, // Store current box number (1-5) as difficulty
      elapsed_days: card.elapsed_days || 0,
      scheduled_days: scheduledDays,
      reps: nextReps,
      lapses: nextLapses,
      intervalText,
      dueDateObj: new Date(dueTime),
    };
  }

  getReviewOptions(card: UserCard, now: Date = new Date()): ReviewOption[] {
    const ratings: { rating: SRSRating; label: string }[] = [
      { rating: SRSRating.Again, label: 'Again' },
      { rating: SRSRating.Hard, label: 'Hard' },
      { rating: SRSRating.Good, label: 'Good' },
      { rating: SRSRating.Easy, label: 'Easy' },
    ];

    return ratings.map((r) => {
      const step = this.calculateStep(card, r.rating, now);
      return {
        rating: r.rating,
        label: r.label,
        intervalText: step.intervalText,
        due: step.dueDateObj,
      };
    });
  }

  gradeCard(card: UserCard, rating: SRSRating, now: Date = new Date()): SRSUpdatePayload {
    const step = this.calculateStep(card, rating, now);
    return {
      due_date: step.due_date,
      state: step.state,
      stability: step.stability,
      difficulty: step.difficulty,
      elapsed_days: step.elapsed_days,
      scheduled_days: step.scheduled_days,
      reps: step.reps,
      lapses: step.lapses,
    };
  }
}
