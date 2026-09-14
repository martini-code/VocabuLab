// src/services/sapphireWallet.ts
// -------------------------------------------------------------------
// Sapphire Wallet Service
// -------------------------------------------------------------------
// This service abstracts all logic related to the "Sapphire" economy:
//   • Initial grant of 3 sapphires on first launch
//   • Daily ad cap (max 3 rewarded ads per day)
//   • Maximum wallet vault of 5 sapphires
//   • Secure persistence via expo‑secure‑store (fallback to AsyncStorage for web)
//   • Simple API used by UI components & DB helpers
// -------------------------------------------------------------------

import { Platform } from 'react-native';

// Expo SecureStore – works on iOS/Android, web fallback uses AsyncStorage
let SecureStore: any;
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require('@react-native-async-storage/async-storage');
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require('expo-secure-store');
}

/**
 * Keys used in SecureStore / AsyncStorage.
 */
const KEYS = {
  BALANCE: 'sapphire_balance',
  ADS_WATCHED: 'ads_watched_today',
  LAST_RESET: 'ads_last_reset',
};

/** Configuration constants */
const CONFIG = {
  INITIAL_GRANT: 3,
  DAILY_AD_CAP: 3,
  MAX_VAULT: 5,
};

/** Helper to parse stored string values safely */
const parseNumber = (value: string | null, fallback: number): number => {
  const n = Number(value);
  return isNaN(n) ? fallback : n;
};

/** Returns today’s date string in YYYY‑MM‑DD format (local time) */
const todayString = (): string => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

/** Initialise the wallet on first app launch.
 * Creates stored keys if they do not exist.
 */
export const initWallet = async (): Promise<void> => {
  const bal = await SecureStore.getItemAsync(KEYS.BALANCE);
  if (bal === null) {
    await SecureStore.setItemAsync(KEYS.BALANCE, String(CONFIG.INITIAL_GRANT));
  }
  const ads = await SecureStore.getItemAsync(KEYS.ADS_WATCHED);
  if (ads === null) {
    await SecureStore.setItemAsync(KEYS.ADS_WATCHED, '0');
  }
  const last = await SecureStore.getItemAsync(KEYS.LAST_RESET);
  if (last === null) {
    await SecureStore.setItemAsync(KEYS.LAST_RESET, todayString());
  }
};

/** Retrieve the current sapphire balance */
export const getBalance = async (): Promise<number> => {
  const raw = await SecureStore.getItemAsync(KEYS.BALANCE);
  return parseNumber(raw, 0);
};

/** Retrieve how many rewarded ads have been watched today */
export const getAdsWatchedToday = async (): Promise<number> => {
  await _maybeResetDailyCounter();
  const raw = await SecureStore.getItemAsync(KEYS.ADS_WATCHED);
  return parseNumber(raw, 0);
};

/** Check if the user can watch another rewarded ad today */
export const canWatchAd = async (): Promise<boolean> => {
  const watched = await getAdsWatchedToday();
  return watched < CONFIG.DAILY_AD_CAP;
};

/** Increment the ad‑watch counter (called after a successful rewarded ad) */
export const recordAdWatch = async (): Promise<void> => {
  await _maybeResetDailyCounter();
  const current = await getAdsWatchedToday();
  const next = Math.min(current + 1, CONFIG.DAILY_AD_CAP);
  await SecureStore.setItemAsync(KEYS.ADS_WATCHED, String(next));
};

/** Reward the user with one sapphire after a completed ad (obeys max vault) */
export const rewardAdCompleted = async (): Promise<void> => {
  const balance = await getBalance();
  if (balance < CONFIG.MAX_VAULT) {
    await SecureStore.setItemAsync(KEYS.BALANCE, String(balance + 1));
  }
  await recordAdWatch();
};

/** Attempt to spend a given amount of sapphires. Returns true on success. */
export const spendSapphire = async (amount: number = 1): Promise<boolean> => {
  if (amount <= 0) return false;
  const balance = await getBalance();
  if (balance >= amount) {
    await SecureStore.setItemAsync(KEYS.BALANCE, String(balance - amount));
    return true;
  }
  return false;
};

/** Internal: reset daily ad counters if the stored date is older than today. */
const _maybeResetDailyCounter = async (): Promise<void> => {
  const lastReset = await SecureStore.getItemAsync(KEYS.LAST_RESET);
  const today = todayString();
  if (lastReset !== today) {
    await SecureStore.setItemAsync(KEYS.ADS_WATCHED, '0');
    await SecureStore.setItemAsync(KEYS.LAST_RESET, today);
  }
};

/** Convenience: expose the whole wallet state for debugging / UI display */
export const getWalletState = async (): Promise<{ balance: number; adsWatchedToday: number; canWatchMoreAds: boolean }> => {
  const [balance, adsWatched] = await Promise.all([getBalance(), getAdsWatchedToday()]);
  return { balance, adsWatchedToday: adsWatched, canWatchMoreAds: adsWatched < CONFIG.DAILY_AD_CAP };
};

// Initialise on import
initWallet().catch((e) => {
  // eslint-disable-next-line no-console
  console.warn('[SapphireWallet] Failed to initialise wallet:', e);
});
