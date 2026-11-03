/**
 * Picks which word database the app bundles.
 *
 * A developer can place a database at `assets/lexicon_local.db` (ignored by
 * Git) to try a different word set in their own builds. Without it the app
 * uses the default `assets/lexicon_v1.0.0.db`.
 *
 * Metro treats a `require` inside `try` as optional, so a missing local file is
 * skipped at bundle time instead of failing the build.
 */
export interface LexiconAsset {
  assetId: number;
  isLocalOverride: boolean;
}

export function getLexiconAsset(): LexiconAsset {
  try {
    return { assetId: require('../../assets/lexicon_local.db'), isLocalOverride: true };
  } catch {
    return { assetId: require('../../assets/lexicon_v1.0.0.db'), isLocalOverride: false };
  }
}
