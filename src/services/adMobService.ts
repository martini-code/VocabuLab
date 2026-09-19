import { Platform } from 'react-native';
import { tokenWallet } from './tokenWallet';

import { ADMOB_CONFIG, ADMOB_TEST_IDS } from '../config/secrets';
export { ADMOB_CONFIG, ADMOB_TEST_IDS };

export type RewardedAdResult =
  | { success: true; rewardGranted: boolean }
  | { success: false; reason: 'limit_reached' | 'cancelled' | 'error' | 'unavailable' };

type AdMobStatusListener = (isReady: boolean) => void;
type FallbackAdModalHandler = (show: boolean, onRewarded: () => void, onClose: () => void) => void;

export interface MediationAdapterStatus {
  state: number; // 0 = NOT_READY, 1 = READY
  description: string;
  latency?: number;
}

class AdMobService {
  private nativeRewardedAd: any = null;
  private isLoaded: boolean = false;
  private isLoading: boolean = false;
  private hasNativeAdMob: boolean = false;
  private isMediationInitialized: boolean = false;
  /**
   * Safe Mode flag: defaults to true so developer testing NEVER triggers
   * live production ads or incurs Google invalid traffic account bans.
   */
  private isTestMode: boolean = true;
  private adapterStatuses: Record<string, MediationAdapterStatus> = {};
  private fallbackModalHandler: FallbackAdModalHandler | null = null;
  private statusListeners: Set<AdMobStatusListener> = new Set();

  constructor() {
    this.detectNativeSdk();
  }

  private getGmaModule(): any {
    try {
      // Conditionally require to avoid crashing on web / environments where native module is not linked
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('react-native-google-mobile-ads');
    } catch {
      return null;
    }
  }

  private getMobileAdsInstance(): any {
    const gma = this.getGmaModule();
    if (!gma) return null;
    const callable =
      typeof gma.default === 'function'
        ? gma.default
        : typeof gma === 'function'
        ? gma
        : null;
    return callable ? callable() : null;
  }

  private getRewardedAdClass(): any {
    const gma = this.getGmaModule();
    return gma?.RewardedAd || gma?.default?.RewardedAd || null;
  }

  private getRewardedAdEventType(): any {
    const gma = this.getGmaModule();
    return (
      gma?.RewardedAdEventType ||
      gma?.default?.RewardedAdEventType || {
        LOADED: 'rewarded_loaded',
        EARNED_REWARD: 'rewarded_earned_reward',
      }
    );
  }

  private getAdEventType(): any {
    const gma = this.getGmaModule();
    return (
      gma?.AdEventType ||
      gma?.default?.AdEventType || {
        LOADED: 'loaded',
        ERROR: 'error',
        OPENED: 'opened',
        CLICKED: 'clicked',
        CLOSED: 'closed',
        IMPRESSION: 'impression',
      }
    );
  }

  private detectNativeSdk() {
    if (Platform.OS === 'web') {
      this.hasNativeAdMob = false;
      return;
    }

    try {
      const gma = this.getGmaModule();
      if (gma && (gma.RewardedAd || gma.default?.RewardedAd)) {
        this.hasNativeAdMob = true;
      }
    } catch {
      this.hasNativeAdMob = false;
    }
  }

  /**
   * Initializes Google Mobile Ads SDK and all mediation partner adapters
   * (Meta, AppLovin, Unity, Mintegral, ironSource, InMobi, Pangle, Vungle, Yandex).
   */
  async initMediation(): Promise<void> {
    if (this.isMediationInitialized || !this.hasNativeAdMob) return;

    try {
      const mobileAdsInstance = this.getMobileAdsInstance();
      if (!mobileAdsInstance) return;

      // Register emulator test device configuration if in safe test mode
      if (this.isTestMode || __DEV__) {
        try {
          if (typeof mobileAdsInstance.setRequestConfiguration === 'function') {
            await mobileAdsInstance.setRequestConfiguration({
              testDeviceIdentifiers: ['EMULATOR'],
            });
          }
        } catch {
          // Non-fatal if configuration fails
        }
      }

      let statuses: any = null;
      if (typeof mobileAdsInstance.initialize === 'function') {
        statuses = await mobileAdsInstance.initialize();
      }
      this.isMediationInitialized = true;
      this.adapterStatuses = statuses || {};

      console.log('[AdMobMediation] Initialized successfully. Mediation adapter statuses:');
      if (statuses) {
        Object.entries(statuses).forEach(([adapter, status]: [string, any]) => {
          console.log(`  - ${adapter}: state=${status?.state}, description=${status?.description}`);
        });
      }
    } catch (err) {
      console.warn('[AdMobMediation] Error during mediation initialization:', err);
    }
  }

  /**
   * Returns whether Safe Mode (Google Test Ads) is currently active.
   */
  isTestModeEnabled(): boolean {
    return this.isTestMode;
  }

  /**
   * Sets whether the app should use Google Test Ads (Safe Mode) or Production Ads.
   * Switching modes resets the preloaded ad so that the correct ad unit is fetched.
   */
  async setTestMode(enabled: boolean): Promise<void> {
    if (this.isTestMode === enabled) return;
    this.isTestMode = enabled;
    this.isLoaded = false;
    this.nativeRewardedAd = null;
    console.log(`[AdMobService] Test Mode toggled to: ${enabled ? 'SAFE TEST MODE' : 'PRODUCTION LIVE ADS'}`);
    await this.preload();
  }

  /**
   * Returns the active Ad Unit ID based on platform and safe mode status.
   * If in Safe Mode or __DEV__, it ALWAYS returns Google's official Test Ad Unit ID.
   */
  getActiveAdUnitId(): string {
    // If in safe mode or running in dev environment, ALWAYS return test ad unit IDs
    if (this.isTestMode || __DEV__) {
      return Platform.select({
        ios: ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_IOS,
        android: ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_ANDROID,
        default: ADMOB_CONFIG.TEST_AD_UNITS.REWARDED_IOS,
      });
    }

    // Only in production mode (explicitly opted in by the developer)
    return ADMOB_CONFIG.PRODUCTION_AD_UNITS.REWARDED;
  }

  /**
   * Returns detailed configuration info for diagnostics & UI display.
   */
  getAdConfig() {
    return {
      appId: ADMOB_CONFIG.APP_ID,
      activeAdUnitId: this.getActiveAdUnitId(),
      isTestMode: this.isTestMode,
      isDev: __DEV__,
      hasNativeAdMob: this.hasNativeAdMob,
    };
  }

  /**
   * Opens Google Ad Inspector overlay to inspect mediation waterfalls, bidding partners, and ad units.
   */
  async openAdInspector(): Promise<{ success: boolean; error?: string }> {
    if (!this.hasNativeAdMob) {
      console.log('[AdMobMediation] Ad Inspector is only available in native builds with Google Mobile Ads SDK linked.');
      return {
        success: false,
        error: 'Ad Inspector requires a native build with react-native-google-mobile-ads linked.',
      };
    }

    try {
      const mobileAdsInstance = this.getMobileAdsInstance();
      if (!mobileAdsInstance || typeof mobileAdsInstance.openAdInspector !== 'function') {
        throw new Error('Google Mobile Ads SDK not initialized');
      }
      await mobileAdsInstance.openAdInspector();
      return { success: true };
    } catch (err: any) {
      console.warn('[AdMobMediation] Error launching Ad Inspector:', err);
      return { success: false, error: err?.message || 'Failed to open Ad Inspector' };
    }
  }

  /**
   * Returns current mediation readiness and registered adapter statuses.
   */
  getMediationStatus() {
    return {
      hasNativeAdMob: this.hasNativeAdMob,
      isMediationInitialized: this.isMediationInitialized,
      adapterStatuses: this.adapterStatuses,
      isLoaded: this.isLoaded,
    };
  }

  /**
   * Registers UI handler for the simulated fallback ad modal when running on web or non-native dev environments.
   */
  setFallbackModalHandler(handler: FallbackAdModalHandler | null) {
    this.fallbackModalHandler = handler;
  }

  /**
   * Preloads a rewarded ad in the background immediately so it is ready with 0 wait time.
   */
  async preload(): Promise<void> {
    if (this.isLoaded || this.isLoading) return;

    if (!this.hasNativeAdMob) {
      // In fallback / web mode, simulated ad is always instantly preloaded
      this.isLoaded = true;
      this.notifyListeners(true);
      return;
    }

    try {
      this.isLoading = true;

      // Ensure mediation adapters are initialized before loading ads
      if (!this.isMediationInitialized) {
        await this.initMediation();
      }

      const RewardedAd = this.getRewardedAdClass();
      const RewardedAdEventType = this.getRewardedAdEventType();
      const AdEventType = this.getAdEventType();

      if (!RewardedAd) {
        throw new Error('Native RewardedAd class not found');
      }

      const adUnitId = this.getActiveAdUnitId();

      if (this.isTestMode || __DEV__) {
        console.log(`[AdMobService] 🛡️ Safe Test Mode ACTIVE. Serving test ad: ${adUnitId} (No ban risk)`);
      } else {
        console.warn(`[AdMobService] ⚠️ Production Live Ads ACTIVE. Serving live ad: ${adUnitId}`);
      }

      this.nativeRewardedAd = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubLoaded = this.nativeRewardedAd.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          this.isLoaded = true;
          this.isLoading = false;
          this.notifyListeners(true);
          unsubLoaded();
        }
      );

      const unsubError = this.nativeRewardedAd.addAdEventListener(
        AdEventType.ERROR,
        (error: any) => {
          console.warn('[AdMobService] Preload error:', error);
          this.isLoaded = false;
          this.isLoading = false;
          this.notifyListeners(false);
          unsubError();
        }
      );

      this.nativeRewardedAd.load();
    } catch (e) {
      console.warn('[AdMobService] Failed to preload native ad:', e);
      this.isLoaded = false;
      this.isLoading = false;
      this.notifyListeners(false);
    }
  }

  isAdReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Displays the preloaded rewarded ad to the user.
   * Checks daily 3-ad limit first.
   */
  async showRewardedAd(): Promise<RewardedAdResult> {
    // 1. Check daily ad cap (max 3 per day)
    const canWatch = await tokenWallet.canWatchRewardedAd();
    if (!canWatch) {
      return { success: false, reason: 'limit_reached' };
    }

    // 2. Native AdMob Presentation (Full-screen native Google AdMob video overlay)
    if (this.hasNativeAdMob) {
      if (!this.isLoaded && !this.isLoading) {
        // Trigger preload if not loaded
        this.preload();
      }

      // If ad is currently loading, wait up to 4s (20 * 200ms) for it to finish
      let retries = 0;
      while (this.isLoading && retries < 20) {
        await new Promise((r) => setTimeout(r, 200));
        retries++;
      }

      if (this.nativeRewardedAd && this.isLoaded) {
        return new Promise<RewardedAdResult>((resolve) => {
          try {
            const RewardedAdEventType = this.getRewardedAdEventType();
            const AdEventType = this.getAdEventType();

            let rewardEarned = false;
            let resolved = false;

            let unsubEarned = () => {};
            let unsubClosed = () => {};
            let unsubError = () => {};

            const cleanup = () => {
              try { unsubEarned(); } catch {}
              try { unsubClosed(); } catch {}
              try { unsubError(); } catch {}
            };

            const finish = (result: RewardedAdResult) => {
              if (resolved) return;
              resolved = true;
              cleanup();
              this.isLoaded = false;
              this.preload(); // Preload next ad immediately in background
              resolve(result);
            };

            unsubEarned = this.nativeRewardedAd.addAdEventListener(
              RewardedAdEventType.EARNED_REWARD,
              async (reward: any) => {
                console.log('[AdMobService] User earned reward:', reward);
                rewardEarned = true;
                await tokenWallet.recordRewardedAdWatch();
              }
            );

            unsubClosed = this.nativeRewardedAd.addAdEventListener(
              AdEventType.CLOSED,
              () => {
                if (rewardEarned) {
                  finish({ success: true, rewardGranted: true });
                } else {
                  finish({ success: false, reason: 'cancelled' });
                }
              }
            );

            unsubError = this.nativeRewardedAd.addAdEventListener(
              AdEventType.ERROR,
              (error: any) => {
                console.warn('[AdMobService] Error while presenting rewarded ad:', error);
                finish({ success: false, reason: 'error' });
              }
            );

            const showPromise = this.nativeRewardedAd.show();
            if (showPromise && typeof showPromise.catch === 'function') {
              showPromise.catch((showErr: any) => {
                console.warn('[AdMobService] show() promise rejection:', showErr);
                finish({ success: false, reason: 'error' });
              });
            }
          } catch (err) {
            console.warn('[AdMobService] Error showing native ad:', err);
            this.isLoaded = false;
            this.preload();
            resolve({ success: false, reason: 'error' });
          }
        });
      }

      // If native ad is not ready, do NOT show fallback modal on native builds!
      console.warn('[AdMobService] Native ad not ready or failed to load.');
      return { success: false, reason: 'unavailable' };
    }

    // 3. Fallback Presentation (Web or non-native dev environments only)
    if (this.fallbackModalHandler) {
      return new Promise<RewardedAdResult>((resolve) => {
        this.fallbackModalHandler!(
          true,
          async () => {
            await tokenWallet.recordRewardedAdWatch();
            this.isLoaded = false;
            this.preload();
            resolve({ success: true, rewardGranted: true });
          },
          () => {
            this.preload();
            resolve({ success: false, reason: 'cancelled' });
          }
        );
      });
    }

    // Direct simulated reward if no modal handler registered
    await tokenWallet.recordRewardedAdWatch();
    this.isLoaded = false;
    this.preload();
    return { success: true, rewardGranted: true };
  }

  subscribeStatus(listener: AdMobStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.isLoaded);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyListeners(isReady: boolean) {
    this.statusListeners.forEach((l) => l(isReady));
  }
}

export const adMobService = new AdMobService();
