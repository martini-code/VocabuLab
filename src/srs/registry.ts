import { AlgorithmId, SRSAlgorithm, AlgorithmMeta } from './types';
import { FSRSAlgorithm } from './algorithms/fsrs';
import { SM2Algorithm } from './algorithms/sm2';
import { LeitnerAlgorithm } from './algorithms/leitner';

/**
 * Registry of available spaced repetition algorithms.
 * Ordered by retention efficiency (FSRS -> SM-2 -> Leitner).
 */
const ALGORITHM_INSTANCES: Record<AlgorithmId, SRSAlgorithm> = {
  fsrs: new FSRSAlgorithm(),
  sm2: new SM2Algorithm(),
  leitner: new LeitnerAlgorithm(),
};

export const DEFAULT_ALGORITHM_ID: AlgorithmId = 'fsrs';

/**
 * Returns an algorithm instance by its unique identifier.
 * Falls back to FSRS if an invalid ID is provided.
 */
export function getAlgorithmById(id: AlgorithmId | string): SRSAlgorithm {
  if (id in ALGORITHM_INSTANCES) {
    return ALGORITHM_INSTANCES[id as AlgorithmId];
  }
  return ALGORITHM_INSTANCES[DEFAULT_ALGORITHM_ID];
}

/**
 * Returns metadata for all registered algorithms, ordered with the most efficient first.
 */
export function getAllAlgorithmsMeta(): AlgorithmMeta[] {
  return [
    ALGORITHM_INSTANCES.fsrs.meta,
    ALGORITHM_INSTANCES.sm2.meta,
    ALGORITHM_INSTANCES.leitner.meta,
  ];
}
