/**
 * Direct In-App Purchase Service using react-native-iap (Apple StoreKit 2 & Google Play Billing)
 * Zero third-party middlemen. Fully offline-resilient entitlement persistence via SQLite.
 */

import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';
import { isAdFreeUser, setAdFreeUser } from '../db/vault';

// Official Product SKUs
export const IAP_SKUS = {
  AD_FREE_LIFETIME: 'vocabkeep_adfree_lifetime',
  AD_FREE_MONTHLY: 'vocabkeep_adfree_monthly',
} as const;

export const ALL_AD_FREE_SKUS = [
  IAP_SKUS.AD_FREE_LIFETIME,
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
    id: IAP_SKUS.AD_FREE_LIFETIME,
    title: 'Ad-Free Lifetime Deed',
    description: 'Banish all merchant banners forever. Permanent kingdom entitlement.',
    price: '$9.99',
    type: 'in-app',
  },
  {
    id: IAP_SKUS.AD_FREE_MONTHLY,
    title: 'Ad-Free Monthly Patron',
    description: 'Banish merchant banners with monthly flexibility. Cancel anytime.',
    price: '$1.99 / mo',
    type: 'subs',
  },
];

type AdFreeListener = (isAdFree: boolean) => void;

class IAPService {
  private isConnected = false;
  private updateSubscription: RNIap.EventSubscription | null = null;
  private errorSubscription: RNIap.EventSubscription | null = null;
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

    // 2. Initialize native store connection
    try {
      this.isConnected = await RNIap.initConnection();
      console.log('[IAP] Connected to native billing store:', this.isConnected);

      // Register purchase update listener
      this.updateSubscription = RNIap.purchaseUpdatedListener(async (purchase: RNIap.Purchase) => {
        await this.handlePurchase(purchase);
      });

      // Register purchase error listener
      this.errorSubscription = RNIap.purchaseErrorListener((error: RNIap.PurchaseError) => {
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

    if (this.isConnected && Platform.OS !== 'web') {
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
    if (!this.isConnected || Platform.OS === 'web') {
      return DEFAULT_PRODUCTS;
    }

    try {
      const inAppRes = await RNIap.fetchProducts({
        skus: [IAP_SKUS.AD_FREE_LIFETIME],
        type: 'in-app',
      });

      const subsRes = await RNIap.fetchProducts({
        skus: [IAP_SKUS.AD_FREE_MONTHLY],
        type: 'subs',
      });

      const products: AdFreeProductItem[] = [];

      const lifetime = inAppRes?.find((p) => p.id === IAP_SKUS.AD_FREE_LIFETIME);
      if (lifetime) {
        products.push({
          id: lifetime.id,
          title: lifetime.title || 'Ad-Free Lifetime Deed',
          description: lifetime.description || 'Banish all merchant banners forever.',
          price: lifetime.displayPrice || '$9.99',
          type: 'in-app',
        });
      } else {
        products.push(DEFAULT_PRODUCTS[0]);
      }

      const monthly = subsRes?.find((p) => p.id === IAP_SKUS.AD_FREE_MONTHLY);
      if (monthly) {
        products.push({
          id: monthly.id,
          title: monthly.title || 'Ad-Free Monthly Patron',
          description: monthly.description || 'Banish merchant banners with monthly flexibility.',
          price: monthly.displayPrice || '$1.99 / mo',
          type: 'subs',
        });
      } else {
        products.push(DEFAULT_PRODUCTS[1]);
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
    // Web / Simulator test simulation
    if (Platform.OS === 'web' || !this.isConnected) {
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
    if (Platform.OS === 'web' || !this.isConnected) {
      const current = await isAdFreeUser();
      return { restored: current, count: current ? 1 : 0 };
    }

    try {
      await RNIap.restorePurchases();
      const purchases = await RNIap.getAvailablePurchases();
      let matchedCount = 0;

      for (const purchase of purchases || []) {
        if (
          purchase.productId === IAP_SKUS.AD_FREE_LIFETIME ||
          purchase.productId === IAP_SKUS.AD_FREE_MONTHLY
        ) {
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
    try {
      const purchases = await RNIap.getAvailablePurchases();
      for (const purchase of purchases || []) {
        if (
          purchase.productId === IAP_SKUS.AD_FREE_LIFETIME ||
          purchase.productId === IAP_SKUS.AD_FREE_MONTHLY
        ) {
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
  private async handlePurchase(purchase: RNIap.Purchase): Promise<void> {
    try {
      if (
        purchase.productId === IAP_SKUS.AD_FREE_LIFETIME ||
        purchase.productId === IAP_SKUS.AD_FREE_MONTHLY
      ) {
        // Finalize non-consumable transaction
        await RNIap.finishTransaction({ purchase, isConsumable: false });
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
