/**
 * Secrets & Configuration Template (Tracked in Git)
 *
 * Copy this file to `src/config/secrets.local.ts` to customize your local
 * token parameters, AdMob production IDs, or store SKUs.
 *
 * `src/config/secrets.local.ts` is untracked by Git to protect your private credentials.
 */

import { AppSecrets } from './secrets.defaults';

export const SECRETS: AppSecrets = {
  // Token economy parameters
  TOKEN_CONFIG: {
    INITIAL_TOKENS: 2,
    WORDS_PER_TOKEN: 10,
    DAILY_PASS_WORDS: 5,
    MAX_DAILY_ADS: 3,
  },

  // Google AdMob Configuration
  ADMOB_CONFIG: {
    APP_ID: 'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
    PRODUCTION_AD_UNITS: {
      REWARDED: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    },
    TEST_AD_UNITS: {
      REWARDED_IOS: 'ca-app-pub-3940256099942544/1712485313',
      REWARDED_ANDROID: 'ca-app-pub-3940256099942544/5224354917',
    },
  },

  // In-App Purchase SKUs (StoreKit & Google Play Billing)
  IAP_CONFIG: {
    SKUS: {
      AD_FREE_MONTHLY: 'vocabkeep_adfree_monthly',
    },
  },
};

export default SECRETS;
