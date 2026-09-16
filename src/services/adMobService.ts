import { Platform } from 'react-native';
import { tokenWallet } from './tokenWallet';

// Official Google AdMob Test Ad Unit IDs
export const ADMOB_TEST_IDS = {
  REWARDED_ANDROID: 'ca-app-pub-3940256099942544/5224354917',
  REWARDED_IOS: 'ca-app-pub-3940256099942544/1712485313',
};

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
  private adapterStatuses: Record<string, MediationAdapterStatus> = {};
  private fallbackModalHandler: FallbackAdModalHandler | null = null;
  private statusListeners: Set<AdMobStatusListener> = new Set();

  constructor() {
    this.detectNativeSdk();
  }

  private detectNativeSdk() {
    if (Platform.OS === 'web') {
      this.hasNativeAdMob = false;
      return;
    }

    try {
      // Conditionally require to avoid crashing on web / environments where native module is not linked
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mobileAds = require('react-native-google-mobile-ads');
      if (mobileAds && mobileAds.RewardedAd) {
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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mobileAds = require('react-native-google-mobile-ads');
      const statuses = await mobileAds().initialize();
      this.isMediationInitialized = true;
      this.adapterStatuses = statuses || {};

      console.log('[AdMobMediation] Initialized successfully. Mediation adapter statuses:');
      if (statuses) {
        Object.entries(statuses).forEach(([adapter, status]: [string, any]) => {
          console.log(`  - ${adapter}: state=${status.state}, description=${status.description}`);
        });
      }
    } catch (err) {
      console.warn('[AdMobMediation] Error during mediation initialization:', err);
    }
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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mobileAds = require('react-native-google-mobile-ads');
      await mobileAds().openAdInspector();
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
   * Registers UI handler for the simulated fallback ad modal when running on web or development.
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

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { RewardedAd, RewardedAdEventType, TestIds } = require('react-native-google-mobile-ads');
      const adUnitId = Platform.select({
        ios: ADMOB_TEST_IDS.REWARDED_IOS,
        android: ADMOB_TEST_IDS.REWARDED_ANDROID,
        default: TestIds.REWARDED,
      });

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
        RewardedAdEventType.ERROR,
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

    // 2. Native AdMob Presentation
    if (this.hasNativeAdMob && this.nativeRewardedAd && this.isLoaded) {
      return new Promise<RewardedAdResult>((resolve) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { RewardedAdEventType } = require('react-native-google-mobile-ads');
          let rewardEarned = false;

          const unsubEarned = this.nativeRewardedAd.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            async () => {
              rewardEarned = true;
              await tokenWallet.recordRewardedAdWatch();
            }
          );

          const unsubClosed = this.nativeRewardedAd.addAdEventListener(
            RewardedAdEventType.CLOSED,
            () => {
              unsubEarned();
              unsubClosed();
              this.isLoaded = false;
              this.preload(); // Preload next ad immediately in background!
              if (rewardEarned) {
                resolve({ success: true, rewardGranted: true });
              } else {
                resolve({ success: false, reason: 'cancelled' });
              }
            }
          );

          this.nativeRewardedAd.show();
        } catch (err) {
          console.warn('[AdMobService] Error showing native ad:', err);
          this.isLoaded = false;
          this.preload();
          resolve({ success: false, reason: 'error' });
        }
      });
    }

    // 3. Fallback Presentation (Web, Expo Go, or when native ad is not ready)
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
