import { Platform } from 'react-native';
import { adMobService, ADMOB_CONFIG, ADMOB_TEST_IDS } from '../adMobService';
import { tokenWallet } from '../tokenWallet';

// Provide a distinct production ad unit so tests don't depend on a developer's
// git-ignored secrets.local.ts (the committed defaults reuse the test ID as a safe fallback).
jest.mock(
  '../../config/secrets.local',
  () => ({
    SECRETS: {
      ADMOB_CONFIG: { PRODUCTION_AD_UNITS: { REWARDED: 'ca-app-pub-0000000000000000/0000000000' } },
    },
  }),
  { virtual: true }
);

// Mock tokenWallet
jest.mock('../tokenWallet', () => ({
  tokenWallet: {
    canWatchRewardedAd: jest.fn().mockResolvedValue(true),
    recordRewardedAdWatch: jest.fn().mockResolvedValue({ success: true, newTokens: 3 }),
  },
}));

describe('AdMobService Unit & Integration Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Always reset to safe test mode before each test
    await adMobService.setTestMode(true);
  });

  describe('Configuration & Credentials', () => {
    it('loads the Google Mobile Ads App ID from secret config', () => {
      expect(ADMOB_CONFIG.APP_ID).toBeDefined();
      expect(ADMOB_CONFIG.APP_ID).toMatch(/^ca-app-pub-/);
    });

    it('loads the production Rewarded Ad Unit ID from secret config', () => {
      expect(ADMOB_CONFIG.PRODUCTION_AD_UNITS.REWARDED).toBeDefined();
      expect(ADMOB_CONFIG.PRODUCTION_AD_UNITS.REWARDED).toMatch(/^ca-app-pub-/);
    });

    it('has official Google test ad unit IDs to prevent account bans', () => {
      expect(ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_IOS).toBe(ADMOB_TEST_IDS.REWARDED_IOS);
      expect(ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_ANDROID).toBe(ADMOB_TEST_IDS.REWARDED_ANDROID);
      expect(ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_IOS).toMatch(/^ca-app-pub-3940256099942544/);
      expect(ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_ANDROID).toMatch(/^ca-app-pub-3940256099942544/);
      expect(ADMOB_TEST_IDS).toEqual(ADMOB_CONFIG.TEST_AD_UNITS);
    });
  });

  describe('Safe Mode (Test Ads Protection)', () => {
    it('defaults to Safe Test Mode enabled to avoid accidental invalid traffic bans', () => {
      expect(adMobService.isTestModeEnabled()).toBe(true);
    });

    it('returns official test ad unit ID when in safe mode', () => {
      const activeUnit = adMobService.getActiveAdUnitId();
      expect(activeUnit).toBe(ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_IOS);
      expect(activeUnit).not.toBe(ADMOB_CONFIG.PRODUCTION_AD_UNITS.REWARDED);
    });

    it('returns production ad unit ID only when test mode is explicitly disabled in non-dev', async () => {
      // Temporarily override __DEV__
      const originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = false;

      try {
        await adMobService.setTestMode(false);
        expect(adMobService.isTestModeEnabled()).toBe(false);
        expect(adMobService.getActiveAdUnitId()).toBe(ADMOB_CONFIG.PRODUCTION_AD_UNITS.REWARDED);
      } finally {
        (global as any).__DEV__ = originalDev;
        await adMobService.setTestMode(true);
      }
    });

    it('always preserves test ad unit ID in __DEV__ environment even if testMode is false', async () => {
      const originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = true;

      try {
        await adMobService.setTestMode(false);
        // Even with testMode false, __DEV__ safety override prevents live ads
        expect(adMobService.getActiveAdUnitId()).toBe(ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_IOS);
      } finally {
        (global as any).__DEV__ = originalDev;
        await adMobService.setTestMode(true);
      }
    });

    it('provides detailed ad configuration summary for diagnostics', () => {
      const config = adMobService.getAdConfig();
      expect(config.appId).toBe(ADMOB_CONFIG.APP_ID);
      expect(config.activeAdUnitId).toBeDefined();
      expect(config.isTestMode).toBe(true);
    });
  });

  describe('showRewardedAd Flow', () => {
    it('blocks ad presentation when daily limit is reached', async () => {
      (tokenWallet.canWatchRewardedAd as jest.Mock).mockResolvedValueOnce(false);
      const result = await adMobService.showRewardedAd();
      expect(result.success).toBe(false);
      expect((result as any).reason).toBe('limit_reached');
    });

    it('grants reward via fallback modal handler in simulated environment', async () => {
      (tokenWallet.canWatchRewardedAd as jest.Mock).mockResolvedValueOnce(true);

      adMobService.setFallbackModalHandler((_show, onRewarded) => {
        onRewarded();
      });

      const result = await adMobService.showRewardedAd();
      expect(result.success).toBe(true);
      expect(tokenWallet.recordRewardedAdWatch).toHaveBeenCalled();
    });

    it('returns unavailable if native ad is enabled but failed to load and never calls fallback modal', async () => {
      (tokenWallet.canWatchRewardedAd as jest.Mock).mockResolvedValueOnce(true);

      // Simulate native module presence
      (adMobService as any).hasNativeAdMob = true;
      (adMobService as any).isLoaded = false;
      (adMobService as any).isLoading = false;

      const fallbackSpy = jest.fn();
      adMobService.setFallbackModalHandler(fallbackSpy);

      // Preload mock that leaves it unloaded
      const preloadSpy = jest.spyOn(adMobService, 'preload').mockImplementation(async () => {
        (adMobService as any).isLoaded = false;
        (adMobService as any).isLoading = false;
      });

      const result = await adMobService.showRewardedAd();
      expect(result.success).toBe(false);
      expect((result as any).reason).toBe('unavailable');
      expect(fallbackSpy).not.toHaveBeenCalled();

      preloadSpy.mockRestore();
      (adMobService as any).hasNativeAdMob = false;
    });

    it('presents native rewarded ad with correct event listeners and records reward', async () => {
      (tokenWallet.canWatchRewardedAd as jest.Mock).mockResolvedValueOnce(true);

      const listeners: Record<string, Function> = {};
      const mockRewardedAdInstance = {
        addAdEventListener: jest.fn((event: string, callback: Function) => {
          listeners[event] = callback;
          return jest.fn();
        }),
        show: jest.fn().mockResolvedValue(undefined),
      };

      (adMobService as any).hasNativeAdMob = true;
      (adMobService as any).isLoaded = true;
      (adMobService as any).nativeRewardedAd = mockRewardedAdInstance;

      const showPromise = adMobService.showRewardedAd();
      // Allow async token check to resolve
      await Promise.resolve();

      expect(mockRewardedAdInstance.addAdEventListener).toHaveBeenCalledWith(
        'rewarded_earned_reward',
        expect.any(Function)
      );
      expect(mockRewardedAdInstance.addAdEventListener).toHaveBeenCalledWith(
        'closed',
        expect.any(Function)
      );
      expect(mockRewardedAdInstance.addAdEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );

      // Simulate user earning reward then closing ad
      await listeners['rewarded_earned_reward']({ amount: 1, type: 'token' });
      listeners['closed']();

      const result = await showPromise;
      expect(result.success).toBe(true);
      expect((result as any).rewardGranted).toBe(true);
      expect(tokenWallet.recordRewardedAdWatch).toHaveBeenCalled();

      (adMobService as any).hasNativeAdMob = false;
    });
  });
});
