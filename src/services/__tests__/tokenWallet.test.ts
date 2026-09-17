import { tokenWallet, TOKEN_CONFIG, Storage, KEYS, inMemoryStorage } from '../tokenWallet';

const mockStorage: Record<string, string> = inMemoryStorage;

// Mock Platform and expo-secure-store to run in node environment cleanly
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStorage[key] ?? null),
  setItemAsync: jest.fn(async (key: string, val: string) => {
    mockStorage[key] = val;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

describe('TokenWalletService (tokenWallet.ts)', () => {
  beforeEach(async () => {
    // Clear storage before each test
    for (const k of Object.keys(mockStorage)) {
      delete mockStorage[k];
    }
    await tokenWallet._resetForTesting();
  });

  describe('Initial Onboarding & Defaults', () => {
    it('initializes wallet with 2 tokens and 5 daily pass words (total: 25 words)', async () => {
      tokenWallet.setMockDate('2026-09-17');
      const status = await tokenWallet.getWalletStatus();

      expect(status.tokens).toBe(TOKEN_CONFIG.INITIAL_TOKENS); // 2 tokens
      expect(status.tokenWordCredits).toBe(0);
      expect(status.dailyPassWords).toBe(TOKEN_CONFIG.DAILY_PASS_WORDS); // 5 words
      expect(status.totalWordsAllowance).toBe(25); // 5 + 0 + (2 * 10) = 25 words
      expect(status.adsWatchedToday).toBe(0);
      expect(status.canWatchAd).toBe(true);
    });
  });

  describe('Word Consumption Deductions', () => {
    it('deducts from daily pass first before touching tokens', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      // Consume 3 words: should deduct from daily pass (5 -> 2)
      const success = await tokenWallet.consumeWordAllowance(3);
      expect(success).toBe(true);

      const status = await tokenWallet.getWalletStatus();
      expect(status.dailyPassWords).toBe(2);
      expect(status.tokens).toBe(2);
      expect(status.tokenWordCredits).toBe(0);
      expect(status.totalWordsAllowance).toBe(22); // 2 + (2 * 10) = 22
    });

    it('breaks tokens into word credits when daily pass is exhausted', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      // Consume 8 words: 5 from daily pass, then break 1 token (10 credits) -> 3 credits used, 7 remain
      const success = await tokenWallet.consumeWordAllowance(8);
      expect(success).toBe(true);

      const status = await tokenWallet.getWalletStatus();
      expect(status.dailyPassWords).toBe(0);
      expect(status.tokens).toBe(1); // 2 - 1 = 1 token
      expect(status.tokenWordCredits).toBe(7); // 10 - 3 = 7 credits
      expect(status.totalWordsAllowance).toBe(17); // 7 + 10 = 17 words
    });

    it('rejects consumption when requested count exceeds total allowance', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      // Total allowance is 25. Request 30 words:
      const canLearn = await tokenWallet.canLearnWords(30);
      expect(canLearn).toBe(false);

      const success = await tokenWallet.consumeWordAllowance(30);
      expect(success).toBe(false);

      // State remains completely intact
      const status = await tokenWallet.getWalletStatus();
      expect(status.tokens).toBe(2);
      expect(status.dailyPassWords).toBe(5);
      expect(status.totalWordsAllowance).toBe(25);
    });

    it('can consume exact total allowance down to zero', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      const success = await tokenWallet.consumeWordAllowance(25);
      expect(success).toBe(true);

      const status = await tokenWallet.getWalletStatus();
      expect(status.dailyPassWords).toBe(0);
      expect(status.tokens).toBe(0);
      expect(status.tokenWordCredits).toBe(0);
      expect(status.totalWordsAllowance).toBe(0);
      expect(await tokenWallet.canLearnWords(1)).toBe(false);
    });
  });

  describe('Daily Login Pass Reset Across Mock Dates', () => {
    it('resets daily pass non-cumulatively to 5 on a new day', async () => {
      // Day 1: 2026-09-17
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      // User consumes 4 words, leaving 1 daily word
      await tokenWallet.consumeWordAllowance(4);
      let statusDay1 = await tokenWallet.getWalletStatus();
      expect(statusDay1.dailyPassWords).toBe(1);

      // Day 2: 2026-09-18
      tokenWallet.setMockDate('2026-09-18');
      let statusDay2 = await tokenWallet.getWalletStatus();

      // Daily pass should reset non-cumulatively to 5 (not 1 + 5 = 6)
      expect(statusDay2.dailyPassWords).toBe(5);
      expect(statusDay2.tokens).toBe(2);
      expect(statusDay2.totalWordsAllowance).toBe(25);
    });

    it('does not reset daily pass if the date has not changed', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      await tokenWallet.consumeWordAllowance(3);
      const status1 = await tokenWallet.getWalletStatus();
      expect(status1.dailyPassWords).toBe(2);

      // Re-query within same day
      const status2 = await tokenWallet.getWalletStatus();
      expect(status2.dailyPassWords).toBe(2);
    });
  });

  describe('Rewarded Ad Limits & Daily Resets', () => {
    it('awards +1 token per watched ad up to MAX_DAILY_ADS (3)', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      // Ad 1
      const res1 = await tokenWallet.recordRewardedAdWatch();
      expect(res1.success).toBe(true);
      expect(res1.newTokens).toBe(3); // 2 + 1 = 3

      // Ad 2
      const res2 = await tokenWallet.recordRewardedAdWatch();
      expect(res2.success).toBe(true);
      expect(res2.newTokens).toBe(4);

      // Ad 3
      const res3 = await tokenWallet.recordRewardedAdWatch();
      expect(res3.success).toBe(true);
      expect(res3.newTokens).toBe(5);

      const status = await tokenWallet.getWalletStatus();
      expect(status.adsWatchedToday).toBe(3);
      expect(status.canWatchAd).toBe(false);

      // Ad 4: should be rejected due to daily cap
      const res4 = await tokenWallet.recordRewardedAdWatch();
      expect(res4.success).toBe(false);
      expect(res4.newTokens).toBe(5);
    });

    it('resets adsWatchedToday counter on a new calendar date while preserving earned tokens', async () => {
      // Day 1: Watch max 3 ads
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();
      await tokenWallet.recordRewardedAdWatch();
      await tokenWallet.recordRewardedAdWatch();
      await tokenWallet.recordRewardedAdWatch();

      const day1Status = await tokenWallet.getWalletStatus();
      expect(day1Status.tokens).toBe(5);
      expect(day1Status.adsWatchedToday).toBe(3);
      expect(day1Status.canWatchAd).toBe(false);

      // Day 2: 2026-09-18
      tokenWallet.setMockDate('2026-09-18');
      const day2Status = await tokenWallet.getWalletStatus();

      expect(day2Status.tokens).toBe(5); // Preserved tokens
      expect(day2Status.adsWatchedToday).toBe(0); // Reset ads count
      expect(day2Status.canWatchAd).toBe(true); // Can watch ads again

      // Should allow watching an ad on Day 2
      const day2Ad = await tokenWallet.recordRewardedAdWatch();
      expect(day2Ad.success).toBe(true);
      expect(day2Ad.newTokens).toBe(6);
    });
  });

  describe('Reactive Subscriptions', () => {
    it('notifies subscribers upon word consumption and ad watch', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      const mockListener = jest.fn();
      const unsub = tokenWallet.subscribe(mockListener);

      // Wait a microtick for initial status notification
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockListener).toHaveBeenCalled();

      mockListener.mockClear();
      await tokenWallet.consumeWordAllowance(2);
      expect(mockListener).toHaveBeenCalled();

      mockListener.mockClear();
      await tokenWallet.recordRewardedAdWatch();
      expect(mockListener).toHaveBeenCalled();

      // Unsubscribe
      unsub();
      mockListener.mockClear();
      await tokenWallet.consumeWordAllowance(1);
      expect(mockListener).not.toHaveBeenCalled();
    });
  });
});
