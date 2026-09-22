export interface TokenConfig {
  INITIAL_TOKENS: number;
  WORDS_PER_TOKEN: number;
  DAILY_PASS_WORDS: number;
  MAX_DAILY_ADS: number;
  MAX_TOKENS_HELD: number;
}

export interface AdMobConfig {
  APP_ID: string;
  PRODUCTION_AD_UNITS: {
    REWARDED: string;
  };
  TEST_AD_UNITS: {
    REWARDED_IOS: string;
    REWARDED_ANDROID: string;
  };
}

export interface IapConfig {
  SKUS: {
    AD_FREE_MONTHLY: string;
  };
}

export interface AppSecrets {
  TOKEN_CONFIG: TokenConfig;
  ADMOB_CONFIG: AdMobConfig;
  IAP_CONFIG: IapConfig;
}

export const DEFAULT_SECRETS: AppSecrets = {
  TOKEN_CONFIG: {
    INITIAL_TOKENS: 2,
    WORDS_PER_TOKEN: 10,
    DAILY_PASS_WORDS: 2,
    MAX_DAILY_ADS: 3,
    MAX_TOKENS_HELD: 2,
  },
  ADMOB_CONFIG: {
    APP_ID: 'ca-app-pub-3940256099942544~1458002511', // Google sample app ID
    PRODUCTION_AD_UNITS: {
      REWARDED: 'ca-app-pub-3940256099942544/1712485313', // Safe fallback test ID
    },
    TEST_AD_UNITS: {
      REWARDED_IOS: 'ca-app-pub-3940256099942544/1712485313',
      REWARDED_ANDROID: 'ca-app-pub-3940256099942544/5224354917',
    },
  },
  IAP_CONFIG: {
    SKUS: {
      AD_FREE_MONTHLY: 'vocabulab_adfree_monthly',
    },
  },
};
