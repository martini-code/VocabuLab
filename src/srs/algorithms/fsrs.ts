import { fsrs, Card as FSRSCard, Rating, State, Grade } from 'ts-fsrs';
import { UserCard } from '../../types';
import { SRSAlgorithm, AlgorithmMeta, ReviewOption, SRSRating, SRSUpdatePayload } from '../types';

const f = fsrs({
  request_retention: 0.9, // 90% optimal target retention
});

function parseDateSafe(d?: string | Date | null): Date {
  if (!d) return new Date();
  const date = typeof d === 'string' ? new Date(d) : d;
  return isNaN(date.getTime()) ? new Date() : date;
}

/**
 * Converts a SQLite UserCard entity to ts-fsrs internal Card model.
 */
function toFSRSCard(card: UserCard): FSRSCard {
  return {
    due: parseDateSafe(card.due_date),
    stability: typeof card.stability === 'number' && !isNaN(card.stability) ? card.stability : 0,
    difficulty: typeof card.difficulty === 'number' && !isNaN(card.difficulty) ? card.difficulty : 0,
    elapsed_days: card.elapsed_days || 0,
    scheduled_days: card.scheduled_days || 0,
    learning_steps: 0,
    reps: card.reps || 0,
    lapses: card.lapses || 0,
    state: (card.state as State) ?? State.New,
    last_review: parseDateSafe(card.updated_at),
  };
}

function formatInterval(due: Date, now: Date): string {
  if (!due || isNaN(due.getTime())) return '10m';
  const diffMs = due.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 1) {
    return `${diffDays}d`;
  } else if (diffHours >= 1) {
    return `${diffHours}h`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m`;
  }
  return '10m';
}

export class FSRSAlgorithm implements SRSAlgorithm {
  readonly meta: AlgorithmMeta = {
    id: 'fsrs',
    name: 'FSRS (Free Spaced Repetition Scheduler)',
    shortName: 'FSRS v5',
    tagline: 'State-of-the-Art Machine Learning (Highest Retention Efficiency)',
    description:
      'The modern DSR (Difficulty, Stability, Retrievability) spaced repetition algorithm adopted by modern Anki. Achieves 20-30% fewer reviews than SM-2 while guaranteeing 90% memory retention.',
    efficiencyScore: 98,
    efficiencyStars: 5,
    isDefault: true,
    history:
      'Developed by Jarrett Ye and researchers (2022-2024), FSRS is based on the DSR model of human memory and proven on over 100M+ real-world flashcard reviews.',
    howItWorks:
      'Continuously computes memory stability (time until 90% recall probability) and intrinsic difficulty using differential retention curves.',
    bestFor: 'Learners wanting maximum memory retention in minimum study time.',
    badgeLabel: 'DEFAULT • MOST EFFICIENT',
    iconName: 'sparkles',
  };

  getReviewOptions(card: UserCard, now: Date = new Date()): ReviewOption[] {
    const fsrsCard = toFSRSCard(card);
    const schedulingCards = f.repeat(fsrsCard, now);

    const ratings: { rating: SRSRating; grade: Grade; label: string }[] = [
      { rating: SRSRating.Again, grade: Rating.Again as Grade, label: 'Again' },
      { rating: SRSRating.Hard, grade: Rating.Hard as Grade, label: 'Hard' },
      { rating: SRSRating.Good, grade: Rating.Good as Grade, label: 'Good' },
      { rating: SRSRating.Easy, grade: Rating.Easy as Grade, label: 'Easy' },
    ];

    return ratings.map((r) => {
      const nextCard = schedulingCards[r.grade].card;
      return {
        rating: r.rating,
        label: r.label,
        intervalText: formatInterval(nextCard.due, now),
        due: nextCard.due,
      };
    });
  }

  gradeCard(card: UserCard, rating: SRSRating, now: Date = new Date()): SRSUpdatePayload {
    const fsrsCard = toFSRSCard(card);
    const gradeMap: Record<SRSRating, Grade> = {
      [SRSRating.Again]: Rating.Again as Grade,
      [SRSRating.Hard]: Rating.Hard as Grade,
      [SRSRating.Good]: Rating.Good as Grade,
      [SRSRating.Easy]: Rating.Easy as Grade,
    };

    const grade = gradeMap[rating];
    const repeatResult = f.repeat(fsrsCard, now);
    const nextCard = repeatResult[grade].card;

    return {
      due_date: nextCard.due.toISOString(),
      state: nextCard.state,
      stability: Number(nextCard.stability.toFixed(4)),
      difficulty: Number(nextCard.difficulty.toFixed(4)),
      elapsed_days: nextCard.elapsed_days,
      scheduled_days: nextCard.scheduled_days,
      reps: nextCard.reps,
      lapses: nextCard.lapses,
    };
  }
}
