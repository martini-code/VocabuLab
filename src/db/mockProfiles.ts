import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../locales/languages';
import { tokenWallet } from '../services/tokenWallet';

function resolveTargetLangName(codeOrName: string): string {
  if (!codeOrName) return 'Spanish';
  const match = getLanguageByCode(codeOrName);
  if (match) return match.name;
  const lower = codeOrName.toLowerCase();
  for (const l of SUPPORTED_LANGUAGES) {
    if (l.name.toLowerCase() === lower || l.name.toLowerCase().startsWith(lower)) {
      return l.name;
    }
  }
  return codeOrName.charAt(0).toUpperCase() + codeOrName.slice(1);
}

export type UserProfilePreset = 'beginner' | 'intermediate' | 'advanced' | 'clean';

export interface UserProfileInfo {
  id: UserProfilePreset;
  title: string;
  badge: string;
  description: string;
  cardCount: number;
  masteredCount: number;
  dueCount: number;
  streakDays: number;
  totalReviews: number;
  unlockedDecksCount: number;
  tokens: number;
  isAdFree: boolean;
}

export const USER_PROFILES: Record<UserProfilePreset, UserProfileInfo> = {
  beginner: {
    id: 'beginner',
    title: 'Beginner Profile',
    badge: 'Level 1',
    description:
      'Early-stage learner with 15 active words in initial learning state, 0 mastered, and a 2-day streak.',
    cardCount: 15,
    masteredCount: 0,
    dueCount: 5,
    streakDays: 2,
    totalReviews: 12,
    unlockedDecksCount: 1,
    tokens: 2,
    isAdFree: false,
  },
  intermediate: {
    id: 'intermediate',
    title: 'Intermediate Profile',
    badge: 'Level 2',
    description:
      'Consistent learner with 60 words across 6 decks, 15 mastered cards, balanced FSRS stability, and a 12-day streak.',
    cardCount: 60,
    masteredCount: 15,
    dueCount: 14,
    streakDays: 12,
    totalReviews: 165,
    unlockedDecksCount: 6,
    tokens: 1,
    isAdFree: false,
  },
  advanced: {
    id: 'advanced',
    title: 'Advanced Profile',
    badge: 'Level 3',
    description:
      'Power user with 120 words across all 24 decks, 95 mastered cards, high FSRS maturity, and a 45-day streak.',
    cardCount: 120,
    masteredCount: 95,
    dueCount: 26,
    streakDays: 45,
    totalReviews: 780,
    unlockedDecksCount: 24,
    tokens: 1,
    isAdFree: true,
  },
  clean: {
    id: 'clean',
    title: 'Clean Slate',
    badge: 'Reset',
    description:
      'Resets the database to a blank initial state with 0 active cards, 0 review logs, and default settings.',
    cardCount: 0,
    masteredCount: 0,
    dueCount: 0,
    streakDays: 0,
    totalReviews: 0,
    unlockedDecksCount: 1,
    tokens: 2,
    isAdFree: false,
  },
};

interface GeneratedCardData {
  id: string;
  card_id: number;
  target_lang: string;
  origin_lang: string;
  due_date: string;
  state: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  updated_at: string;
}

interface GeneratedLogData {
  card_id: number;
  rating: number;
  reviewed_at: string;
}

/**
 * Deterministically generates cards, reviews, and deck access records for a profile preset.
 */
export function generateMockProfileData(
  preset: UserProfilePreset,
  targetLang = 'es',
  originLang = 'en'
): {
  cards: GeneratedCardData[];
  logs: GeneratedLogData[];
  unlockedDeckIds: string[];
} {
  const langName = resolveTargetLangName(targetLang);
  const now = new Date();
  const nowIso = now.toISOString();

  if (preset === 'clean') {
    return {
      cards: [],
      logs: [],
      unlockedDeckIds: ['1'],
    };
  }

  const cards: GeneratedCardData[] = [];
  const logs: GeneratedLogData[] = [];

  // Helper for generating dates offset by days/hours
  const getDateOffset = (daysAgo: number, hoursOffset = 0): Date => {
    return new Date(now.getTime() - daysAgo * 86400000 + hoursOffset * 3600000);
  };

  if (preset === 'beginner') {
    // 15 cards: 10 New (state 0), 5 Learning (state 1, stability 1.0 - 2.0)
    for (let i = 1; i <= 15; i++) {
      const isLearning = i <= 5;
      const isDue = i <= 5;
      const dueDate = isDue
        ? getDateOffset(0, -2).toISOString() // due 2 hours ago
        : getDateOffset(-2, 0).toISOString(); // due in 2 days

      cards.push({
        id: `card_${i}_${langName}`,
        card_id: i,
        target_lang: langName,
        origin_lang: originLang,
        due_date: dueDate,
        state: isLearning ? 1 : 0,
        stability: isLearning ? 1.2 : 0.0,
        difficulty: isLearning ? 5.5 : 0.0,
        elapsed_days: isLearning ? 1 : 0,
        scheduled_days: isLearning ? 1 : 0,
        reps: isLearning ? 1 : 0,
        lapses: 0,
        updated_at: nowIso,
      });
    }

    // 2-day streak (Today and Yesterday)
    // Day 0 (today): 6 reviews
    for (let r = 0; r < 6; r++) {
      logs.push({
        card_id: (r % 5) + 1,
        rating: 3,
        reviewed_at: getDateOffset(0, -4 + r).toISOString(),
      });
    }
    // Day 1 (yesterday): 6 reviews
    for (let r = 0; r < 6; r++) {
      logs.push({
        card_id: (r % 5) + 1,
        rating: r === 2 ? 1 : 3,
        reviewed_at: getDateOffset(1, -6 + r).toISOString(),
      });
    }

    return {
      cards,
      logs,
      unlockedDeckIds: ['1'],
    };
  }

  if (preset === 'intermediate') {
    // 60 cards:
    // - 10 Learning (state 1, stability 2.0, diff 5.2, reps 1-2)
    // - 35 Young (state 2, stability 7.0 - 18.0, diff 4.0 - 5.0, reps 3-5)
    // - 15 Mature (state 2, stability 22.0 - 35.0, diff 3.0 - 4.0, reps 4-7)
    for (let i = 1; i <= 60; i++) {
      let state = 2;
      let stability = 10.0;
      let difficulty = 4.5;
      let reps = 3;
      let lapses = 0;
      let isDue = false;

      if (i <= 10) {
        // Learning
        state = 1;
        stability = 2.0;
        difficulty = 5.2;
        reps = 1;
        isDue = i <= 5;
      } else if (i <= 45) {
        // Young
        state = 2;
        stability = 7.0 + ((i * 3) % 11); // 7.0 - 17.0
        difficulty = 4.0 + (i % 5) * 0.2;
        reps = 3 + (i % 3);
        lapses = i % 7 === 0 ? 1 : 0;
        isDue = i <= 15; // some are due
      } else {
        // Mature (>= 21d stability)
        state = 2;
        stability = 22.0 + ((i * 2) % 15); // 22.0 - 36.0
        difficulty = 3.2 + (i % 4) * 0.2;
        reps = 5 + (i % 3);
        lapses = 0;
        isDue = i <= 49;
      }

      const dueDate = isDue
        ? getDateOffset(0, -((i % 12) + 1)).toISOString()
        : getDateOffset(-(Math.floor(stability / 2) + 1), 0).toISOString();

      cards.push({
        id: `card_${i}_${langName}`,
        card_id: i,
        target_lang: langName,
        origin_lang: originLang,
        due_date: dueDate,
        state,
        stability,
        difficulty,
        elapsed_days: Math.floor(stability / 2),
        scheduled_days: Math.floor(stability),
        reps,
        lapses,
        updated_at: nowIso,
      });
    }

    // 12-day continuous streak (Days 0 to 11), ~165 reviews total
    for (let day = 0; day < 12; day++) {
      const reviewCount = 10 + ((day * 7) % 8); // 10 - 17 reviews per day
      for (let r = 0; r < reviewCount; r++) {
        const cardId = ((day * 5 + r) % 60) + 1;
        const rating = r % 6 === 0 ? 2 : r % 9 === 0 ? 1 : 3;
        logs.push({
          card_id: cardId,
          rating,
          reviewed_at: getDateOffset(day, -(r % 10)).toISOString(),
        });
      }
    }

    return {
      cards,
      logs,
      unlockedDeckIds: ['1', '2', '4', '7', '14', '16'],
    };
  }

  // advanced profile (120 cards, 95 mature, 45-day streak)
  for (let i = 1; i <= 120; i++) {
    let state = 2;
    let stability = 35.0;
    let difficulty = 3.0;
    let reps = 7;
    let lapses = 0;
    let isDue = false;

    if (i <= 5) {
      // Relearning / Lapsed
      state = 3;
      stability = 3.5;
      difficulty = 6.0;
      reps = 5;
      lapses = 2;
      isDue = true;
    } else if (i <= 25) {
      // Young
      state = 2;
      stability = 12.0 + (i % 8);
      difficulty = 4.2;
      reps = 4;
      lapses = i % 5 === 0 ? 1 : 0;
      isDue = i <= 15;
    } else {
      // Mature (95 cards, stability 25.0 - 140.0)
      state = 2;
      stability = 25.0 + ((i * 3) % 115);
      difficulty = 2.4 + (i % 5) * 0.3;
      reps = 6 + (i % 8);
      lapses = i % 13 === 0 ? 1 : 0;
      isDue = i <= 36;
    }

    const dueDate = isDue
      ? getDateOffset(0, -((i % 18) + 1)).toISOString()
      : getDateOffset(-(Math.floor(stability / 3) + 2), 0).toISOString();

    cards.push({
      id: `card_${i}_${langName}`,
      card_id: i,
      target_lang: langName,
      origin_lang: originLang,
      due_date: dueDate,
      state,
      stability,
      difficulty,
      elapsed_days: Math.floor(stability / 2),
      scheduled_days: Math.floor(stability),
      reps,
      lapses,
      updated_at: nowIso,
    });
  }

  // 45-day continuous streak + sporadic earlier reviews across 18-week heatmap
  for (let day = 0; day < 45; day++) {
    const reviewsThisDay = 12 + ((day * 13) % 12); // 12 - 23 reviews/day
    for (let r = 0; r < reviewsThisDay; r++) {
      const cardId = ((day * 7 + r) % 120) + 1;
      const rating = r % 8 === 0 ? 4 : r % 11 === 0 ? 2 : 3;
      logs.push({
        card_id: cardId,
        rating,
        reviewed_at: getDateOffset(day, -(r % 12)).toISOString(),
      });
    }
  }

  // Additional background historical days for rich 18-week heatmap
  const historicalWeeks = [52, 55, 60, 65, 72, 80, 90, 100, 110, 120];
  for (const day of historicalWeeks) {
    for (let r = 0; r < 8; r++) {
      logs.push({
        card_id: (r % 30) + 1,
        rating: 3,
        reviewed_at: getDateOffset(day, -r).toISOString(),
      });
    }
  }

  const allDecks = Array.from({ length: 24 }, (_, i) => String(i + 1));

  return {
    cards,
    logs,
    unlockedDeckIds: allDecks,
  };
}

/**
 * Applies a profile preset into the SQLite database.
 * Supports both Expo SQLite (production app) and better-sqlite3 (Node / unit tests).
 */
export async function seedMockUserProfile(
  preset: UserProfilePreset,
  dbInstance?: any,
  options?: { targetLang?: string; originLang?: string }
): Promise<UserProfileInfo> {
  const targetLang = options?.targetLang || 'es';
  const originLang = options?.originLang || 'en';

  let db = dbInstance;
  if (!db) {
    const { getUserDb } = await import('./vault');
    db = await getUserDb();
  }
  const profileInfo = USER_PROFILES[preset];
  const { cards, logs, unlockedDeckIds } = generateMockProfileData(preset, targetLang, originLang);

  const nowIso = new Date().toISOString();

  // Execute database wipe & population
  if (typeof db.withTransactionAsync === 'function') {
    // ── Expo SQLite execution path ──
    await db.withTransactionAsync(async () => {
      // 1. Wipe current user study data
      await db.runAsync('DELETE FROM User_Cards;');
      await db.runAsync('DELETE FROM Review_Logs;');
      await db.runAsync('DELETE FROM Deck_Access;');

      // 2. Insert User Cards
      for (const c of cards) {
        await db.runAsync(
          `INSERT INTO User_Cards (
            id, card_id, target_lang, origin_lang, due_date, state,
            stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            c.id,
            c.card_id,
            c.target_lang,
            c.origin_lang,
            c.due_date,
            c.state,
            c.stability,
            c.difficulty,
            c.elapsed_days,
            c.scheduled_days,
            c.reps,
            c.lapses,
            c.updated_at,
          ]
        );
      }

      // 3. Insert Review Logs
      for (const l of logs) {
        await db.runAsync(
          'INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);',
          [l.card_id, l.rating, l.reviewed_at]
        );
      }

      // 4. Insert Deck Entitlements
      for (const deckId of unlockedDeckIds) {
        await db.runAsync(
          'INSERT OR REPLACE INTO Deck_Access (deck_id, is_unlocked, unlocked_at) VALUES (?, 1, ?);',
          [deckId, nowIso]
        );
      }
    });
  } else if (typeof db.exec === 'function' && typeof db.prepare === 'function') {
    // ── better-sqlite3 execution path ──
    db.exec('BEGIN TRANSACTION;');
    try {
      db.exec('DELETE FROM User_Cards;');
      db.exec('DELETE FROM Review_Logs;');
      db.exec('DELETE FROM Deck_Access;');

      const insertCard = db.prepare(`
        INSERT INTO User_Cards (
          id, card_id, target_lang, origin_lang, due_date, state,
          stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `);

      for (const c of cards) {
        insertCard.run(
          c.id,
          c.card_id,
          c.target_lang,
          c.origin_lang,
          c.due_date,
          c.state,
          c.stability,
          c.difficulty,
          c.elapsed_days,
          c.scheduled_days,
          c.reps,
          c.lapses,
          c.updated_at
        );
      }

      const insertLog = db.prepare(
        'INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);'
      );
      for (const l of logs) {
        insertLog.run(l.card_id, l.rating, l.reviewed_at);
      }

      const insertDeck = db.prepare(
        'INSERT OR REPLACE INTO Deck_Access (deck_id, is_unlocked, unlocked_at) VALUES (?, 1, ?);'
      );
      for (const deckId of unlockedDeckIds) {
        insertDeck.run(deckId, nowIso);
      }

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  // Update tokenWallet state if available
  try {
    if (tokenWallet && typeof tokenWallet.setWalletStateForTesting === 'function') {
      await tokenWallet.setWalletStateForTesting(profileInfo.tokens);
    }
  } catch {
    // Non-critical in headless test environments
  }

  return profileInfo;
}
