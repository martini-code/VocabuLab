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
    it('initializes wallet with values derived from TOKEN_CONFIG', async () => {
      tokenWallet.setMockDate('2026-09-17');
      const status = await tokenWallet.getWalletStatus();

      expect(status.tokens).toBe(TOKEN_CONFIG.INITIAL_TOKENS);
      expect(status.tokenWordCredits).toBe(0);
      expect(status.dailyPassWords).toBe(TOKEN_CONFIG.DAILY_PASS_WORDS);
      const expectedTotal =
        TOKEN_CONFIG.DAILY_PASS_WORDS + TOKEN_CONFIG.INITIAL_TOKENS * TOKEN_CONFIG.WORDS_PER_TOKEN;
      expect(status.totalWordsAllowance).toBe(expectedTotal);
      expect(status.adsWatchedToday).toBe(0);
      expect(status.canWatchAd).toBe(true);
    });
  });

  describe('Word Consumption Deductions', () => {
    it('deducts from daily pass first before touching tokens', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      const wordsToConsume = Math.min(3, TOKEN_CONFIG.DAILY_PASS_WORDS);
      const success = await tokenWallet.consumeWordAllowance(wordsToConsume);
      expect(success).toBe(true);

      const status = await tokenWallet.getWalletStatus();
      expect(status.dailyPassWords).toBe(TOKEN_CONFIG.DAILY_PASS_WORDS - wordsToConsume);
      expect(status.tokens).toBe(TOKEN_CONFIG.INITIAL_TOKENS);
      expect(status.tokenWordCredits).toBe(0);
      const expectedRemaining =
        TOKEN_CONFIG.DAILY_PASS_WORDS -
        wordsToConsume +
        TOKEN_CONFIG.INITIAL_TOKENS * TOKEN_CONFIG.WORDS_PER_TOKEN;
      expect(status.totalWordsAllowance).toBe(expectedRemaining);
    });

    it('breaks tokens into word credits when daily pass is exhausted', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      // Consume all daily pass words + 3 words from first broken token
      const extraWords = 3;
      const totalToConsume = TOKEN_CONFIG.DAILY_PASS_WORDS + extraWords;
      const success = await tokenWallet.consumeWordAllowance(totalToConsume);
      expect(success).toBe(true);

      const status = await tokenWallet.getWalletStatus();
      expect(status.dailyPassWords).toBe(0);
      expect(status.tokens).toBe(TOKEN_CONFIG.INITIAL_TOKENS - 1);
      expect(status.tokenWordCredits).toBe(TOKEN_CONFIG.WORDS_PER_TOKEN - extraWords);
      const expectedRemaining =
        (TOKEN_CONFIG.INITIAL_TOKENS - 1) * TOKEN_CONFIG.WORDS_PER_TOKEN +
        (TOKEN_CONFIG.WORDS_PER_TOKEN - extraWords);
      expect(status.totalWordsAllowance).toBe(expectedRemaining);
    });

    it('rejects consumption when requested count exceeds total allowance', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      const total =
        TOKEN_CONFIG.DAILY_PASS_WORDS + TOKEN_CONFIG.INITIAL_TOKENS * TOKEN_CONFIG.WORDS_PER_TOKEN;
      const excess = total + 5;
      const canLearn = await tokenWallet.canLearnWords(excess);
      expect(canLearn).toBe(false);

      const success = await tokenWallet.consumeWordAllowance(excess);
      expect(success).toBe(false);

      // State remains completely intact
      const status = await tokenWallet.getWalletStatus();
      expect(status.tokens).toBe(TOKEN_CONFIG.INITIAL_TOKENS);
      expect(status.dailyPassWords).toBe(TOKEN_CONFIG.DAILY_PASS_WORDS);
      expect(status.totalWordsAllowance).toBe(total);
    });

    it('can consume exact total allowance down to zero', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      const total =
        TOKEN_CONFIG.DAILY_PASS_WORDS + TOKEN_CONFIG.INITIAL_TOKENS * TOKEN_CONFIG.WORDS_PER_TOKEN;
      const success = await tokenWallet.consumeWordAllowance(total);
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
    it('resets daily pass non-cumulatively to configured daily pass on a new day', async () => {
      // Day 1: 2026-09-17
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      const toConsume = Math.max(1, TOKEN_CONFIG.DAILY_PASS_WORDS - 1);
      await tokenWallet.consumeWordAllowance(toConsume);
      const statusDay1 = await tokenWallet.getWalletStatus();
      expect(statusDay1.dailyPassWords).toBe(TOKEN_CONFIG.DAILY_PASS_WORDS - toConsume);

      // Day 2: 2026-09-18
      tokenWallet.setMockDate('2026-09-18');
      const statusDay2 = await tokenWallet.getWalletStatus();

      // Daily pass should reset non-cumulatively to DAILY_PASS_WORDS
      expect(statusDay2.dailyPassWords).toBe(TOKEN_CONFIG.DAILY_PASS_WORDS);
      expect(statusDay2.tokens).toBe(TOKEN_CONFIG.INITIAL_TOKENS);
      const expectedTotal =
        TOKEN_CONFIG.DAILY_PASS_WORDS + TOKEN_CONFIG.INITIAL_TOKENS * TOKEN_CONFIG.WORDS_PER_TOKEN;
      expect(statusDay2.totalWordsAllowance).toBe(expectedTotal);
    });

    it('does not reset daily pass if the date has not changed', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      const toConsume = Math.min(3, TOKEN_CONFIG.DAILY_PASS_WORDS);
      await tokenWallet.consumeWordAllowance(toConsume);
      const status1 = await tokenWallet.getWalletStatus();
      expect(status1.dailyPassWords).toBe(TOKEN_CONFIG.DAILY_PASS_WORDS - toConsume);

      // Re-query within same day
      const status2 = await tokenWallet.getWalletStatus();
      expect(status2.dailyPassWords).toBe(TOKEN_CONFIG.DAILY_PASS_WORDS - toConsume);
    });
  });

  describe('Rewarded Ad Limits & Daily Resets', () => {
    it('awards +1 token per watched ad up to MAX_DAILY_ADS', async () => {
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();

      for (let i = 0; i < TOKEN_CONFIG.MAX_DAILY_ADS; i++) {
        const res = await tokenWallet.recordRewardedAdWatch();
        expect(res.success).toBe(true);
        expect(res.newTokens).toBe(TOKEN_CONFIG.INITIAL_TOKENS + i + 1);
      }

      const status = await tokenWallet.getWalletStatus();
      expect(status.adsWatchedToday).toBe(TOKEN_CONFIG.MAX_DAILY_ADS);
      expect(status.canWatchAd).toBe(false);

      // Next ad: should be rejected due to daily cap
      const resOverflow = await tokenWallet.recordRewardedAdWatch();
      expect(resOverflow.success).toBe(false);
      expect(resOverflow.newTokens).toBe(TOKEN_CONFIG.INITIAL_TOKENS + TOKEN_CONFIG.MAX_DAILY_ADS);
    });

    it('resets adsWatchedToday counter on a new calendar date while preserving earned tokens', async () => {
      // Day 1: Watch max ads
      tokenWallet.setMockDate('2026-09-17');
      await tokenWallet.initTokenWallet();
      for (let i = 0; i < TOKEN_CONFIG.MAX_DAILY_ADS; i++) {
        await tokenWallet.recordRewardedAdWatch();
      }

      const day1Status = await tokenWallet.getWalletStatus();
      const expectedTokens = TOKEN_CONFIG.INITIAL_TOKENS + TOKEN_CONFIG.MAX_DAILY_ADS;
      expect(day1Status.tokens).toBe(expectedTokens);
      expect(day1Status.adsWatchedToday).toBe(TOKEN_CONFIG.MAX_DAILY_ADS);
      expect(day1Status.canWatchAd).toBe(false);

      // Day 2: 2026-09-18
      tokenWallet.setMockDate('2026-09-18');
      const day2Status = await tokenWallet.getWalletStatus();

      expect(day2Status.tokens).toBe(expectedTokens); // Preserved tokens
      expect(day2Status.adsWatchedToday).toBe(0); // Reset ads count
      expect(day2Status.canWatchAd).toBe(true); // Can watch ads again

      // Should allow watching an ad on Day 2
      const day2Ad = await tokenWallet.recordRewardedAdWatch();
      expect(day2Ad.success).toBe(true);
      expect(day2Ad.newTokens).toBe(expectedTokens + 1);
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
