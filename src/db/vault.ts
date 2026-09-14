import * as SQLite from 'expo-sqlite';
import { importDatabaseFromAssetAsync } from 'expo-sqlite';
import { USER_SCHEMA_SQL } from './schema';
import {
  Domain,
  CardWithDetails,
  Lexeme,
  VaultStats,
  ProgressOverview,
  ActivityWeek,
  ActivityDay,
  DeckWithProgress,
  ThemeGroup,
  DeckCardDetail,
  DifficultyWordItem,
  DifficultyStat,
  MasteryWordItem,
  MasterySummary,
  MasteryStage,
  CEFRLevel,
} from '../types';

let staticDbInstance: SQLite.SQLiteDatabase | null = null;
let userDbInstance: SQLite.SQLiteDatabase | null = null;

const STATIC_DB_NAME = 'lexicon_v1.0.0.db';
const USER_DB_NAME = 'user_vault.sqlite';

/**
 * Maps ISO language codes and common aliases to the exact lang_name strings
 * used in the static lexicon database (card_translations table).
 */
const ISO_TO_LANG: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese (Brazil)',
  'pt-br': 'Portuguese (Brazil)',
  'pt-pt': 'Portuguese (Portugal)',
  ja: 'Japanese',
  ru: 'Russian',
  zh: 'Chinese (Simplified)',
  'zh-cn': 'Chinese (Simplified)',
  'zh-tw': 'Chinese (Traditional)',
  en: 'English',
  ar: 'Arabic',
  hi: 'Hindi',
  ko: 'Korean',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
};

export function resolveLanguageName(codeOrName: string): string {
  if (!codeOrName) return 'Spanish';
  const trimmed = codeOrName.trim();
  const lower = trimmed.toLowerCase();
  if (ISO_TO_LANG[lower]) return ISO_TO_LANG[lower];
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function difficultyToCefr(difficulty: number): CEFRLevel {
  switch (difficulty) {
    case 1:
      return 'A1';
    case 2:
      return 'A2';
    case 3:
      return 'B1';
    case 4:
      return 'B2';
    case 5:
      return 'C1';
    case 6:
      return 'C2';
    default:
      return 'A1';
  }
}

export function cefrToDifficulty(cefr: string): number {
  switch (cefr.toUpperCase()) {
    case 'A1':
      return 1;
    case 'A2':
      return 2;
    case 'B1':
      return 3;
    case 'B2':
      return 4;
    case 'C1':
      return 5;
    case 'C2':
      return 6;
    default:
      return 1;
  }
}

/**
 * Returns the read-only static lexicon database.
 * Enforces PRAGMA query_only = ON to ensure the static database is NEVER modified.
 */
export async function getStaticDb(): Promise<SQLite.SQLiteDatabase> {
  if (!staticDbInstance) {
    try {
      await importDatabaseFromAssetAsync(STATIC_DB_NAME, {
        assetId: require('../../assets/lexicon_v1.0.0.db'),
        forceOverwrite: false,
      });
    } catch (err) {
      console.warn('[Vault] Notice during static asset DB import:', err);
    }
    staticDbInstance = await SQLite.openDatabaseAsync(STATIC_DB_NAME);
    // Enforce read-only constraint strictly
    await staticDbInstance.execAsync('PRAGMA query_only = ON;');
  }
  return staticDbInstance;
}

/**
 * Returns the writable user vault database for FSRS cards, review logs, and user settings.
 */
export async function getUserDb(): Promise<SQLite.SQLiteDatabase> {
  if (!userDbInstance) {
    userDbInstance = await SQLite.openDatabaseAsync(USER_DB_NAME);
    await userDbInstance.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
  }
  return userDbInstance;
}

/**
 * Backwards compatibility alias: returns the user database.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return getUserDb();
}

/**
 * Initializes the user database schema and seeds initial review logs if empty.
 */
export async function initVault(): Promise<void> {
  const userDb = await getUserDb();
  await userDb.execAsync(USER_SCHEMA_SQL);

  // Initialize static DB connection
  await getStaticDb();

  // Check if Review_Logs has initial activity logs
  const logCheck = await userDb.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM Review_Logs;'
  );
  if (!logCheck || logCheck.count === 0) {
    console.log('[Vault] Inscribing initial activity chronicles...');
    await seedSampleReviewLogs(userDb);
  }
}

const CATEGORY_META: Record<
  string,
  { name: string; description: string; icon_name: string; is_pro: boolean }
> = {
  greetings: {
    name: 'Greetings & Courtesies',
    description: 'Essential salutations, formal pleasantries, and polite farewells',
    icon_name: 'handshake',
    is_pro: false,
  },
  family: {
    name: 'Kinship & Family Realm',
    description: 'Household relatives, ancestors, lineage, and bonds of kin',
    icon_name: 'castle',
    is_pro: false,
  },
  numbers: {
    name: 'Numbers & Cardinal Counting',
    description: 'Foundational numeric figures, quantities, and cardinal tallies',
    icon_name: 'coins',
    is_pro: false,
  },
  animals: {
    name: 'Fauna & Menagerie',
    description: 'Domestic companions, farm livestock, and insects of the kingdom',
    icon_name: 'paw',
    is_pro: false,
  },
  vehicles: {
    name: 'Vehicles & Wayfaring',
    description: 'Land transports, maritime vessels, and airborne flight crafts',
    icon_name: 'compass',
    is_pro: false,
  },
  math: {
    name: 'Mathematics & Logic',
    description: 'Elementary arithmetic calculations, operations, and axioms',
    icon_name: 'scale',
    is_pro: false,
  },
  electronics: {
    name: 'Appliances & Technology',
    description: 'Household appliances, circuitry, and engineering instruments',
    icon_name: 'sparkles',
    is_pro: true,
  },
  biology: {
    name: 'Natural Sciences & Cellular Lore',
    description: 'Cell cycle genetics, microscopic life, and biological taxonomy',
    icon_name: 'book',
    is_pro: true,
  },
};

function formatSubcategoryName(sub: string): string {
  if (!sub) return 'General';
  return sub
    .split(' ')
    .map((word) => {
      if (word.startsWith('(')) {
        return '(' + word.charAt(1).toUpperCase() + word.slice(2);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Tab 1: Themes & Thematic Decks.
 * Returns the real thematic decks from lexicon_v1.0.0.db grouped by category.
 */
export async function getThemesWithProgressiveDecks(
  targetLang = 'es'
): Promise<ThemeGroup[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);

  // 1. Fetch all decks
  const decksRows = await staticDb.getAllAsync<{
    deck_id: number;
    category: string;
    subcategory: string;
    difficulty: number;
    description: string;
  }>('SELECT deck_id, category, subcategory, difficulty, description FROM decks ORDER BY deck_id ASC;');

  // 2. Fetch card counts per deck
  const countRows = await staticDb.getAllAsync<{
    deck_id: number;
    card_count: number;
  }>('SELECT deck_id, count(card_id) as card_count FROM cards GROUP BY deck_id;');
  const cardCountMap = new Map<number, number>();
  countRows.forEach((r) => cardCountMap.set(r.deck_id, r.card_count));

  // 3. Fetch user garrison & mastery progress from user_vault.sqlite
  const userProgressRows = await userDb.getAllAsync<{
    card_id: number;
    state: number;
    stability: number;
    reps: number;
  }>('SELECT card_id, state, stability, reps FROM User_Cards WHERE target_lang = ?;', [langName]);

  const userProgressMap = new Map<
    number,
    { state: number; stability: number; reps: number }
  >();
  userProgressRows.forEach((r) => {
    userProgressMap.set(r.card_id, {
      state: r.state,
      stability: r.stability,
      reps: r.reps,
    });
  });

  // Map each card_id to its deck_id
  const cardDeckRows = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
  }>('SELECT card_id, deck_id FROM cards;');
  const cardToDeckMap = new Map<number, number>();
  cardDeckRows.forEach((r) => cardToDeckMap.set(r.card_id, r.deck_id));

  // Tally user progress per deck
  const deckGarrisonCount = new Map<number, number>();
  const deckMasteredCount = new Map<number, number>();

  for (const [cardId, uCard] of userProgressMap.entries()) {
    const deckId = cardToDeckMap.get(cardId);
    if (deckId !== undefined) {
      deckGarrisonCount.set(deckId, (deckGarrisonCount.get(deckId) || 0) + 1);
      if (uCard.stability >= 21 || uCard.reps >= 3) {
        deckMasteredCount.set(deckId, (deckMasteredCount.get(deckId) || 0) + 1);
      }
    }
  }

  // Fetch unlock states
  const unlockedRows = await userDb.getAllAsync<{ deck_id: string }>(
    'SELECT deck_id FROM Deck_Access WHERE is_unlocked = 1;'
  );
  const unlockedSet = new Set(unlockedRows.map((r) => r.deck_id));

  // Group decks by category
  const categoriesMap = new Map<string, DeckWithProgress[]>();

  for (const d of decksRows) {
    const totalCards = cardCountMap.get(d.deck_id) || 0;
    const garrisoned = deckGarrisonCount.get(d.deck_id) || 0;
    const mastered = deckMasteredCount.get(d.deck_id) || 0;
    const cefr = difficultyToCefr(d.difficulty);
    const catMeta = CATEGORY_META[d.category] || {
      name: d.category,
      description: '',
      icon_name: 'book',
      is_pro: false,
    };

    const isUnlocked =
      d.deck_id === 1 || // First deck always unlocked
      d.deck_id === 2 ||
      unlockedSet.has(String(d.deck_id)) ||
      unlockedSet.has(d.category);

    const deckObj: DeckWithProgress = {
      id: String(d.deck_id),
      real_deck_id: d.deck_id,
      theme_id: d.category,
      theme_name: catMeta.name,
      name: formatSubcategoryName(d.subcategory),
      description: d.description || `${formatSubcategoryName(d.subcategory)} vocabulary (${cefr})`,
      difficulty_level: d.difficulty,
      difficulty_label: cefr,
      cefr_level: cefr,
      icon_name: catMeta.icon_name,
      card_count: totalCards,
      garrisoned_count: garrisoned,
      mastered_count: mastered,
      is_pro: catMeta.is_pro,
      is_locked: !isUnlocked,
    };

    if (!categoriesMap.has(d.category)) {
      categoriesMap.set(d.category, []);
    }
    categoriesMap.get(d.category)!.push(deckObj);
  }

  // Build ThemeGroups array in consistent category ordering
  const categoryOrder = [
    'greetings',
    'family',
    'numbers',
    'animals',
    'vehicles',
    'math',
    'electronics',
    'biology',
  ];

  const themeGroups: ThemeGroup[] = [];
  for (const catKey of categoryOrder) {
    const decks = categoriesMap.get(catKey);
    if (!decks || decks.length === 0) continue;

    const meta = CATEGORY_META[catKey] || {
      name: catKey,
      description: '',
      icon_name: 'book',
      is_pro: false,
    };

    themeGroups.push({
      id: `theme_${catKey}`,
      name: meta.name,
      description: meta.description,
      icon_name: meta.icon_name,
      is_pro: meta.is_pro,
      decks,
    });
  }

  // Include any extra categories not in categoryOrder
  for (const [catKey, decks] of categoriesMap.entries()) {
    if (!categoryOrder.includes(catKey)) {
      themeGroups.push({
        id: `theme_${catKey}`,
        name: formatSubcategoryName(catKey),
        description: '',
        icon_name: 'book',
        is_pro: false,
        decks,
      });
    }
  }

  return themeGroups;
}

/**
 * Tab 2: Difficulty Progression Map.
 * Organizes the static data into smaller UI-only decks sliced by (deck_id, difficulty).
 * For instance: "Domestic Animals (A1)", "Family Members (A1)", "Domestic Animals (B1)", etc.
 * Shows only the cards of that difficulty tier.
 */
export async function getAllDecksOrderedByDifficulty(
  targetLang = 'es'
): Promise<DeckWithProgress[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);

  // Group cards by (deck_id, difficulty)
  const sliceRows = await staticDb.getAllAsync<{
    deck_id: number;
    category: string;
    subcategory: string;
    difficulty: number;
    card_count: number;
  }>(`
    SELECT 
      d.deck_id,
      d.category,
      d.subcategory,
      c.difficulty,
      COUNT(c.card_id) as card_count
    FROM decks d
    JOIN cards c ON c.deck_id = d.deck_id
    GROUP BY d.deck_id, c.difficulty
    ORDER BY c.difficulty ASC, d.deck_id ASC;
  `);

  // Fetch all user cards for this language
  const userCards = await userDb.getAllAsync<{
    card_id: number;
    stability: number;
    reps: number;
  }>('SELECT card_id, stability, reps FROM User_Cards WHERE target_lang = ?;', [langName]);

  const userCardMap = new Map<number, { stability: number; reps: number }>();
  userCards.forEach((uc) => userCardMap.set(uc.card_id, { stability: uc.stability, reps: uc.reps }));

  // Map each card to its (deck_id, difficulty)
  const cardSliceRows = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    difficulty: number;
  }>('SELECT card_id, deck_id, difficulty FROM cards;');

  const cardToSliceMap = new Map<number, string>();
  cardSliceRows.forEach((r) => {
    cardToSliceMap.set(r.card_id, `${r.deck_id}_${r.difficulty}`);
  });

  // Tally user progress per slice
  const sliceGarrisonCount = new Map<string, number>();
  const sliceMasteredCount = new Map<string, number>();

  for (const [cardId, uc] of userCardMap.entries()) {
    const key = cardToSliceMap.get(cardId);
    if (key) {
      sliceGarrisonCount.set(key, (sliceGarrisonCount.get(key) || 0) + 1);
      if (uc.stability >= 21 || uc.reps >= 3) {
        sliceMasteredCount.set(key, (sliceMasteredCount.get(key) || 0) + 1);
      }
    }
  }

  // Build UI-only sliced decks
  const result: DeckWithProgress[] = [];

  for (const s of sliceRows) {
    const sliceKey = `${s.deck_id}_${s.difficulty}`;
    const cefr = difficultyToCefr(s.difficulty);
    const catMeta = CATEGORY_META[s.category] || { icon_name: 'book' };
    const garrisoned = sliceGarrisonCount.get(sliceKey) || 0;
    const mastered = sliceMasteredCount.get(sliceKey) || 0;

    const subName = formatSubcategoryName(s.subcategory);
    const name = `${subName} (${cefr})`;
    const description = `${cefr} vocabulary subset • ${s.card_count} words`;

    result.push({
      id: `diff_${s.deck_id}_${s.difficulty}`,
      real_deck_id: s.deck_id,
      difficulty_slice: s.difficulty,
      theme_id: s.category,
      theme_name: formatSubcategoryName(s.category),
      name,
      description,
      difficulty_level: s.difficulty,
      difficulty_label: cefr,
      cefr_level: cefr,
      icon_name: catMeta.icon_name,
      card_count: s.card_count,
      garrisoned_count: garrisoned,
      mastered_count: mastered,
      is_pro: false,
      is_locked: false,
    });
  }

  return result;
}

/**
 * Parses deckId or sliceId (e.g. "diff_2_1" -> { realDeckId: 2, difficultySlice: 1 })
 */
function parseDeckIdentifier(
  deckIdOrSliceId: string,
  explicitDifficultySlice?: number
): { realDeckId: number; difficultySlice?: number } {
  if (deckIdOrSliceId.startsWith('diff_')) {
    const parts = deckIdOrSliceId.split('_');
    const dId = parseInt(parts[1], 10);
    const diff = parseInt(parts[2], 10);
    return {
      realDeckId: dId,
      difficultySlice: explicitDifficultySlice !== undefined ? explicitDifficultySlice : diff,
    };
  }
  return {
    realDeckId: parseInt(deckIdOrSliceId, 10),
    difficultySlice: explicitDifficultySlice,
  };
}

/**
 * Returns cards for a deck. If difficultySlice is present, filters strictly to that difficulty tier.
 */
export async function getCardsByDeck(
  deckIdOrSliceId: string,
  targetLang = 'es',
  difficultySlice?: number
): Promise<DeckCardDetail[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);

  const { realDeckId, difficultySlice: slice } = parseDeckIdentifier(
    deckIdOrSliceId,
    difficultySlice
  );

  let query = `
    SELECT 
      c.card_id,
      c.deck_id,
      c.primary_term,
      c.pos,
      COALESCE(cd.definition, c.definition) as definition,
      c.cili_id,
      c.difficulty,
      COALESCE(ct.translation, c.primary_term) as target_translation
    FROM cards c
    LEFT JOIN card_translations ct ON ct.card_id = c.card_id AND ct.lang_name = ?
    LEFT JOIN card_definitions cd ON cd.card_id = c.card_id AND cd.lang_name = ?
    WHERE c.deck_id = ?
  `;
  const params: any[] = [langName, langName, realDeckId];

  if (slice !== undefined) {
    query += ' AND c.difficulty = ?';
    params.push(slice);
  }

  query += ' ORDER BY c.card_id ASC;';

  const cardRows = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    primary_term: string;
    pos: string;
    definition: string;
    cili_id: string;
    difficulty: number;
    target_translation: string;
  }>(query, params);

  if (cardRows.length === 0) return [];

  // Fetch user card records for these card IDs
  const cardIds = cardRows.map((c) => c.card_id);
  const placeholders = cardIds.map(() => '?').join(',');
  const userCards = await userDb.getAllAsync<{
    id: string;
    card_id: number;
    stability: number;
    reps: number;
  }>(
    `SELECT id, card_id, stability, reps FROM User_Cards WHERE target_lang = ? AND card_id IN (${placeholders});`,
    [langName, ...cardIds]
  );

  const userMap = new Map<
    number,
    { id: string; stability: number; reps: number }
  >();
  userCards.forEach((uc) =>
    userMap.set(uc.card_id, {
      id: uc.id,
      stability: uc.stability,
      reps: uc.reps,
    })
  );

  return cardRows.map((c) => {
    const uc = userMap.get(c.card_id);
    return {
      concept_id: c.cili_id || `c_${c.card_id}`,
      concept_desc: c.definition || '',
      front_lexeme_id: c.card_id,
      front_term: c.target_translation,
      front_lang: targetLang,
      front_pos: c.pos || null,
      front_cefr: difficultyToCefr(c.difficulty),
      back_lexeme_id: c.card_id,
      back_term: c.primary_term,
      back_lang: 'en',
      is_garrisoned: !!uc,
      user_card_id: uc ? uc.id : undefined,
      stability: uc ? uc.stability : undefined,
      reps: uc ? uc.reps : undefined,
    };
  });
}

/**
 * Garrisons all unqueued cards in a deck (or difficulty slice) into User_Cards in user_vault.sqlite.
 */
export async function garrisonEntireDeck(
  deckIdOrSliceId: string,
  targetLang = 'es',
  difficultySlice?: number
): Promise<number> {
  const cards = await getCardsByDeck(deckIdOrSliceId, targetLang, difficultySlice);
  const unqueued = cards.filter((c) => !c.is_garrisoned);
  if (unqueued.length === 0) return 0;

  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const now = new Date().toISOString();

  for (const c of unqueued) {
    const cardIdStr = `card_${c.front_lexeme_id}_${langName}`;
    await userDb.runAsync(
      `INSERT OR REPLACE INTO User_Cards (
        id, card_id, target_lang, due_date, state, stability, difficulty,
        elapsed_days, scheduled_days, reps, lapses, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [cardIdStr, c.front_lexeme_id, langName, now, 0, 0, 0, 0, 0, 0, 0, now]
    );
  }

  return unqueued.length;
}

/**
 * Adds a single card to User_Cards queue.
 */
export async function addWordToQueue(
  frontLexemeId: number,
  _backLexemeId: number,
  _conceptId: string,
  targetLang = 'es'
): Promise<string> {
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const now = new Date().toISOString();
  const cardIdStr = `card_${frontLexemeId}_${langName}`;

  await userDb.runAsync(
    `INSERT OR REPLACE INTO User_Cards (
      id, card_id, target_lang, due_date, state, stability, difficulty,
      elapsed_days, scheduled_days, reps, lapses, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [cardIdStr, frontLexemeId, langName, now, 0, 0, 0, 0, 0, 0, 0, now]
  );

  return cardIdStr;
}

export async function addLexemeToQueue(
  frontLexemeId: number,
  targetLang = 'es'
): Promise<string | null> {
  return addWordToQueue(frontLexemeId, frontLexemeId, `c_${frontLexemeId}`, targetLang);
}

export async function removeWordFromQueue(cardId: string): Promise<void> {
  const userDb = await getUserDb();
  await userDb.runAsync('DELETE FROM User_Cards WHERE id = ?;', [cardId]);
}

/**
 * Returns cards currently due for spaced repetition review.
 */
export async function getDueCards(
  filterDeckId?: string,
  targetLang = 'es'
): Promise<CardWithDetails[]> {
  const userDb = await getUserDb();
  const staticDb = await getStaticDb();
  const langName = resolveLanguageName(targetLang);
  const now = new Date().toISOString();

  // 1. Get due user cards
  const userCards = await userDb.getAllAsync<{
    id: string;
    card_id: number;
    target_lang: string;
    due_date: string;
    state: number;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    updated_at: string;
  }>(
    'SELECT * FROM User_Cards WHERE target_lang = ? AND due_date <= ? ORDER BY due_date ASC;',
    [langName, now]
  );

  if (userCards.length === 0) return [];

  // 2. Fetch static card info
  const cardIds = userCards.map((uc) => uc.card_id);
  const placeholders = cardIds.map(() => '?').join(',');

  let filterSlice: number | undefined;
  let filterRealDeckId: number | undefined;
  if (filterDeckId) {
    const parsed = parseDeckIdentifier(filterDeckId);
    filterRealDeckId = parsed.realDeckId;
    filterSlice = parsed.difficultySlice;
  }

  const staticRows = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    primary_term: string;
    pos: string;
    definition: string;
    cili_id: string;
    difficulty: number;
    target_translation: string;
  }>(
    `SELECT 
      c.card_id,
      c.deck_id,
      c.primary_term,
      c.pos,
      COALESCE(cd.definition, c.definition) as definition,
      c.cili_id,
      c.difficulty,
      COALESCE(ct.translation, c.primary_term) as target_translation
    FROM cards c
    LEFT JOIN card_translations ct ON ct.card_id = c.card_id AND ct.lang_name = ?
    LEFT JOIN card_definitions cd ON cd.card_id = c.card_id AND cd.lang_name = ?
    WHERE c.card_id IN (${placeholders});`,
    [langName, langName, ...cardIds]
  );

  const staticMap = new Map<number, (typeof staticRows)[0]>();
  staticRows.forEach((r) => staticMap.set(r.card_id, r));

  const result: CardWithDetails[] = [];

  for (const uc of userCards) {
    const sCard = staticMap.get(uc.card_id);
    if (!sCard) continue;

    if (filterRealDeckId !== undefined && sCard.deck_id !== filterRealDeckId) {
      continue;
    }
    if (filterSlice !== undefined && sCard.difficulty !== filterSlice) {
      continue;
    }

    const cefr = difficultyToCefr(sCard.difficulty);

    result.push({
      id: uc.id,
      front_lexeme_id: uc.card_id,
      back_lexeme_id: uc.card_id,
      due_date: uc.due_date,
      state: uc.state,
      stability: uc.stability,
      difficulty: uc.difficulty,
      elapsed_days: uc.elapsed_days,
      scheduled_days: uc.scheduled_days,
      reps: uc.reps,
      lapses: uc.lapses,
      updated_at: uc.updated_at,
      front_term: sCard.target_translation,
      front_lang: targetLang,
      front_pos: sCard.pos || null,
      front_cefr: cefr,
      back_term: sCard.primary_term,
      back_lang: 'en',
      back_pos: sCard.pos || null,
      back_cefr: cefr,
      concept_desc: sCard.definition || '',
    });
  }

  return result;
}

/**
 * Returns cards for review in a specific deck (even if not strictly due, for practice mode).
 */
export async function getDeckCardsForReview(
  deckIdOrSliceId: string,
  targetLang = 'es'
): Promise<CardWithDetails[]> {
  const userDb = await getUserDb();
  const staticDb = await getStaticDb();
  const langName = resolveLanguageName(targetLang);

  const { realDeckId, difficultySlice: slice } = parseDeckIdentifier(deckIdOrSliceId);

  let query = `
    SELECT 
      c.card_id,
      c.deck_id,
      c.primary_term,
      c.pos,
      COALESCE(cd.definition, c.definition) as definition,
      c.cili_id,
      c.difficulty,
      COALESCE(ct.translation, c.primary_term) as target_translation
    FROM cards c
    LEFT JOIN card_translations ct ON ct.card_id = c.card_id AND ct.lang_name = ?
    LEFT JOIN card_definitions cd ON cd.card_id = c.card_id AND cd.lang_name = ?
    WHERE c.deck_id = ?
  `;
  const params: any[] = [langName, langName, realDeckId];

  if (slice !== undefined) {
    query += ' AND c.difficulty = ?';
    params.push(slice);
  }

  const staticRows = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    primary_term: string;
    pos: string;
    definition: string;
    cili_id: string;
    difficulty: number;
    target_translation: string;
  }>(query, params);

  if (staticRows.length === 0) return [];

  const cardIds = staticRows.map((r) => r.card_id);
  const placeholders = cardIds.map(() => '?').join(',');

  const userCards = await userDb.getAllAsync<{
    id: string;
    card_id: number;
    target_lang: string;
    due_date: string;
    state: number;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    updated_at: string;
  }>(
    `SELECT * FROM User_Cards WHERE target_lang = ? AND card_id IN (${placeholders});`,
    [langName, ...cardIds]
  );

  const staticMap = new Map<number, (typeof staticRows)[0]>();
  staticRows.forEach((r) => staticMap.set(r.card_id, r));

  const result: CardWithDetails[] = [];

  for (const uc of userCards) {
    const sCard = staticMap.get(uc.card_id);
    if (!sCard) continue;

    const cefr = difficultyToCefr(sCard.difficulty);
    result.push({
      id: uc.id,
      front_lexeme_id: uc.card_id,
      back_lexeme_id: uc.card_id,
      due_date: uc.due_date,
      state: uc.state,
      stability: uc.stability,
      difficulty: uc.difficulty,
      elapsed_days: uc.elapsed_days,
      scheduled_days: uc.scheduled_days,
      reps: uc.reps,
      lapses: uc.lapses,
      updated_at: uc.updated_at,
      front_term: sCard.target_translation,
      front_lang: targetLang,
      front_pos: sCard.pos || null,
      front_cefr: cefr,
      back_term: sCard.primary_term,
      back_lang: 'en',
      back_pos: sCard.pos || null,
      back_cefr: cefr,
      concept_desc: sCard.definition || '',
    });
  }

  // If no user cards exist in this deck yet, auto-garrison them so the user can immediately practice!
  if (result.length === 0) {
    await garrisonEntireDeck(deckIdOrSliceId, targetLang, slice);
    return getDeckCardsForReview(deckIdOrSliceId, targetLang);
  }

  return result;
}

/**
 * Returns words for the Difficulty list view.
 */
export async function getWordsByDifficulty(
  cefr: string,
  targetLang = 'es'
): Promise<DifficultyWordItem[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);

  let query = `
    SELECT 
      c.card_id,
      c.deck_id,
      c.primary_term,
      c.pos,
      COALESCE(cd.definition, c.definition) as definition,
      c.cili_id,
      c.difficulty,
      d.category,
      d.subcategory,
      COALESCE(ct.translation, c.primary_term) as target_translation
    FROM cards c
    JOIN decks d ON d.deck_id = c.deck_id
    LEFT JOIN card_translations ct ON ct.card_id = c.card_id AND ct.lang_name = ?
    LEFT JOIN card_definitions cd ON cd.card_id = c.card_id AND cd.lang_name = ?
  `;
  const params: any[] = [langName, langName];

  if (cefr !== 'ALL') {
    query += ' WHERE c.difficulty = ?';
    params.push(cefrToDifficulty(cefr));
  }

  query += ' ORDER BY c.difficulty ASC, c.card_id ASC;';

  const rows = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    primary_term: string;
    pos: string;
    definition: string;
    cili_id: string;
    difficulty: number;
    category: string;
    subcategory: string;
    target_translation: string;
  }>(query, params);

  const cardIds = rows.map((r) => r.card_id);
  const placeholders = cardIds.length > 0 ? cardIds.map(() => '?').join(',') : '0';
  const userCards = await userDb.getAllAsync<{
    id: string;
    card_id: number;
    state: number;
    stability: number;
    reps: number;
    lapses: number;
    due_date: string;
  }>(
    `SELECT id, card_id, state, stability, reps, lapses, due_date FROM User_Cards WHERE target_lang = ? AND card_id IN (${placeholders});`,
    [langName, ...cardIds]
  );

  const ucMap = new Map<number, (typeof userCards)[0]>();
  userCards.forEach((uc) => ucMap.set(uc.card_id, uc));

  return rows.map((r) => {
    const uc = ucMap.get(r.card_id);
    const cefrLevel = difficultyToCefr(r.difficulty);
    return {
      concept_id: r.cili_id || `c_${r.card_id}`,
      concept_desc: r.definition || '',
      front_lexeme_id: r.card_id,
      front_term: r.target_translation,
      front_lang: targetLang,
      front_pos: r.pos || null,
      front_cefr: cefrLevel,
      back_lexeme_id: r.card_id,
      back_term: r.primary_term,
      back_lang: 'en',
      deck_name: formatSubcategoryName(r.subcategory),
      theme_name: formatSubcategoryName(r.category),
      frequency_rank: null,
      is_queued: !!uc,
      user_card_id: uc ? uc.id : undefined,
      stability: uc ? uc.stability : undefined,
      reps: uc ? uc.reps : undefined,
      lapses: uc ? uc.lapses : undefined,
      due_date: uc ? uc.due_date : undefined,
      state: uc ? uc.state : undefined,
    };
  });
}

/**
 * Returns CEFR tier statistics (total, queued, mastered, available).
 */
export async function getDifficultyStats(
  targetLang = 'es'
): Promise<DifficultyStat[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);

  // Total cards per tier
  const totalRows = await staticDb.getAllAsync<{
    difficulty: number;
    count: number;
  }>('SELECT difficulty, count(card_id) as count FROM cards GROUP BY difficulty;');

  const totalMap = new Map<number, number>();
  totalRows.forEach((r) => totalMap.set(r.difficulty, r.count));

  // User cards per card_id
  const userCards = await userDb.getAllAsync<{
    card_id: number;
    stability: number;
    reps: number;
  }>('SELECT card_id, stability, reps FROM User_Cards WHERE target_lang = ?;', [langName]);

  const cardDiffRows = await staticDb.getAllAsync<{
    card_id: number;
    difficulty: number;
  }>('SELECT card_id, difficulty FROM cards;');

  const cardDiffMap = new Map<number, number>();
  cardDiffRows.forEach((r) => cardDiffMap.set(r.card_id, r.difficulty));

  const queuedMap = new Map<number, number>();
  const masteredMap = new Map<number, number>();

  for (const uc of userCards) {
    const diff = cardDiffMap.get(uc.card_id);
    if (diff !== undefined) {
      queuedMap.set(diff, (queuedMap.get(diff) || 0) + 1);
      if (uc.stability >= 21 || uc.reps >= 3) {
        masteredMap.set(diff, (masteredMap.get(diff) || 0) + 1);
      }
    }
  }

  const tiers: { cefr: CEFRLevel; label: string; tier: number }[] = [
    { cefr: 'A1', label: 'Novice Gateway', tier: 1 },
    { cefr: 'A2', label: 'Apprentice Trail', tier: 2 },
    { cefr: 'B1', label: 'Adept Realm', tier: 3 },
    { cefr: 'B2', label: 'Expert Expedition', tier: 4 },
    { cefr: 'C1', label: 'Master Scriptorium', tier: 5 },
    { cefr: 'C2', label: 'Grandmaster Citadel', tier: 6 },
  ];

  return tiers.map((t) => {
    const total = totalMap.get(t.tier) || 0;
    const queued = queuedMap.get(t.tier) || 0;
    const mastered = masteredMap.get(t.tier) || 0;
    return {
      cefr: t.cefr,
      label: t.label,
      tier: t.tier,
      total_count: total,
      queued_count: queued,
      mastered_count: mastered,
      available_count: Math.max(0, total - queued),
    };
  });
}

/**
 * Adds all unqueued words of a specific CEFR tier to User_Cards.
 */
export async function addWordsByDifficultyToQueue(
  cefr: string,
  targetLang = 'es'
): Promise<number> {
  const words = await getWordsByDifficulty(cefr, targetLang);
  const unqueued = words.filter((w) => !w.is_queued);
  if (unqueued.length === 0) return 0;

  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const now = new Date().toISOString();

  for (const w of unqueued) {
    const cardIdStr = `card_${w.front_lexeme_id}_${langName}`;
    await userDb.runAsync(
      `INSERT OR REPLACE INTO User_Cards (
        id, card_id, target_lang, due_date, state, stability, difficulty,
        elapsed_days, scheduled_days, reps, lapses, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [cardIdStr, w.front_lexeme_id, langName, now, 0, 0, 0, 0, 0, 0, 0, now]
    );
  }

  return unqueued.length;
}

/**
 * Returns overview summary of cards by SRS mastery stage.
 */
export async function getMasterySummary(
  targetLang = 'es'
): Promise<MasterySummary> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const now = new Date().toISOString();

  const totalCardRow = await staticDb.getFirstAsync<{ count: number }>(
    'SELECT count(card_id) as count FROM cards;'
  );
  const totalLibrary = totalCardRow?.count || 0;

  const userCards = await userDb.getAllAsync<{
    card_id: number;
    state: number;
    stability: number;
    reps: number;
    lapses: number;
    due_date: string;
  }>('SELECT card_id, state, stability, reps, lapses, due_date FROM User_Cards WHERE target_lang = ?;', [langName]);

  let slipping = 0;
  let learning = 0;
  let mastered = 0;
  let newQueue = 0;

  for (const uc of userCards) {
    if (uc.reps === 0 || uc.state === 0) {
      newQueue++;
    } else if (uc.lapses > 0 && uc.due_date < now) {
      slipping++;
    } else if (uc.stability >= 21 || uc.reps >= 3) {
      mastered++;
    } else {
      learning++;
    }
  }

  const queuedCount = userCards.length;
  const available = Math.max(0, totalLibrary - queuedCount);

  return {
    slipping_count: slipping,
    learning_count: learning,
    mastered_count: mastered,
    new_queue_count: newQueue,
    available_count: available,
    total_library_count: totalLibrary,
  };
}

/**
 * Returns words filtered by their mastery stage.
 */
export async function getMasteryWords(
  stage: MasteryStage,
  targetLang = 'es'
): Promise<MasteryWordItem[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const now = new Date().toISOString();

  // 1. Fetch all cards with translations and deck info
  const allCards = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    primary_term: string;
    pos: string;
    definition: string;
    cili_id: string;
    difficulty: number;
    category: string;
    subcategory: string;
    target_translation: string;
  }>(
    `SELECT 
      c.card_id,
      c.deck_id,
      c.primary_term,
      c.pos,
      COALESCE(cd.definition, c.definition) as definition,
      c.cili_id,
      c.difficulty,
      d.category,
      d.subcategory,
      COALESCE(ct.translation, c.primary_term) as target_translation
    FROM cards c
    JOIN decks d ON d.deck_id = c.deck_id
    LEFT JOIN card_translations ct ON ct.card_id = c.card_id AND ct.lang_name = ?
    LEFT JOIN card_definitions cd ON cd.card_id = c.card_id AND cd.lang_name = ?
    ORDER BY c.card_id ASC;`,
    [langName, langName]
  );

  // 2. Fetch all user cards for this language
  const userCards = await userDb.getAllAsync<{
    id: string;
    card_id: number;
    state: number;
    stability: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    due_date: string;
  }>('SELECT id, card_id, state, stability, scheduled_days, reps, lapses, due_date FROM User_Cards WHERE target_lang = ?;', [langName]);

  const userMap = new Map<number, (typeof userCards)[0]>();
  userCards.forEach((uc) => userMap.set(uc.card_id, uc));

  const items: MasteryWordItem[] = [];

  for (const c of allCards) {
    const uc = userMap.get(c.card_id);
    let cardStage: MasteryStage = 'available';

    if (uc) {
      if (uc.reps === 0 || uc.state === 0) {
        cardStage = 'new_in_queue';
      } else if (uc.lapses > 0 && uc.due_date < now) {
        cardStage = 'slipping';
      } else if (uc.stability >= 21 || uc.reps >= 3) {
        cardStage = 'mastered';
      } else {
        cardStage = 'learning';
      }
    }

    if (cardStage !== stage) continue;

    items.push({
      concept_id: c.cili_id || `c_${c.card_id}`,
      concept_desc: c.definition || '',
      front_lexeme_id: c.card_id,
      front_term: c.target_translation,
      front_lang: targetLang,
      front_pos: c.pos || null,
      front_cefr: difficultyToCefr(c.difficulty),
      back_lexeme_id: c.card_id,
      back_term: c.primary_term,
      back_lang: 'en',
      deck_name: formatSubcategoryName(c.subcategory),
      theme_name: formatSubcategoryName(c.category),
      is_queued: !!uc,
      user_card_id: uc ? uc.id : undefined,
      stage: cardStage,
      stability: uc ? uc.stability : undefined,
      scheduled_days: uc ? uc.scheduled_days : undefined,
      reps: uc ? uc.reps : undefined,
      lapses: uc ? uc.lapses : undefined,
      due_date: uc ? uc.due_date : undefined,
      state: uc ? uc.state : undefined,
    });
  }

  return items;
}

/**
 * Adds available (unqueued) words into User_Cards up to a limit.
 */
export async function addAvailableWordsToQueue(
  limit = 10,
  targetLang = 'es'
): Promise<number> {
  const available = await getMasteryWords('available', targetLang);
  const toAdd = available.slice(0, limit);
  if (toAdd.length === 0) return 0;

  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const now = new Date().toISOString();

  for (const w of toAdd) {
    const cardIdStr = `card_${w.front_lexeme_id}_${langName}`;
    await userDb.runAsync(
      `INSERT OR REPLACE INTO User_Cards (
        id, card_id, target_lang, due_date, state, stability, difficulty,
        elapsed_days, scheduled_days, reps, lapses, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [cardIdStr, w.front_lexeme_id, langName, now, 0, 0, 0, 0, 0, 0, 0, now]
    );
  }

  return toAdd.length;
}

/**
 * Updates a card's FSRS spaced repetition state after user grading.
 */
export async function updateCardFSRS(
  cardId: string,
  data: {
    due_date: string;
    state: number;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
  }
): Promise<void> {
  const userDb = await getUserDb();
  const now = new Date().toISOString();

  await userDb.runAsync(
    `UPDATE User_Cards SET
      due_date = ?,
      state = ?,
      stability = ?,
      difficulty = ?,
      elapsed_days = ?,
      scheduled_days = ?,
      reps = ?,
      lapses = ?,
      updated_at = ?
    WHERE id = ?;`,
    [
      data.due_date,
      data.state,
      data.stability,
      data.difficulty,
      data.elapsed_days,
      data.scheduled_days,
      data.reps,
      data.lapses,
      now,
      cardId,
    ]
  );
}

/**
 * Searches cards & translations in the static lexicon database.
 */
export async function searchLexemesFTS(
  searchTerm: string,
  targetLang = 'es'
): Promise<(Lexeme & { concept_desc: string; concept_id: string })[]> {
  if (!searchTerm.trim()) return [];
  const staticDb = await getStaticDb();
  const langName = resolveLanguageName(targetLang);
  const pattern = `%${searchTerm.trim()}%`;

  const rows = await staticDb.getAllAsync<{
    card_id: number;
    primary_term: string;
    pos: string;
    definition: string;
    cili_id: string;
    difficulty: number;
    translation: string;
  }>(
    `SELECT 
      c.card_id,
      c.primary_term,
      c.pos,
      c.definition,
      c.cili_id,
      c.difficulty,
      COALESCE(ct.translation, c.primary_term) as translation
    FROM cards c
    LEFT JOIN card_translations ct ON ct.card_id = c.card_id AND ct.lang_name = ?
    WHERE c.primary_term LIKE ? OR ct.translation LIKE ? OR c.definition LIKE ?
    LIMIT 30;`,
    [langName, pattern, pattern, pattern]
  );

  return rows.map((r) => ({
    id: r.card_id,
    language: targetLang,
    term: r.translation,
    pos: r.pos || null,
    cefr_level: difficultyToCefr(r.difficulty),
    frequency_rank: null,
    concept_desc: r.definition || '',
    concept_id: r.cili_id || `c_${r.card_id}`,
  }));
}

/**
 * Returns domains hierarchy for DomainBrowser.
 */
export async function getDomainsHierarchy(): Promise<Domain[]> {
  const staticDb = await getStaticDb();
  const rows = await staticDb.getAllAsync<{
    deck_id: number;
    category: string;
    subcategory: string;
    difficulty: number;
    description: string;
  }>('SELECT deck_id, category, subcategory, difficulty, description FROM decks ORDER BY deck_id ASC;');

  const categories = Array.from(new Set(rows.map((r) => r.category)));
  const domains: Domain[] = [];

  for (const cat of categories) {
    const meta = CATEGORY_META[cat] || {
      name: cat,
      description: '',
      icon_name: 'book',
    };
    domains.push({
      id: `domain_${cat}`,
      parent_id: null,
      name: meta.name,
      description: meta.description,
      difficulty_level: 1,
      icon_name: meta.icon_name,
      is_introductory: false,
    });
  }

  for (const r of rows) {
    domains.push({
      id: `sub_${r.deck_id}`,
      parent_id: `domain_${r.category}`,
      name: formatSubcategoryName(r.subcategory),
      description: r.description || `${formatSubcategoryName(r.subcategory)} vocabulary`,
      difficulty_level: r.difficulty,
      icon_name: CATEGORY_META[r.category]?.icon_name || 'book',
      is_introductory: r.difficulty === 1,
    });
  }

  return domains;
}

/**
 * Returns lexemes by domain for DomainBrowser.
 */
export async function getLexemesByDomain(
  domainId: string,
  cefrFilter?: string
): Promise<Lexeme[]> {
  const staticDb = await getStaticDb();
  let deckId: number | null = null;
  let categoryFilter: string | null = null;

  if (domainId.startsWith('sub_')) {
    deckId = parseInt(domainId.replace('sub_', ''), 10);
  } else if (domainId.startsWith('domain_')) {
    categoryFilter = domainId.replace('domain_', '');
  }

  let query = `
    SELECT 
      c.card_id,
      c.primary_term,
      c.pos,
      c.difficulty
    FROM cards c
    JOIN decks d ON d.deck_id = c.deck_id
  `;
  const params: any[] = [];
  const whereClauses: string[] = [];

  if (deckId !== null) {
    whereClauses.push('c.deck_id = ?');
    params.push(deckId);
  } else if (categoryFilter !== null) {
    whereClauses.push('d.category = ?');
    params.push(categoryFilter);
  }

  if (cefrFilter && cefrFilter !== 'ALL') {
    whereClauses.push('c.difficulty = ?');
    params.push(cefrToDifficulty(cefrFilter));
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY c.difficulty ASC, c.card_id ASC;';

  const rows = await staticDb.getAllAsync<{
    card_id: number;
    primary_term: string;
    pos: string;
    difficulty: number;
  }>(query, params);

  return rows.map((r) => ({
    id: r.card_id,
    language: 'en',
    term: r.primary_term,
    pos: r.pos || null,
    cefr_level: difficultyToCefr(r.difficulty),
    frequency_rank: null,
  }));
}

/**
 * Garrisons a single card for DomainBrowser or search.
 */
export async function garrisonCard(
  frontLexemeId: number,
  backLexemeId: number,
  targetLang = 'es'
): Promise<string> {
  return addWordToQueue(frontLexemeId, backLexemeId, `c_${frontLexemeId}`, targetLang);
}

/**
 * Logs a review attempt in Review_Logs for activity heatmap & streaks.
 */
export async function logReviewEvent(
  cardId: string | number,
  rating: number
): Promise<void> {
  const userDb = await getUserDb();
  const numericId = typeof cardId === 'number' ? cardId : parseInt(cardId.split('_')[1] || '1', 10);
  const now = new Date().toISOString();

  await userDb.runAsync(
    'INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);',
    [numericId, rating, now]
  );
}

/**
 * Seeds sample past review events into user_vault.sqlite Review_Logs so heatmap shows realistic streaks.
 */
export async function seedSampleReviewLogs(db: SQLite.SQLiteDatabase): Promise<void> {
  const now = new Date();
  const daysActive = [0, 1, 2, 4, 5, 7, 8, 9, 11, 14, 15, 18, 20, 22, 25, 28, 30, 35, 42];

  for (const dayOffset of daysActive) {
    const reviewDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const reviewsCount = Math.floor(Math.random() * 8) + 3;
    for (let i = 0; i < reviewsCount; i++) {
      const cardId = Math.floor(Math.random() * 50) + 1;
      const rating = Math.random() > 0.15 ? 3 : 1;
      const hoursOffset = Math.floor(Math.random() * 12);
      const timestamp = new Date(reviewDate.getTime() + hoursOffset * 3600000).toISOString();
      await db.runAsync(
        'INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);',
        [cardId, rating, timestamp]
      );
    }
  }
}

/**
 * Returns progress overview data for ProgressScreen.
 */
export async function getProgressOverview(
  weeksCount = 18
): Promise<ProgressOverview> {
  const userDb = await getUserDb();
  const staticDb = await getStaticDb();

  const totalCardsRow = await staticDb.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM cards;'
  );
  const totalCards = totalCardsRow?.count || 0;

  const masteredRow = await userDb.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM User_Cards WHERE stability >= 21 OR reps >= 3;'
  );
  const masteredCards = masteredRow?.count || 0;

  const totalReviewsRow = await userDb.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM Review_Logs;'
  );
  const totalReviews = totalReviewsRow?.count || 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayReviewsRow = await userDb.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM Review_Logs WHERE reviewed_at LIKE ?;',
    [`${todayStr}%`]
  );
  const todayReviews = todayReviewsRow?.count || 0;

  // Compute daily review counts
  const logs = await userDb.getAllAsync<{ reviewed_at: string }>(
    'SELECT reviewed_at FROM Review_Logs ORDER BY reviewed_at ASC;'
  );

  const dayCounts = new Map<string, number>();
  for (const l of logs) {
    const day = l.reviewed_at.split('T')[0];
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }

  // Calculate streak
  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  const cursor = new Date();
  while (true) {
    const dayKey = cursor.toISOString().split('T')[0];
    if (dayCounts.has(dayKey) && dayCounts.get(dayKey)! > 0) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      if (currentStreak === 0) {
        cursor.setDate(cursor.getDate() - 1);
        const prevKey = cursor.toISOString().split('T')[0];
        if (dayCounts.has(prevKey) && dayCounts.get(prevKey)! > 0) {
          currentStreak++;
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
      }
      break;
    }
  }

  const sortedDays = Array.from(dayCounts.keys()).sort();
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) {
      runningStreak = 1;
    } else {
      const prev = new Date(sortedDays[i - 1]);
      const curr = new Date(sortedDays[i]);
      const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));
      if (diff === 1) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
    }
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
  }
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  // Activity Grid
  const totalDays = weeksCount * 7;
  const gridEndDate = new Date();
  const dayOfWeek = gridEndDate.getDay(); // 0 = Sunday
  gridEndDate.setDate(gridEndDate.getDate() + (6 - dayOfWeek));

  const gridStartDate = new Date(gridEndDate);
  gridStartDate.setDate(gridStartDate.getDate() - totalDays + 1);

  const gridWeeks: ActivityWeek[] = [];
  const monthLabels: { weekIndex: number; label: string }[] = [];
  let currentMonth = -1;

  let iterDate = new Date(gridStartDate);
  for (let w = 0; w < weeksCount; w++) {
    const days: (ActivityDay | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = iterDate.toISOString().split('T')[0];
      const count = dayCounts.get(dateStr) || 0;
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (count >= 12) level = 4;
      else if (count >= 8) level = 3;
      else if (count >= 4) level = 2;
      else if (count >= 1) level = 1;

      days.push({ date: dateStr, count, level });

      if (d === 0) {
        const m = iterDate.getMonth();
        if (m !== currentMonth) {
          currentMonth = m;
          const label = iterDate.toLocaleDateString('en-US', { month: 'short' });
          monthLabels.push({ weekIndex: w, label });
        }
      }

      iterDate.setDate(iterDate.getDate() + 1);
    }
    gridWeeks.push({ days });
  }

  // Weekly distribution
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayDistMap = new Map<number, number>();
  for (const l of logs) {
    const d = new Date(l.reviewed_at).getDay();
    dayDistMap.set(d, (dayDistMap.get(d) || 0) + 1);
  }

  const weeklyDistribution = dayLabels.map((day, idx) => ({
    day,
    count: dayDistMap.get(idx) || 0,
  }));

  return {
    currentStreak,
    longestStreak,
    totalReviews,
    todayReviews,
    masteredCards,
    totalCards,
    gridWeeks,
    monthLabels,
    weeklyDistribution,
  };
}

/**
 * Returns summary stats for App header and dashboard.
 */
export async function getVaultStats(targetLang = 'es'): Promise<VaultStats> {
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const now = new Date().toISOString();

  const totalRow = await userDb.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM User_Cards WHERE target_lang = ?;',
    [langName]
  );
  const totalCards = totalRow?.count || 0;

  const dueRow = await userDb.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM User_Cards WHERE target_lang = ? AND due_date <= ?;',
    [langName, now]
  );
  const dueCards = dueRow?.count || 0;

  const newRow = await userDb.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM User_Cards WHERE target_lang = ? AND (reps = 0 OR state = 0);',
    [langName]
  );
  const newCards = newRow?.count || 0;

  const masteredRow = await userDb.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM User_Cards WHERE target_lang = ? AND (stability >= 21 OR reps >= 3);',
    [langName]
  );
  const masteredCards = masteredRow?.count || 0;

  // Streak calculation
  const logs = await userDb.getAllAsync<{ reviewed_at: string }>(
    'SELECT reviewed_at FROM Review_Logs ORDER BY reviewed_at DESC;'
  );

  const daySet = new Set(logs.map((l) => l.reviewed_at.split('T')[0]));
  let streakDays = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().split('T')[0];
    if (daySet.has(key)) {
      streakDays++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      if (streakDays === 0) {
        cursor.setDate(cursor.getDate() - 1);
        const prevKey = cursor.toISOString().split('T')[0];
        if (daySet.has(prevKey)) {
          streakDays++;
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
      }
      break;
    }
  }

  const xpPoints = (logs.length || 0) * 15;

  return {
    totalCards,
    dueCards,
    newCards,
    masteredCards,
    streakDays,
    xpPoints,
  };
}

/**
 * Settings store in user_vault.sqlite.
 */
export async function getSetting(key: string): Promise<string | null> {
  const userDb = await getUserDb();
  const row = await userDb.getFirstAsync<{ value: string }>(
    'SELECT value FROM Settings WHERE key = ?;',
    [key]
  );
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const userDb = await getUserDb();
  const now = new Date().toISOString();
  await userDb.runAsync(
    'INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES (?, ?, ?);',
    [key, value, now]
  );
}

export async function isAdFreeUser(): Promise<boolean> {
  const val = await getSetting('is_ad_free');
  return val === 'true';
}

export async function setAdFreeUser(adFree: boolean): Promise<void> {
  await setSetting('is_ad_free', adFree ? 'true' : 'false');
}
