import {
  SECRETS,
  TOKEN_CONFIG,
  ADMOB_CONFIG,
  ADMOB_TEST_IDS,
  IAP_SKUS,
} from '../secrets';

describe('Secrets & Config Architecture', () => {
  it('exports valid TOKEN_CONFIG with initial allowances', () => {
    expect(TOKEN_CONFIG).toBeDefined();
    expect(TOKEN_CONFIG.INITIAL_TOKENS).toBeGreaterThanOrEqual(1);
    expect(TOKEN_CONFIG.WORDS_PER_TOKEN).toBeGreaterThanOrEqual(1);
    expect(TOKEN_CONFIG.DAILY_PASS_WORDS).toBeGreaterThanOrEqual(1);
    expect(TOKEN_CONFIG.MAX_DAILY_ADS).toBeGreaterThanOrEqual(1);
  });

  it('exports valid ADMOB_CONFIG with App ID and Ad Units', () => {
    expect(ADMOB_CONFIG).toBeDefined();
    expect(ADMOB_CONFIG.APP_ID).toMatch(/^ca-app-pub-/);
    expect(ADMOB_CONFIG.PRODUCTION_AD_UNITS.REWARDED).toMatch(/^ca-app-pub-/);
    expect(ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_IOS).toMatch(/^ca-app-pub-3940256099942544/);
    expect(ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_ANDROID).toMatch(/^ca-app-pub-3940256099942544/);
    expect(ADMOB_TEST_IDS).toBe(ADMOB_CONFIG.TEST_AD_UNITS);
  });

  it('exports valid IAP_CONFIG with store SKUs', () => {
    expect(IAP_SKUS).toBeDefined();
    expect(typeof IAP_SKUS.AD_FREE_MONTHLY).toBe('string');
    expect(IAP_SKUS.AD_FREE_MONTHLY.length).toBeGreaterThan(0);
    expect(IAP_SKUS.AD_FREE_MONTHLY).toBe(SECRETS.IAP_CONFIG.SKUS.AD_FREE_MONTHLY);
  });

  it('matches top-level SECRETS object structure', () => {
    expect(SECRETS.TOKEN_CONFIG).toBe(TOKEN_CONFIG);
    expect(SECRETS.ADMOB_CONFIG).toBe(ADMOB_CONFIG);
    expect(SECRETS.IAP_CONFIG.SKUS).toBe(IAP_SKUS);
  });
});
