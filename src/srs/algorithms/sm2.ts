import { UserCard } from '../../types';
import { SRSAlgorithm, AlgorithmMeta, ReviewOption, SRSRating, SRSUpdatePayload } from '../types';

/**
 * SM-2 (SuperMemo 2) Spaced Repetition Algorithm
 * Developed by Dr. Piotr Wozniak (1987) and famously popularized by Anki.
 */
export class SM2Algorithm implements SRSAlgorithm {
  readonly meta: AlgorithmMeta = {
    id: 'sm2',
    name: 'SM-2 (SuperMemo-2 / Classic Anki)',
    shortName: 'SM-2',
    tagline: 'The Gold Standard of Classic Flashcards for Over 35 Years',
    description:
      'The legendary algorithm created by Dr. Piotr Wozniak in 1987 that powered SuperMemo and Anki for decades. Adapts card intervals using an Ease Factor (EF) and geometric progression.',
    efficiencyScore: 82,
    efficiencyStars: 4,
    isDefault: false,
    history:
      'Created by Piotr Wozniak in 1987 as part of master’s thesis research. It revolutionized computer-assisted learning and served as Anki’s default scheduler until 2023.',
    howItWorks:
      'Adjusts card Ease Factor (default 2.50) based on recall difficulty, multiplying consecutive intervals geometrically (1d -> 6d -> I * EF).',
    bestFor: 'Learners accustomed to classic Anki scheduling who prefer traditional geometric intervals.',
    badgeLabel: 'CLASSIC ANKI',
    iconName: 'book',
  };

  private getEffectiveEase(card: UserCard): number {
    const ef = card.difficulty;
    if (!ef || ef < 1.3 || ef > 4.0) {
      return 2.50; // Standard SM-2 starting ease factor
    }
    return ef;
  }

  private calculateStep(card: UserCard, rating: SRSRating, now: Date) {
    const currentEase = this.getEffectiveEase(card);
    const currentReps = card.reps || 0;
    const currentLapses = card.lapses || 0;
    const prevInterval = Math.max(1, card.scheduled_days || 1);

    // Map 4 ratings to SM-2 quality grades (q: 0-5)
    // 1 (Again) -> q=1
    // 2 (Hard)  -> q=3
    // 3 (Good)  -> q=4
    // 4 (Easy)  -> q=5
    const q = rating === SRSRating.Again ? 1 : rating === SRSRating.Hard ? 3 : rating === SRSRating.Good ? 4 : 5;

    // SM-2 Ease Factor formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const newEase = Math.max(1.30, Number((currentEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(2)));

    let nextIntervalDays = 1;
    let nextReps = currentReps;
    let nextLapses = currentLapses;
    let nextState = 2; // Review
    let intervalText = '1d';
    let dueTime = now.getTime();

    if (rating === SRSRating.Again) {
      // Failed recall: reset reps, increment lapses, 10 min intraday relearn
      nextReps = 0;
      nextLapses = currentLapses + 1;
      nextState = 3; // Relearning
      nextIntervalDays = 0;
      intervalText = '10m';
      dueTime += 10 * 60 * 1000;
    } else {
      // Successful recall (q >= 3)
      nextReps = currentReps + 1;

      if (currentReps === 0) {
        if (rating === SRSRating.Easy) {
          nextIntervalDays = 3;
        } else {
          nextIntervalDays = 1;
        }
      } else if (currentReps === 1) {
        if (rating === SRSRating.Hard) {
          nextIntervalDays = 3;
        } else if (rating === SRSRating.Good) {
          nextIntervalDays = 6;
        } else {
          nextIntervalDays = 8;
        }
      } else {
        // reps >= 2: I(n) = I(n-1) * EF
        if (rating === SRSRating.Hard) {
          nextIntervalDays = Math.max(prevInterval + 1, Math.round(prevInterval * 1.2));
        } else if (rating === SRSRating.Good) {
          nextIntervalDays = Math.max(prevInterval + 1, Math.round(prevInterval * newEase));
        } else {
          // Easy bonus multiplier (1.3x)
          nextIntervalDays = Math.max(prevInterval + 2, Math.round(prevInterval * newEase * 1.3));
        }
      }

      intervalText = `${nextIntervalDays}d`;
      dueTime += nextIntervalDays * 24 * 60 * 60 * 1000;
    }

    return {
      due_date: new Date(dueTime).toISOString(),
      state: nextState,
      stability: Number(nextIntervalDays.toFixed(2)),
      difficulty: newEase,
      elapsed_days: card.elapsed_days || 0,
      scheduled_days: nextIntervalDays,
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
