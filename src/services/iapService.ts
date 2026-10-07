/**
 * Direct In-App Purchase Service using react-native-iap (Apple StoreKit 2 & Google Play Billing)
 * Zero third-party middlemen. Fully offline-resilient entitlement persistence via SQLite.
 */

import { Platform } from 'react-native';
import type { EventSubscription, Purchase, PurchaseError } from 'react-native-iap';
import { isAdFreeUser, setAdFreeUser } from '../db/vault';

import { IAP_SKUS } from '../config/secrets';
export { IAP_SKUS };

export const ALL_AD_FREE_SKUS = [
  IAP_SKUS.AD_FREE_MONTHLY,
];

export interface AdFreeProductItem {
  id: string;
  title: string;
  description: string;
  price: string;
  type: 'in-app' | 'subs';
}

// Fallback pricing metadata when store connection is unavailable (e.g. offline, simulator, web)
export const DEFAULT_PRODUCTS: AdFreeProductItem[] = [
  {
    id: IAP_SKUS.AD_FREE_MONTHLY,
    title: 'Ad-Free Monthly Patron',
    description: 'Remove sponsor banners with monthly flexibility. Cancel anytime.',
    price: '$1.99 / mo',
    type: 'subs',
  },
];

type AdFreeListener = (isAdFree: boolean) => void;

let rniapModule: typeof import('react-native-iap') | null = null;
let rniapChecked = false;

function isExpoGo(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default || require('expo-constants');
    if (Constants) {
      if (Constants.appOwnership === 'expo') return true;
      if (Constants.executionEnvironment === 'storeClient') return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function hasNativeNitroModule(): boolean {
  if (Platform.OS === 'web') return false;
  if (isExpoGo()) return false;

  try {
    if (typeof (global as any).NitroModulesProxy !== 'undefined') {
      return true;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RN = require('react-native');
    if (RN && RN.TurboModuleRegistry && typeof RN.TurboModuleRegistry.get === 'function') {
      return RN.TurboModuleRegistry.get('NitroModules') != null;
    }
    return false;
  } catch {
    return false;
  }
}

function getRNIap(): typeof import('react-native-iap') | null {
  if (rniapChecked) return rniapModule;
  rniapChecked = true;

  // Crucial: never call require('react-native-iap') in Expo Go or when NitroModules TurboModule is missing,
  // because react-native-nitro-modules throws a fatal ModuleNotFoundError at evaluation time.
  if (!hasNativeNitroModule()) {
    console.log(
      '[IAP] Native NitroModules not found in this runtime (Expo Go or unlinked build). Native IAP disabled, SQLite local mode active.'
    );
    rniapModule = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-iap');
    if (mod && typeof mod.initConnection === 'function') {
      rniapModule = mod;
    }
  } catch (err) {
    console.warn(
      '[IAP] Failed to initialize react-native-iap. Running in offline/simulated mode:',
      err
    );
    rniapModule = null;
  }
  return rniapModule;
}

class IAPService {
  private isConnected = false;
  private updateSubscription: EventSubscription | null = null;
  private errorSubscription: EventSubscription | null = null;
  private listeners: Set<AdFreeListener> = new Set();
  private cachedAdFreeStatus: boolean = false;

  /**
   * Initializes the IAP connection, sets up purchase listeners,
   * loads cached local SQLite entitlements, and reconciles pending purchases.
   */
  async init(onStatusChange?: AdFreeListener): Promise<boolean> {
    if (onStatusChange) {
      this.listeners.add(onStatusChange);
    }

    // 1. First immediately hydrate from local SQLite (zero-network guarantee)
    try {
      this.cachedAdFreeStatus = await isAdFreeUser();
      this.notifyListeners(this.cachedAdFreeStatus);
    } catch (err) {
      console.warn('[IAP] Failed to read SQLite ad-free status:', err);
    }

    // Web platform does not support native StoreKit or Google Play Billing
    if (Platform.OS === 'web') {
      console.log('[IAP] Running on Web: Native StoreKit/PlayBilling disabled. Local SQLite fallback active.');
      return true;
    }

    // 2. Initialize native store connection if available
    const RNIap = getRNIap();
    if (!RNIap) {
      console.log('[IAP] Native StoreKit/Google Play billing unavailable in this runtime (Expo Go or unlinked build). Local SQLite fallback active.');
      this.isConnected = false;
      return false;
    }

    try {
      this.isConnected = await RNIap.initConnection();
      console.log('[IAP] Connected to native billing store:', this.isConnected);

      // Register purchase update listener
      this.updateSubscription = RNIap.purchaseUpdatedListener(async (purchase: Purchase) => {
        await this.handlePurchase(purchase);
      });

      // Register purchase error listener
      this.errorSubscription = RNIap.purchaseErrorListener((error: PurchaseError) => {
        console.warn('[IAP] Purchase error occurred:', error.code, error.message);
      });

      // Reconcile any existing / pending purchases
      await this.reconcileAvailablePurchases();

      return true;
    } catch (error) {
      console.warn('[IAP] Store connection failed (offline / simulator):', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnects from store and clears all event listeners.
   */
  async disconnect(): Promise<void> {
    if (this.updateSubscription) {
      this.updateSubscription.remove();
      this.updateSubscription = null;
    }
    if (this.errorSubscription) {
      this.errorSubscription.remove();
      this.errorSubscription = null;
    }

    const RNIap = getRNIap();
    if (this.isConnected && RNIap && Platform.OS !== 'web') {
      try {
        await RNIap.endConnection();
      } catch (err) {
        console.warn('[IAP] Error ending connection:', err);
      }
      this.isConnected = false;
    }
  }

  /**
   * Subscribes to ad-free status updates.
   */
  subscribe(listener: AdFreeListener): () => void {
    this.listeners.add(listener);
    listener(this.cachedAdFreeStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns whether the user is currently ad-free.
   */
  getAdFreeStatus(): boolean {
    return this.cachedAdFreeStatus;
  }

  /**
   * Fetches product localized details from store or returns default metadata.
   */
  async getProducts(): Promise<AdFreeProductItem[]> {
    const RNIap = getRNIap();
    if (!this.isConnected || !RNIap || Platform.OS === 'web') {
      return DEFAULT_PRODUCTS;
    }

    try {
      const subsRes = await RNIap.fetchProducts({
        skus: [IAP_SKUS.AD_FREE_MONTHLY],
        type: 'subs',
      });

      const products: AdFreeProductItem[] = [];

      const monthly = subsRes?.find((p) => p.id === IAP_SKUS.AD_FREE_MONTHLY);
      if (monthly) {
        products.push({
          id: monthly.id,
          title: monthly.title || 'Ad-Free Monthly Patron',
          description: monthly.description || 'Remove sponsor banners with monthly flexibility.',
          price: monthly.displayPrice || '$1.99 / mo',
          type: 'subs',
        });
      } else {
        products.push(DEFAULT_PRODUCTS[0]);
      }

      return products;
    } catch (err) {
      console.warn('[IAP] Failed to fetch products from store, using fallback metadata:', err);
      return DEFAULT_PRODUCTS;
    }
  }

  /**
   * Initiates a purchase flow for the specified SKU.
   */
  async purchase(sku: string): Promise<{ success: boolean; message?: string }> {
    const RNIap = getRNIap();
    // Web / Simulator test simulation / missing native module
    if (Platform.OS === 'web' || !this.isConnected || !RNIap) {
      console.log('[IAP] Simulating purchase in web / dev environment for SKU:', sku);
      await this.grantEntitlement(true);
      return { success: true };
    }

    try {
      const isSub = sku === IAP_SKUS.AD_FREE_MONTHLY;
      await RNIap.requestPurchase({
        request: {
          apple: { sku },
          google: { skus: [sku] },
        },
        type: isSub ? 'subs' : 'in-app',
      });

      return { success: true };
    } catch (error: any) {
      console.error('[IAP] Purchase request failed:', error);
      return {
        success: false,
        message: error?.message || 'Transaction could not be completed with the store.',
      };
    }
  }

  /**
   * Restores existing purchases for the user and updates SQLite entitlements.
   */
  async restore(): Promise<{ restored: boolean; count: number }> {
    const RNIap = getRNIap();
    if (Platform.OS === 'web' || !this.isConnected || !RNIap) {
      const current = await isAdFreeUser();
      return { restored: current, count: current ? 1 : 0 };
    }

    try {
      await RNIap.restorePurchases();
      const purchases = await RNIap.getAvailablePurchases();
      let matchedCount = 0;

      for (const purchase of purchases || []) {
        if (purchase.productId === IAP_SKUS.AD_FREE_MONTHLY) {
          matchedCount++;
          await RNIap.finishTransaction({ purchase, isConsumable: false });
        }
      }

      if (matchedCount > 0) {
        await this.grantEntitlement(true);
        return { restored: true, count: matchedCount };
      }

      return { restored: false, count: 0 };
    } catch (error) {
      console.warn('[IAP] Restore purchases failed:', error);
      return { restored: false, count: 0 };
    }
  }

  /**
   * Toggles simulated ad-free status for developer testing or demo purposes.
   */
  async setSimulatedAdFree(enabled: boolean): Promise<void> {
    await this.grantEntitlement(enabled);
  }

  /**
   * Reconciles available purchases and finalizes any unfinished transactions.
   */
  private async reconcileAvailablePurchases(): Promise<void> {
    const RNIap = getRNIap();
    if (!RNIap) return;
    try {
      const purchases = await RNIap.getAvailablePurchases();
      for (const purchase of purchases || []) {
        if (purchase.productId === IAP_SKUS.AD_FREE_MONTHLY) {
          await RNIap.finishTransaction({ purchase, isConsumable: false });
          await this.grantEntitlement(true);
        }
      }
    } catch (error) {
      console.warn('[IAP] Could not reconcile available purchases:', error);
    }
  }

  /**
   * Handles a verified purchase delivered by the store listener.
   */
  private async handlePurchase(purchase: Purchase): Promise<void> {
    const RNIap = getRNIap();
    try {
      if (purchase.productId === IAP_SKUS.AD_FREE_MONTHLY) {
        // Finalize transaction
        if (RNIap) {
          await RNIap.finishTransaction({ purchase, isConsumable: false });
        }
        await this.grantEntitlement(true);
        console.log('[IAP] Transaction finished and entitlement granted for:', purchase.productId);
      }
    } catch (error) {
      console.error('[IAP] Error processing purchase:', error);
    }
  }

  /**
   * Persists entitlement in SQLite and notifies active listeners.
   */
  private async grantEntitlement(isAdFree: boolean): Promise<void> {
    this.cachedAdFreeStatus = isAdFree;
    try {
      await setAdFreeUser(isAdFree);
    } catch (err) {
      console.warn('[IAP] Failed to write ad-free status to SQLite:', err);
    }
    this.notifyListeners(isAdFree);
  }

  private notifyListeners(isAdFree: boolean): void {
    this.listeners.forEach((listener) => {
      try {
        listener(isAdFree);
      } catch (err) {
        console.error('[IAP] Error in status listener:', err);
      }
    });
  }
}

export const iapService = new IAPService();
