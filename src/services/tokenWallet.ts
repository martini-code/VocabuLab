import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const inMemoryStorage: Record<string, string> = {};

export const Storage = {
  getItemAsync: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
        return inMemoryStorage[key] ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return inMemoryStorage[key] ?? null;
    }
  },
  setItemAsync: async (key: string, val: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, val);
        } else {
          inMemoryStorage[key] = val;
        }
        return;
      }
      await SecureStore.setItemAsync(key, val);
    } catch {
      inMemoryStorage[key] = val;
    }
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        } else {
          delete inMemoryStorage[key];
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      delete inMemoryStorage[key];
    }
  },
};

export const KEYS = {
  TOKENS: 'vk_tokens_count',
  WORD_CREDITS: 'vk_unlocked_word_credits',
  DAILY_WORDS: 'vk_daily_pass_words',
  DAILY_DATE: 'vk_daily_pass_date',
  ADS_WATCHED: 'vk_ads_watched_today',
  ADS_DATE: 'vk_ads_last_date',
};

import { TOKEN_CONFIG } from '../config/secrets';
export { TOKEN_CONFIG };

export interface TokenWalletState {
  tokens: number;
  tokenWordCredits: number;
  dailyPassWords: number;
  totalWordsAllowance: number;
  adsWatchedToday: number;
  maxDailyAds: number;
  canWatchAd: boolean;
  maxTokensHeld: number;
}

type WalletListener = (state: TokenWalletState) => void;

export class TokenWalletService {
  private listeners: Set<WalletListener> = new Set();
  private initialized = false;
  private mockDateProvider: (() => string) | null = null;
  private unlimited = false;

  /**
   * Lab Pass holders learn without a word allowance: nothing is checked or
   * deducted while this is on, so they never need a rewarded ad for tokens.
   */
  setUnlimited(enabled: boolean): void {
    this.unlimited = enabled;
  }

  /**
   * For testing purposes: mock the current date format (YYYY-MM-DD).
   */
  setMockDate(dateStr: string | null): void {
    if (dateStr) {
      this.mockDateProvider = () => dateStr;
    } else {
      this.mockDateProvider = null;
    }
  }

  private todayDateString(): string {
    if (this.mockDateProvider) {
      return this.mockDateProvider();
    }
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * For testing purposes: reset in-memory state.
   */
  async _resetForTesting(): Promise<void> {
    this.initialized = false;
    this.mockDateProvider = null;
    this.unlimited = false;
    this.listeners.clear();
    await Promise.all([
      Storage.deleteItemAsync(KEYS.TOKENS),
      Storage.deleteItemAsync(KEYS.WORD_CREDITS),
      Storage.deleteItemAsync(KEYS.DAILY_WORDS),
      Storage.deleteItemAsync(KEYS.DAILY_DATE),
      Storage.deleteItemAsync(KEYS.ADS_WATCHED),
      Storage.deleteItemAsync(KEYS.ADS_DATE),
    ]);
  }

  /**
   * Directly sets the wallet state for developer profile switching and testing.
   */
  async setWalletStateForTesting(
    tokens: number,
    wordCredits = 0,
    dailyWords = TOKEN_CONFIG.DAILY_PASS_WORDS
  ): Promise<void> {
    const clampedTokens = Math.min(Math.max(0, tokens), TOKEN_CONFIG.MAX_TOKENS_HELD);
    const today = this.todayDateString();
    await Storage.setItemAsync(KEYS.TOKENS, String(clampedTokens));
    await Storage.setItemAsync(KEYS.WORD_CREDITS, String(wordCredits));
    await Storage.setItemAsync(KEYS.DAILY_WORDS, String(dailyWords));
    await Storage.setItemAsync(KEYS.DAILY_DATE, today);
    await Storage.setItemAsync(KEYS.ADS_WATCHED, '0');
    await Storage.setItemAsync(KEYS.ADS_DATE, today);
    await this.notify();
  }

  private parseNumber(val: string | null, fallback: number): number {
    if (val === null || val === undefined) return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  }

  async initTokenWallet(): Promise<void> {
    if (this.initialized) return;

    try {
      const existingTokens = await Storage.getItemAsync(KEYS.TOKENS);
      if (existingTokens === null) {
        // First app launch: grant initial tokens (capped at MAX_TOKENS_HELD)
        const initial = Math.min(TOKEN_CONFIG.INITIAL_TOKENS, TOKEN_CONFIG.MAX_TOKENS_HELD);
        await Storage.setItemAsync(KEYS.TOKENS, String(initial));
        await Storage.setItemAsync(KEYS.WORD_CREDITS, '0');
      }

      await this.checkDailyReset();
      this.initialized = true;
    } catch (e) {
      console.warn('[TokenWallet] Initialization notice:', e);
      this.initialized = true;
    }
  }

  /**
   * Checks and resets daily non-cumulative pass (2 words) and daily ad count (max 3)
   * if the current calendar date differs from the last active date.
   */
  async checkDailyReset(): Promise<void> {
    const today = this.todayDateString();

    // 1. Daily Pass Reset (non-cumulative 2 words on daily login)
    const storedDailyDate = await Storage.getItemAsync(KEYS.DAILY_DATE);
    if (storedDailyDate !== today) {
      await Storage.setItemAsync(KEYS.DAILY_WORDS, String(TOKEN_CONFIG.DAILY_PASS_WORDS));
      await Storage.setItemAsync(KEYS.DAILY_DATE, today);
    }

    // 2. Daily Ads Count Reset (resets to 0)
    const storedAdsDate = await Storage.getItemAsync(KEYS.ADS_DATE);
    if (storedAdsDate !== today) {
      await Storage.setItemAsync(KEYS.ADS_WATCHED, '0');
      await Storage.setItemAsync(KEYS.ADS_DATE, today);
    }

    // Note: notify() is triggered on state changes (consume, ad watch, etc.),
    // not during read/checkDailyReset to prevent infinite async re-entry loops.
  }

  async getWalletStatus(): Promise<TokenWalletState> {
    await this.initTokenWallet();
    await this.checkDailyReset();

    const [rawTokens, rawCredits, rawDailyWords, rawAds] = await Promise.all([
      Storage.getItemAsync(KEYS.TOKENS),
      Storage.getItemAsync(KEYS.WORD_CREDITS),
      Storage.getItemAsync(KEYS.DAILY_WORDS),
      Storage.getItemAsync(KEYS.ADS_WATCHED),
    ]);

    const parsedTokens = this.parseNumber(rawTokens, TOKEN_CONFIG.INITIAL_TOKENS);
    const tokens = Math.min(Math.max(0, parsedTokens), TOKEN_CONFIG.MAX_TOKENS_HELD);
    const tokenWordCredits = this.parseNumber(rawCredits, 0);
    const dailyPassWords = this.parseNumber(rawDailyWords, TOKEN_CONFIG.DAILY_PASS_WORDS);
    const adsWatchedToday = this.parseNumber(rawAds, 0);

    const totalWordsAllowance =
      dailyPassWords + tokenWordCredits + tokens * TOKEN_CONFIG.WORDS_PER_TOKEN;
    const canWatchAd =
      adsWatchedToday < TOKEN_CONFIG.MAX_DAILY_ADS && tokens < TOKEN_CONFIG.MAX_TOKENS_HELD;

    return {
      tokens,
      tokenWordCredits,
      dailyPassWords,
      totalWordsAllowance,
      adsWatchedToday,
      maxDailyAds: TOKEN_CONFIG.MAX_DAILY_ADS,
      canWatchAd,
      maxTokensHeld: TOKEN_CONFIG.MAX_TOKENS_HELD,
    };
  }

  async canLearnWords(count: number): Promise<boolean> {
    if (count <= 0 || this.unlimited) return true;
    const status = await this.getWalletStatus();
    return status.totalWordsAllowance >= count;
  }

  /**
   * Consumes words from the user's allowance:
   * 1. Uses non-cumulative Daily Pass words first.
   * 2. Uses remaining active token word credits.
   * 3. Breaks tokens into word credits (+10 words each) as needed.
   */
  async consumeWordAllowance(count: number): Promise<boolean> {
    if (count <= 0 || this.unlimited) return true;

    const status = await this.getWalletStatus();
    if (status.totalWordsAllowance < count) {
      return false;
    }

    let remainingToDeduct = count;
    let newDailyWords = status.dailyPassWords;
    let newCredits = status.tokenWordCredits;
    let newTokens = status.tokens;

    // 1. Deduct from Daily Pass first
    if (newDailyWords > 0) {
      const deductFromDaily = Math.min(newDailyWords, remainingToDeduct);
      newDailyWords -= deductFromDaily;
      remainingToDeduct -= deductFromDaily;
    }

    // 2. Deduct from active Token Word Credits
    if (remainingToDeduct > 0 && newCredits > 0) {
      const deductFromCredits = Math.min(newCredits, remainingToDeduct);
      newCredits -= deductFromCredits;
      remainingToDeduct -= deductFromCredits;
    }

    // 3. Break tokens if still more words needed
    while (remainingToDeduct > 0 && newTokens > 0) {
      newTokens -= 1;
      newCredits += TOKEN_CONFIG.WORDS_PER_TOKEN;
      const deduct = Math.min(newCredits, remainingToDeduct);
      newCredits -= deduct;
      remainingToDeduct -= deduct;
    }

    if (remainingToDeduct > 0) {
      return false;
    }

    await Promise.all([
      Storage.setItemAsync(KEYS.DAILY_WORDS, String(newDailyWords)),
      Storage.setItemAsync(KEYS.WORD_CREDITS, String(newCredits)),
      Storage.setItemAsync(KEYS.TOKENS, String(newTokens)),
    ]);

    await this.notify();
    return true;
  }

  async canWatchRewardedAd(): Promise<boolean> {
    const status = await this.getWalletStatus();
    return status.canWatchAd;
  }

  /**
   * Rewards user with +1 token after a completed AdMob rewarded ad.
   * Increments daily ad watch counter.
   */
  async recordRewardedAdWatch(): Promise<{ success: boolean; newTokens: number }> {
    const status = await this.getWalletStatus();
    if (
      status.adsWatchedToday >= TOKEN_CONFIG.MAX_DAILY_ADS ||
      status.tokens >= TOKEN_CONFIG.MAX_TOKENS_HELD
    ) {
      return { success: false, newTokens: status.tokens };
    }

    const newTokens = Math.min(status.tokens + 1, TOKEN_CONFIG.MAX_TOKENS_HELD);
    const newAdsWatched = status.adsWatchedToday + 1;

    await Promise.all([
      Storage.setItemAsync(KEYS.TOKENS, String(newTokens)),
      Storage.setItemAsync(KEYS.ADS_WATCHED, String(newAdsWatched)),
      Storage.setItemAsync(KEYS.ADS_DATE, this.todayDateString()),
    ]);

    await this.notify();
    return { success: true, newTokens };
  }

  subscribe(listener: WalletListener): () => void {
    this.listeners.add(listener);
    this.getWalletStatus().then(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notify() {
    if (this.listeners.size === 0) return;
    try {
      const status = await this.getWalletStatus();
      this.listeners.forEach((l) => l(status));
    } catch {
      // Ignore
    }
  }
}

export const tokenWallet = new TokenWalletService();
