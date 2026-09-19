import {
  DEFAULT_SECRETS,
  AppSecrets,
  TokenConfig,
  AdMobConfig,
  IapConfig,
} from './secrets.defaults';

let localSecrets: Partial<AppSecrets> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('./secrets.local');
  localSecrets = mod.SECRETS || mod.default || mod || {};
} catch {
  // If secrets.local.ts does not exist, fallback to safe defaults
  localSecrets = {};
}

export const SECRETS: AppSecrets = {
  TOKEN_CONFIG: {
    ...DEFAULT_SECRETS.TOKEN_CONFIG,
    ...(localSecrets.TOKEN_CONFIG || {}),
  },
  ADMOB_CONFIG: {
    ...DEFAULT_SECRETS.ADMOB_CONFIG,
    ...(localSecrets.ADMOB_CONFIG || {}),
    PRODUCTION_AD_UNITS: {
      ...DEFAULT_SECRETS.ADMOB_CONFIG.PRODUCTION_AD_UNITS,
      ...(localSecrets.ADMOB_CONFIG?.PRODUCTION_AD_UNITS || {}),
    },
    TEST_AD_UNITS: {
      ...DEFAULT_SECRETS.ADMOB_CONFIG.TEST_AD_UNITS,
      ...(localSecrets.ADMOB_CONFIG?.TEST_AD_UNITS || {}),
    },
  },
  IAP_CONFIG: {
    ...DEFAULT_SECRETS.IAP_CONFIG,
    ...(localSecrets.IAP_CONFIG || {}),
    SKUS: {
      ...DEFAULT_SECRETS.IAP_CONFIG.SKUS,
      ...(localSecrets.IAP_CONFIG?.SKUS || {}),
    },
  },
};

export const { TOKEN_CONFIG, ADMOB_CONFIG, IAP_CONFIG } = SECRETS;
export const ADMOB_TEST_IDS = ADMOB_CONFIG.TEST_AD_UNITS;
export const IAP_SKUS = IAP_CONFIG.SKUS;

export type { AppSecrets, TokenConfig, AdMobConfig, IapConfig };
