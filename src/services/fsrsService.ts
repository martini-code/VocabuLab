import { Grade, Rating } from 'ts-fsrs';
import { UserCard } from '../types';
import { srsManager, SRSRating, ReviewOption as SRSReviewOption, SRSUpdatePayload } from '../srs';

export interface ReviewOption {
  rating: Grade;
  label: string;
  intervalText: string;
  due?: Date;
}

/**
 * Maps ts-fsrs Grade enum to universal SRSRating.
 */
function toSRSRating(grade: Grade): SRSRating {
  switch (grade) {
    case Rating.Again:
      return SRSRating.Again;
    case Rating.Hard:
      return SRSRating.Hard;
    case Rating.Good:
      return SRSRating.Good;
    case Rating.Easy:
      return SRSRating.Easy;
    default:
      return SRSRating.Good;
  }
}

/**
 * Computes preview intervals using the user's currently selected SRS algorithm.
 */
export function getReviewOptions(userCard: UserCard, now: Date = new Date()): ReviewOption[] {
  const options = srsManager.getReviewOptions(userCard, now);
  return options.map((opt) => ({
    rating: opt.rating as unknown as Grade,
    label: opt.label,
    intervalText: opt.intervalText,
    due: opt.due,
  }));
}

/**
 * Applies a grade to a card using the user's active spaced repetition algorithm
 * (FSRS, SM-2, or Leitner) and returns the database update payload.
 */
export function gradeCardFSRS(userCard: UserCard, rating: Grade, now: Date = new Date()): SRSUpdatePayload {
  const srsRating = toSRSRating(rating);
  return srsManager.gradeCard(userCard, srsRating, now);
}
