import { fsrs, Card as FSRSCard, Rating, State, Grade } from 'ts-fsrs';
import { UserCard } from '../types';

const f = fsrs();

/**
 * Converts our local SQLite UserCard model to ts-fsrs Card object.
 */
export function toFSRSCard(card: UserCard): FSRSCard {
  return {
    due: new Date(card.due_date),
    stability: card.stability || 0,
    difficulty: card.difficulty || 0,
    elapsed_days: card.elapsed_days || 0,
    scheduled_days: card.scheduled_days || 0,
    learning_steps: 0,
    reps: card.reps || 0,
    lapses: card.lapses || 0,
    state: (card.state as State) ?? State.New,
    last_review: new Date(card.updated_at),
  };
}

export interface ReviewOption {
  rating: Grade;
  label: string;
  intervalText: string;
  card: FSRSCard;
}

/**
 * Computes preview intervals for all 4 review ratings.
 */
export function getReviewOptions(userCard: UserCard, now: Date = new Date()): ReviewOption[] {
  const fsrsCard = toFSRSCard(userCard);
  const schedulingCards = f.repeat(fsrsCard, now);

  const ratings: { rating: Grade; label: string }[] = [
    { rating: Rating.Again as Grade, label: 'Again' },
    { rating: Rating.Hard as Grade, label: 'Hard' },
    { rating: Rating.Good as Grade, label: 'Good' },
    { rating: Rating.Easy as Grade, label: 'Easy' },
  ];

  return ratings.map((r) => {
    const nextCard = schedulingCards[r.rating].card;
    const diffMs = nextCard.due.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    let intervalText = '10m';
    if (diffDays >= 1) {
      intervalText = `${diffDays}d`;
    } else if (diffMinutes > 60) {
      intervalText = `${Math.round(diffMinutes / 60)}h`;
    } else if (diffMinutes > 0) {
      intervalText = `${diffMinutes}m`;
    }

    return {
      rating: r.rating,
      label: r.label,
      intervalText,
      card: nextCard,
    };
  });
}

/**
 * Applies a grade to a card using FSRS algorithm and prepares database update payload.
 */
export function gradeCardFSRS(userCard: UserCard, rating: Grade, now: Date = new Date()) {
  const fsrsCard = toFSRSCard(userCard);
  const repeatResult = f.repeat(fsrsCard, now);
  const nextCard = repeatResult[rating].card;

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
