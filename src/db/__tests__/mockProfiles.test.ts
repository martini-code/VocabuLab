import Database from 'better-sqlite3';
import { USER_SCHEMA_SQL } from '../schema';
import {
  USER_PROFILES,
  UserProfilePreset,
  generateMockProfileData,
  seedMockUserProfile,
} from '../mockProfiles';
import { tokenWallet } from '../../services/tokenWallet';

describe('Mock User Profiles & Seed Engine (better-sqlite3)', () => {
  let db: any;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(USER_SCHEMA_SQL);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    jest.restoreAllMocks();
  });

  describe('USER_PROFILES metadata definitions', () => {
    const presets: UserProfilePreset[] = ['beginner', 'intermediate', 'advanced', 'clean'];

    it('contains all four required presets', () => {
      expect(Object.keys(USER_PROFILES)).toEqual(
        expect.arrayContaining(presets)
      );
    });

    it('uses strictly non-thematic professional naming across all profiles', () => {
      // Forbidden medieval/fantasy terms
      const forbiddenPatterns = [/squire/i, /knight/i, /paladin/i, /lord/i, /vassal/i, /realm/i];

      presets.forEach((preset) => {
        const profile = USER_PROFILES[preset];
        expect(profile.id).toBe(preset);
        forbiddenPatterns.forEach((pattern) => {
          expect(profile.title).not.toMatch(pattern);
          expect(profile.description).not.toMatch(pattern);
          expect(profile.badge).not.toMatch(pattern);
        });
      });

      expect(USER_PROFILES.beginner.title).toBe('Beginner Profile');
      expect(USER_PROFILES.intermediate.title).toBe('Intermediate Profile');
      expect(USER_PROFILES.advanced.title).toBe('Advanced Profile');
      expect(USER_PROFILES.clean.title).toBe('Clean Slate');
    });

    it('defines distinct card and mastery progression across tiers', () => {
      expect(USER_PROFILES.clean.cardCount).toBe(0);
      expect(USER_PROFILES.beginner.cardCount).toBe(15);
      expect(USER_PROFILES.intermediate.cardCount).toBe(60);
      expect(USER_PROFILES.advanced.cardCount).toBe(120);

      expect(USER_PROFILES.clean.masteredCount).toBe(0);
      expect(USER_PROFILES.beginner.masteredCount).toBe(0);
      expect(USER_PROFILES.intermediate.masteredCount).toBe(15);
      expect(USER_PROFILES.advanced.masteredCount).toBe(95);

      expect(USER_PROFILES.clean.streakDays).toBe(0);
      expect(USER_PROFILES.beginner.streakDays).toBe(2);
      expect(USER_PROFILES.intermediate.streakDays).toBe(12);
      expect(USER_PROFILES.advanced.streakDays).toBe(45);
    });
  });

  describe('generateMockProfileData', () => {
    it('generates clean slate data with 0 cards and 0 logs', () => {
      const data = generateMockProfileData('clean', 'es', 'en');
      expect(data.cards).toHaveLength(0);
      expect(data.logs).toHaveLength(0);
      expect(data.unlockedDeckIds).toEqual(['1']);
    });

    it('generates beginner data with 15 cards, 0 mastered, 5 learning, and 12 review logs', () => {
      const data = generateMockProfileData('beginner', 'es', 'en');
      expect(data.cards).toHaveLength(15);

      // 5 learning cards (state 1), 10 new (state 0)
      const learningCards = data.cards.filter((c) => c.state === 1);
      const newCards = data.cards.filter((c) => c.state === 0);
      expect(learningCards).toHaveLength(5);
      expect(newCards).toHaveLength(10);

      // Stability check: none mastered (mature >= 21)
      const matureCards = data.cards.filter((c) => c.stability >= 21);
      expect(matureCards).toHaveLength(0);

      // 5 cards are due now (due_date <= now)
      const now = new Date().toISOString();
      const dueCards = data.cards.filter((c) => c.due_date <= now);
      expect(dueCards).toHaveLength(5);

      // Review logs: 2-day streak (12 total logs)
      expect(data.logs).toHaveLength(12);

      // 1 unlocked deck
      expect(data.unlockedDeckIds).toEqual(['1']);
    });

    it('generates intermediate data with 60 cards, 15 mastered, 14 due, and 12-day streak', () => {
      const data = generateMockProfileData('intermediate', 'es', 'en');
      expect(data.cards).toHaveLength(60);

      // 15 mature cards (stability >= 21)
      const matureCards = data.cards.filter((c) => c.stability >= 21);
      expect(matureCards).toHaveLength(15);

      // 10 learning cards (state 1)
      const learningCards = data.cards.filter((c) => c.state === 1);
      expect(learningCards).toHaveLength(10);

      // 35 young cards (state 2, stability < 21)
      const youngCards = data.cards.filter((c) => c.state === 2 && c.stability < 21);
      expect(youngCards).toHaveLength(35);

      // Due cards: exactly 14 due
      const now = new Date().toISOString();
      const dueCards = data.cards.filter((c) => c.due_date <= now);
      expect(dueCards).toHaveLength(14);

      // 12-day streak: review logs > 100
      expect(data.logs.length).toBeGreaterThan(120);

      // 6 unlocked decks
      expect(data.unlockedDeckIds).toHaveLength(6);
    });

    it('generates advanced data with 120 cards, 95 mastered, and 45-day streak', () => {
      const data = generateMockProfileData('advanced', 'es', 'en');
      expect(data.cards).toHaveLength(120);

      // 95 mature cards (stability >= 21)
      const matureCards = data.cards.filter((c) => c.stability >= 21);
      expect(matureCards).toHaveLength(95);

      // 5 relearning/lapsed cards (state 3)
      const lapsedCards = data.cards.filter((c) => c.state === 3);
      expect(lapsedCards).toHaveLength(5);

      // 20 young cards (state 2, stability < 21)
      const youngCards = data.cards.filter((c) => c.state === 2 && c.stability < 21);
      expect(youngCards).toHaveLength(20);

      // 26 due cards
      const now = new Date().toISOString();
      const dueCards = data.cards.filter((c) => c.due_date <= now);
      expect(dueCards).toHaveLength(26);

      // Continuous 45-day streak + historical reviews: > 700 review logs
      expect(data.logs.length).toBeGreaterThan(700);

      // All 24 decks unlocked
      expect(data.unlockedDeckIds).toHaveLength(24);
    });

    it('correctly sets target and origin language names in generated card records', () => {
      const dataFr = generateMockProfileData('beginner', 'fr', 'en');
      expect(dataFr.cards[0].target_lang).toBe('French');
      expect(dataFr.cards[0].origin_lang).toBe('en');

      const dataDe = generateMockProfileData('beginner', 'de', 'es');
      expect(dataDe.cards[0].target_lang).toBe('German');
      expect(dataDe.cards[0].origin_lang).toBe('es');
    });
  });

  describe('seedMockUserProfile with better-sqlite3 database', () => {
    it('seeds the beginner profile into database tables', async () => {
      const info = await seedMockUserProfile('beginner', db, { targetLang: 'es', originLang: 'en' });
      expect(info.id).toBe('beginner');

      const cards = db.prepare('SELECT * FROM User_Cards;').all();
      expect(cards).toHaveLength(15);

      const logs = db.prepare('SELECT * FROM Review_Logs;').all();
      expect(logs).toHaveLength(12);

      const decks = db.prepare('SELECT * FROM Deck_Access WHERE is_unlocked = 1;').all();
      expect(decks).toHaveLength(1);
      expect(String(decks[0].deck_id)).toBe('1');
    });

    it('seeds the intermediate profile into database tables', async () => {
      const info = await seedMockUserProfile('intermediate', db, { targetLang: 'es', originLang: 'en' });
      expect(info.id).toBe('intermediate');

      const cards = db.prepare('SELECT * FROM User_Cards;').all();
      expect(cards).toHaveLength(60);

      const matureCards = db.prepare('SELECT * FROM User_Cards WHERE stability >= 21;').all();
      expect(matureCards).toHaveLength(15);

      const logs = db.prepare('SELECT * FROM Review_Logs;').all();
      expect(logs.length).toBeGreaterThan(120);

      const decks = db.prepare('SELECT * FROM Deck_Access WHERE is_unlocked = 1;').all();
      expect(decks).toHaveLength(6);
    });

    it('seeds the advanced profile into database tables', async () => {
      const info = await seedMockUserProfile('advanced', db, { targetLang: 'es', originLang: 'en' });
      expect(info.id).toBe('advanced');

      const cards = db.prepare('SELECT * FROM User_Cards;').all();
      expect(cards).toHaveLength(120);

      const matureCards = db.prepare('SELECT * FROM User_Cards WHERE stability >= 21;').all();
      expect(matureCards).toHaveLength(95);

      const logs = db.prepare('SELECT * FROM Review_Logs;').all();
      expect(logs.length).toBeGreaterThan(700);

      const decks = db.prepare('SELECT * FROM Deck_Access WHERE is_unlocked = 1;').all();
      expect(decks).toHaveLength(24);
    });

    it('seeds the clean slate profile and empties User_Cards and Review_Logs', async () => {
      // First populate with intermediate
      await seedMockUserProfile('intermediate', db);
      expect(db.prepare('SELECT COUNT(*) as count FROM User_Cards;').get().count).toBe(60);

      // Now seed clean
      const info = await seedMockUserProfile('clean', db);
      expect(info.id).toBe('clean');

      expect(db.prepare('SELECT COUNT(*) as count FROM User_Cards;').get().count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM Review_Logs;').get().count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM Deck_Access WHERE is_unlocked = 1;').get().count).toBe(1);
    });

    it('atomically replaces prior data when switching between profiles', async () => {
      // Seed advanced (120 cards, >700 logs, 24 decks)
      await seedMockUserProfile('advanced', db);
      expect(db.prepare('SELECT COUNT(*) as count FROM User_Cards;').get().count).toBe(120);

      // Switch to beginner (15 cards, 12 logs, 1 deck)
      await seedMockUserProfile('beginner', db);

      // Verify no leftover cards or logs leaked from advanced
      expect(db.prepare('SELECT COUNT(*) as count FROM User_Cards;').get().count).toBe(15);
      expect(db.prepare('SELECT COUNT(*) as count FROM Review_Logs;').get().count).toBe(12);
      expect(db.prepare('SELECT COUNT(*) as count FROM Deck_Access WHERE is_unlocked = 1;').get().count).toBe(1);
    });

    it('updates tokenWallet testing state when available', async () => {
      const spy = jest.spyOn(tokenWallet, 'setWalletStateForTesting').mockResolvedValue(undefined as any);

      await seedMockUserProfile('beginner', db);
      expect(spy).toHaveBeenCalledWith(USER_PROFILES.beginner.tokens);

      await seedMockUserProfile('advanced', db);
      expect(spy).toHaveBeenCalledWith(USER_PROFILES.advanced.tokens);
    });

    it('rolls back cleanly if a transaction failure occurs', async () => {
      // Populate with beginner
      await seedMockUserProfile('beginner', db);
      expect(db.prepare('SELECT COUNT(*) as count FROM User_Cards;').get().count).toBe(15);

      // Corrupt schema or simulate error by temporarily breaking the database
      const originalPrepare = db.prepare.bind(db);
      jest.spyOn(db, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO User_Cards')) {
          throw new Error('Disk I/O Error Simulation');
        }
        return originalPrepare(sql);
      });

      await expect(seedMockUserProfile('intermediate', db)).rejects.toThrow('Disk I/O Error Simulation');

      // Database should not be in half-written intermediate state
      expect(db.prepare('SELECT COUNT(*) as count FROM User_Cards;').get().count).toBe(15);
    });
  });
});
