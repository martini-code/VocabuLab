import { AlgorithmId, SRSAlgorithm, AlgorithmMeta } from './types';
import { FSRSAlgorithm } from './algorithms/fsrs';

/**
 * Registry of available spaced repetition algorithms.
 * VocabuLab exclusively uses FSRS v5 (State-of-the-art DSR model).
 */
const ALGORITHM_INSTANCES: Record<AlgorithmId, SRSAlgorithm> = {
  fsrs: new FSRSAlgorithm(),
};

export const DEFAULT_ALGORITHM_ID: AlgorithmId = 'fsrs';

/**
 * Returns the FSRS algorithm instance.
 */
export function getAlgorithmById(id?: AlgorithmId | string): SRSAlgorithm {
  return ALGORITHM_INSTANCES.fsrs;
}

/**
 * Returns metadata for the active FSRS algorithm.
 */
export function getAllAlgorithmsMeta(): AlgorithmMeta[] {
  return [ALGORITHM_INSTANCES.fsrs.meta];
}
