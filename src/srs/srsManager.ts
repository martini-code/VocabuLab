import { AlgorithmId, SRSAlgorithm, AlgorithmMeta, ReviewOption, SRSRating, SRSUpdatePayload } from './types';
import { getAlgorithmById, getAllAlgorithmsMeta, DEFAULT_ALGORITHM_ID } from './registry';
import { getSetting, setSetting } from '../db/vault';
import { UserCard } from '../types';

type Listener = (id: AlgorithmId) => void;

class SRSManager {
  private activeId: AlgorithmId = DEFAULT_ALGORITHM_ID;
  private isInitialized = false;
  private listeners: Set<Listener> = new Set();

  /**
   * Initializes the manager (VocabuLab exclusively runs FSRS v5).
   */
  async init(): Promise<void> {
    this.activeId = 'fsrs';
    this.isInitialized = true;
  }

  /**
   * Returns the current active algorithm ID.
   */
  getActiveId(): AlgorithmId {
    return this.activeId;
  }

  /**
   * Returns the currently active algorithm instance.
   */
  getActiveAlgorithm(): SRSAlgorithm {
    return getAlgorithmById(this.activeId);
  }

  /**
   * Updates and persists the user's selected spaced repetition algorithm.
   */
  async setActiveAlgorithm(id: AlgorithmId): Promise<void> {
    this.activeId = id;
    try {
      await setSetting('srs_algorithm', id);
    } catch (e) {
      console.warn('[SRSManager] Failed to persist algorithm setting:', e);
    }
    this.notifyListeners();
  }

  /**
   * Returns metadata for all available algorithms.
   */
  getAvailableAlgorithms(): AlgorithmMeta[] {
    return getAllAlgorithmsMeta();
  }

  /**
   * Calculates preview review intervals for the 4 grades using the active algorithm.
   */
  getReviewOptions(card: UserCard, now?: Date): ReviewOption[] {
    return this.getActiveAlgorithm().getReviewOptions(card, now);
  }

  /**
   * Grades a card using the active algorithm and returns the database update payload.
   */
  gradeCard(card: UserCard, rating: SRSRating, now?: Date): SRSUpdatePayload {
    return this.getActiveAlgorithm().gradeCard(card, rating, now);
  }

  /**
   * Subscribe to algorithm changes.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.activeId);
    }
  }
}

export const srsManager = new SRSManager();
