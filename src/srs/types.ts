import { UserCard } from '../types';

/**
 * Unique identifiers for the supported spaced repetition algorithms.
 */
export type AlgorithmId = 'fsrs';

/**
 * Standard 4-button review grades across all SRS algorithms:
 * 1 = Again (Failure / reset)
 * 2 = Hard (Struggled, shorter next interval)
 * 3 = Good (Successful recall, standard target interval)
 * 4 = Easy (Instant / effortless recall, bonus interval)
 */
export enum SRSRating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

/**
 * Preview option shown on the grading buttons during review sessions.
 */
export interface ReviewOption {
  rating: SRSRating;
  label: string;
  intervalText: string;
  due: Date;
}

/**
 * Payload written to SQLite User_Cards table after a card is graded.
 */
export interface SRSUpdatePayload {
  due_date: string;
  state: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
}

/**
 * Rich metadata describing an algorithm for comparison and user selection.
 */
export interface AlgorithmMeta {
  id: AlgorithmId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  efficiencyScore: number; // 0-100 score
  efficiencyStars: number; // 1-5 rating
  isDefault: boolean;
  history: string;
  howItWorks: string;
  bestFor: string;
  badgeLabel: string;
  iconName: string;
}

/**
 * Modular interface that every SRS algorithm must implement.
 */
export interface SRSAlgorithm {
  readonly meta: AlgorithmMeta;

  /**
   * Calculates the 4 review options with anticipated intervals based on current card state.
   */
  getReviewOptions(card: UserCard, now?: Date): ReviewOption[];

  /**
   * Calculates the new card state and SQLite update payload for a given grade rating.
   */
  gradeCard(card: UserCard, rating: SRSRating, now?: Date): SRSUpdatePayload;
}
