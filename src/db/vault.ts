import * as SQLite from 'expo-sqlite';
import { importDatabaseFromAssetAsync } from 'expo-sqlite';
import { USER_SCHEMA_SQL } from './schema';
import {
  DeckLabels,
  DeckRow,
  DeckTitleTranslation,
  buildDeckLabels,
  capitalizeTitle,
  groupDecksIntoThemes,
  resolveDeckIcon,
} from './deckHierarchy';
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
  DownloadedLanguage,
  LanguagePairSettings,
  EnrolledLanguagePair,
  LanguagePairProgress,
} from '../types';

let staticDbInstance: SQLite.SQLiteDatabase | null = null;
let userDbInstance: SQLite.SQLiteDatabase | null = null;

import { SUPPORTED_LANGUAGES, resolveLanguageCode } from '../locales/languages';
import { getDeviceLanguage } from '../locales';

const STATIC_DB_NAME = 'lexicon_v1.0.0.db';
const USER_DB_NAME = 'user_vault.sqlite';

/**
 * Fast lookup map matching ISO codes, regional tags, and case-insensitive names
 * to the exact lang_name string in lexicon_v1.0.0.db (all 123 languages).
 */
const LANGUAGE_LOOKUP = new Map<string, string>();

// Initialize lookup map from all 123 supported languages
for (const lang of SUPPORTED_LANGUAGES) {
  LANGUAGE_LOOKUP.set(lang.name.toLowerCase(), lang.name);
  LANGUAGE_LOOKUP.set(lang.code.toLowerCase(), lang.name);
  if (lang.code.includes('-')) {
    const base = lang.code.split('-')[0].toLowerCase();
    if (!LANGUAGE_LOOKUP.has(base)) {
      LANGUAGE_LOOKUP.set(base, lang.name);
    }
  }
}

// Common aliases and fallbacks
LANGUAGE_LOOKUP.set('zh', 'Chinese (Simplified)');
LANGUAGE_LOOKUP.set('zh-hans', 'Chinese (Simplified)');
LANGUAGE_LOOKUP.set('zh-hant', 'Chinese (Traditional)');
LANGUAGE_LOOKUP.set('pt', 'Portuguese (Brazil)');
LANGUAGE_LOOKUP.set('pt-br', 'Portuguese (Brazil)');
LANGUAGE_LOOKUP.set('pt-pt', 'Portuguese (Portugal)');
LANGUAGE_LOOKUP.set('fr-ca', 'French (Canada)');
LANGUAGE_LOOKUP.set('no', 'Norwegian (Bokmål)');
LANGUAGE_LOOKUP.set('nb', 'Norwegian (Bokmål)');
LANGUAGE_LOOKUP.set('ku', 'Kurdish (Kurmanji)');
LANGUAGE_LOOKUP.set('kurmanji', 'Kurdish (Kurmanji)');
LANGUAGE_LOOKUP.set('ckb', 'Kurdish (Sorani)');
LANGUAGE_LOOKUP.set('sorani', 'Kurdish (Sorani)');

LANGUAGE_LOOKUP.set('portuguese', 'Portuguese (Brazil)');
LANGUAGE_LOOKUP.set('arabic', 'Arabic');
LANGUAGE_LOOKUP.set('english', 'English');
LANGUAGE_LOOKUP.set('spanish', 'Spanish');

export function resolveLanguageName(codeOrName: string): string {
  if (!codeOrName) return 'Spanish';
  const trimmed = codeOrName.trim();
  const lower = trimmed.toLowerCase();
  const direct = LANGUAGE_LOOKUP.get(lower);
  if (direct) return direct;

  // Search by prefix / contains
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang.name.toLowerCase().startsWith(lower) || lower.startsWith(lang.name.toLowerCase())) {
      return lang.name;
    }
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Returns all potential candidate name/code variations for matching in database tables
 * (Downloaded_Card_Translations and static card_translations).
 * Handles language families like Portuguese, Kurdish, Chinese, Norwegian, French.
 */
export function getCandidateLanguageNames(codeOrName: string): string[] {
  if (!codeOrName) return ['Spanish', 'es'];
  const trimmed = codeOrName.trim();
  const lower = trimmed.toLowerCase();
  const resolved = resolveLanguageName(trimmed);

  const candidates = new Set<string>();
  candidates.add(trimmed);
  candidates.add(lower);
  candidates.add(resolved);
  candidates.add(resolved.toLowerCase());

  if (lower.includes('-')) {
    const base = lower.split('-')[0];
    candidates.add(base);
    const baseResolved = resolveLanguageName(base);
    candidates.add(baseResolved);
    candidates.add(baseResolved.toLowerCase());
  }

  // Handle special language families / regional variants in lexicon DB
  if (lower.startsWith('pt') || lower.includes('portug')) {
    candidates.add('Portuguese (Brazil)');
    candidates.add('Portuguese (Portugal)');
    candidates.add('Portuguese');
    candidates.add('português');
    candidates.add('português (brasil)');
    candidates.add('português (portugal)');
    candidates.add('pt');
    candidates.add('pt-br');
    candidates.add('pt-pt');
  } else if (lower.startsWith('zh') || lower.includes('chin')) {
    candidates.add('Chinese (Simplified)');
    candidates.add('Chinese (Traditional)');
    candidates.add('Chinese');
    candidates.add('zh');
    candidates.add('zh-cn');
    candidates.add('zh-tw');
  } else if (lower.startsWith('fr') || lower.includes('french')) {
    candidates.add('French');
    candidates.add('French (Canada)');
    candidates.add('fr');
    candidates.add('fr-ca');
  } else if (lower.startsWith('no') || lower.startsWith('nb') || lower.includes('norweg')) {
    candidates.add('Norwegian (Bokmål)');
    candidates.add('Norwegian');
    candidates.add('no');
    candidates.add('nb');
  } else if (lower.startsWith('ku') || lower.startsWith('ckb') || lower.includes('kurd')) {
    candidates.add('Kurdish (Kurmanji)');
    candidates.add('Kurdish (Sorani)');
    candidates.add('Kurdish');
  } else if (lower.startsWith('en') || lower.includes('engl')) {
    candidates.add('English');
    candidates.add('en');
  } else if (lower.startsWith('ar') || lower.includes('arab')) {
    candidates.add('Arabic');
    candidates.add('ar');
  } else if (lower.startsWith('es') || lower.includes('span')) {
    candidates.add('Spanish');
    candidates.add('es');
  }

  return Array.from(candidates);
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
        forceOverwrite: true,
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

  // Safe migration for origin_lang in User_Cards
  try {
    await userDb.runAsync("ALTER TABLE User_Cards ADD COLUMN origin_lang TEXT DEFAULT 'en';");
  } catch {
    // Column already exists
  }

  // Safe migration: theme/deck/subdeck titles for language packs downloaded before subdecks existed
  for (const column of ['theme_translation', 'subtheme_translation', 'deck_translation', 'subdeck_translation']) {
    try {
      await userDb.runAsync(`ALTER TABLE Downloaded_Deck_Translations ADD COLUMN ${column} TEXT DEFAULT '';`);
    } catch {
      // Column already exists
    }
  }

  // Initialize static DB connection
  await getStaticDb();

  // Check if Review_Logs has initial activity logs
  const logCheck = await userDb.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM Review_Logs;'
  );
  if (!logCheck || logCheck.count === 0) {
    console.log('[Vault] Seeding initial activity log...');
    await seedSampleReviewLogs(userDb);
  }
}

/**
 * Returns current language pair settings (origin / destination).
 */
export async function getLanguagePairSettings(): Promise<LanguagePairSettings> {
  const userDb = await getUserDb();
  const row = await userDb.getFirstAsync<{ value: string }>(
    "SELECT value FROM Settings WHERE key = 'language_pair';"
  );
  if (row) {
    try {
      return JSON.parse(row.value);
    } catch {
      // fallback
    }
  }

  const deviceLang = getDeviceLanguage();
  return {
    origin_lang: deviceLang,
    destination_lang: deviceLang === 'en' ? 'es' : 'en',
  };
}

/**
 * Sets active language pair settings.
 */
export async function setLanguagePairSettings(pair: LanguagePairSettings): Promise<void> {
  const userDb = await getUserDb();
  await userDb.runAsync(
    "INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES ('language_pair', ?, ?);",
    [JSON.stringify(pair), new Date().toISOString()]
  );
  // Auto-enroll the new active pair
  await enrollLanguagePair(pair);
}

/**
 * Returns all enrolled language pairs along with their real-time progress.
 * Merges Settings saved_language_pairs with current active pair and any distinct
 * (target_lang, origin_lang) found in User_Cards to guarantee complete continuity.
 */
export async function getEnrolledLanguagePairs(): Promise<EnrolledLanguagePair[]> {
  const userDb = await getUserDb();
  const currentPair = await getLanguagePairSettings();

  // 1. Read stored pairs from Settings
  let savedPairs: LanguagePairSettings[] = [];
  const row = await userDb.getFirstAsync<{ value: string }>(
    "SELECT value FROM Settings WHERE key = 'saved_language_pairs';"
  );
  if (row) {
    try {
      savedPairs = JSON.parse(row.value);
    } catch {
      savedPairs = [];
    }
  }

  // 2. Scan User_Cards for any cards already created in other language pairs
  const distinctCardLangs = await userDb.getAllAsync<{ target_lang: string; origin_lang: string | null }>(
    'SELECT DISTINCT target_lang, origin_lang FROM User_Cards;'
  );

  // 3. Collect unique language pairs
  const pairMap = new Map<string, { destination_lang: string; origin_lang: string }>();

  const addPair = (dest: string, orig: string) => {
    if (!dest) return;
    const canonDest = resolveLanguageCode(dest);
    const canonOrig = resolveLanguageCode(orig || 'en');
    const key = `${canonDest.toLowerCase()}:${canonOrig.toLowerCase()}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, { destination_lang: canonDest, origin_lang: canonOrig });
    }
  };

  // Current active pair
  addPair(currentPair.destination_lang, currentPair.origin_lang);

  // Stored pairs
  for (const sp of savedPairs) {
    addPair(sp.destination_lang, sp.origin_lang);
  }

  // Scan from existing cards
  for (const d of distinctCardLangs) {
    addPair(d.target_lang, d.origin_lang || currentPair.origin_lang || 'en');
  }

  // 4. Calculate progress for each pair
  const now = new Date().toISOString();
  const result: EnrolledLanguagePair[] = [];

  for (const [key, p] of pairMap.entries()) {
    const destName = resolveLanguageName(p.destination_lang);
    const origName = resolveLanguageName(p.origin_lang);

    const totalRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE (target_lang = ? OR target_lang = ?);',
      [destName, p.destination_lang]
    );
    const dueRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND due_date <= ?;',
      [destName, p.destination_lang, now]
    );
    const newRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND (reps = 0 OR state = 0);',
      [destName, p.destination_lang]
    );
    const masteredRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND (stability >= 21 OR reps >= 3);',
      [destName, p.destination_lang]
    );

    result.push({
      id: key,
      origin_lang: p.origin_lang,
      destination_lang: p.destination_lang,
      origin_name: origName,
      destination_name: destName,
      enrolled_at: now,
      progress: {
        totalCards: totalRow?.count || 0,
        dueCards: dueRow?.count || 0,
        newCards: newRow?.count || 0,
        masteredCards: masteredRow?.count || 0,
      },
    });
  }

  // Persist updated list to settings
  const normalizedList = Array.from(pairMap.values());
  await userDb.runAsync(
    "INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES ('saved_language_pairs', ?, ?);",
    [JSON.stringify(normalizedList), now]
  );

  return result;
}

/**
 * Enrolls a new language pair into saved_language_pairs.
 */
export async function enrollLanguagePair(pair: LanguagePairSettings): Promise<void> {
  const userDb = await getUserDb();
  let savedPairs: LanguagePairSettings[] = [];
  const row = await userDb.getFirstAsync<{ value: string }>(
    "SELECT value FROM Settings WHERE key = 'saved_language_pairs';"
  );
  if (row) {
    try {
      savedPairs = JSON.parse(row.value);
    } catch {
      savedPairs = [];
    }
  }

  const canonDest = resolveLanguageCode(pair.destination_lang);
  const canonOrig = resolveLanguageCode(pair.origin_lang || 'en');
  const key = `${canonDest.toLowerCase()}:${canonOrig.toLowerCase()}`;
  const exists = savedPairs.some(
    (p) => `${resolveLanguageCode(p.destination_lang).toLowerCase()}:${resolveLanguageCode(p.origin_lang || 'en').toLowerCase()}` === key
  );
  if (!exists) {
    savedPairs.push({ destination_lang: canonDest, origin_lang: canonOrig });
    await userDb.runAsync(
      "INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES ('saved_language_pairs', ?, ?);",
      [JSON.stringify(savedPairs), new Date().toISOString()]
    );
  }
}

/**
 * Removes an enrolled language pair from saved_language_pairs.
 */
export async function removeEnrolledLanguagePair(pairId: string): Promise<void> {
  const userDb = await getUserDb();
  let savedPairs: LanguagePairSettings[] = [];
  const row = await userDb.getFirstAsync<{ value: string }>(
    "SELECT value FROM Settings WHERE key = 'saved_language_pairs';"
  );
  if (row) {
    try {
      savedPairs = JSON.parse(row.value);
    } catch {
      savedPairs = [];
    }
  }

  const parts = pairId.split(':');
  const targetDest = resolveLanguageCode(parts[0]).toLowerCase();
  const targetOrig = resolveLanguageCode(parts[1] || 'en').toLowerCase();
  const targetKey = `${targetDest}:${targetOrig}`;

  const filtered = savedPairs.filter((p) => {
    const pDest = resolveLanguageCode(p.destination_lang).toLowerCase();
    const pOrig = resolveLanguageCode(p.origin_lang || 'en').toLowerCase();
    return `${pDest}:${pOrig}` !== targetKey;
  });
  await userDb.runAsync(
    "INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES ('saved_language_pairs', ?, ?);",
    [JSON.stringify(filtered), new Date().toISOString()]
  );
}

/**
 * Returns all downloaded languages currently stored in user_vault.sqlite.
 */
export async function getDownloadedLanguages(): Promise<DownloadedLanguage[]> {
  const userDb = await getUserDb();
  return userDb.getAllAsync<DownloadedLanguage>(
    'SELECT code, lang_name, downloaded_at, card_count, size_bytes FROM Downloaded_Languages ORDER BY lang_name ASC;'
  );
}

/**
 * Checks whether a language is downloaded locally in user_vault.sqlite.
 */
export async function isLanguageDownloaded(codeOrName: string): Promise<boolean> {
  const langName = resolveLanguageName(codeOrName);
  const userDb = await getUserDb();
  const row = await userDb.getFirstAsync<{ code: string }>(
    'SELECT code FROM Downloaded_Languages WHERE lang_name = ? OR code = ?;',
    [langName, codeOrName.toLowerCase()]
  );
  return !!row;
}

/**
 * Loads translations for a list of card IDs in destination and origin languages.
 * Reads from Downloaded_Card_Translations in user_vault.sqlite first,
 * with fallback to staticDb.card_translations.
 */
export async function loadCardTranslationsForPair(
  cardIds: number[],
  destLangParam: string,
  origLangParam: string
): Promise<{
  destMap: Map<number, string>;
  origMap: Map<number, string>;
  defMap: Map<number, string>;
}> {
  const userDb = await getUserDb();
  const staticDb = await getStaticDb();

  const destMap = new Map<number, string>();
  const origMap = new Map<number, string>();
  const defMap = new Map<number, string>();

  if (cardIds.length === 0) return { destMap, origMap, defMap };

  const destCandidates = getCandidateLanguageNames(destLangParam);
  const origCandidates = getCandidateLanguageNames(origLangParam);
  const allLangs = Array.from(new Set([...destCandidates, ...origCandidates]));

  const destLowerSet = new Set(destCandidates.map((c) => c.toLowerCase()));
  const origLowerSet = new Set(origCandidates.map((c) => c.toLowerCase()));

  const cardPlaceholders = cardIds.map(() => '?').join(',');
  const langPlaceholders = allLangs.map(() => '?').join(',');

  // 1. Query user_vault.sqlite downloaded translations first
  try {
    const downloadedTranslations = await userDb.getAllAsync<{
      card_id: number;
      lang_name: string;
      translation: string;
    }>(
      `SELECT card_id, lang_name, translation FROM Downloaded_Card_Translations 
       WHERE lang_name IN (${langPlaceholders}) AND card_id IN (${cardPlaceholders});`,
      [...allLangs, ...cardIds]
    );

    for (const row of downloadedTranslations) {
      const rowLang = row.lang_name.toLowerCase();
      if (destLowerSet.has(rowLang) && !destMap.has(row.card_id)) {
        destMap.set(row.card_id, row.translation);
      }
      if (origLowerSet.has(rowLang) && !origMap.has(row.card_id)) {
        origMap.set(row.card_id, row.translation);
      }
    }
  } catch (e) {
    console.warn('[Vault] Notice querying Downloaded_Card_Translations:', e);
  }

  // 2. Query downloaded definitions
  try {
    const downloadedDefs = await userDb.getAllAsync<{
      card_id: number;
      lang_name: string;
      definition: string;
    }>(
      `SELECT card_id, lang_name, definition FROM Downloaded_Card_Definitions 
       WHERE lang_name IN (${langPlaceholders}) AND card_id IN (${cardPlaceholders});`,
      [...allLangs, ...cardIds]
    );

    for (const row of downloadedDefs) {
      const rowLang = row.lang_name.toLowerCase();
      if (origLowerSet.has(rowLang)) {
        defMap.set(row.card_id, row.definition);
      } else if (destLowerSet.has(rowLang) && !defMap.has(row.card_id)) {
        defMap.set(row.card_id, row.definition);
      }
    }
  } catch (e) {
    console.warn('[Vault] Notice querying Downloaded_Card_Definitions:', e);
  }

  // 3. Fallback to staticDb if missing
  const missingDest = cardIds.filter((id) => !destMap.has(id));
  const missingOrig = cardIds.filter((id) => !origMap.has(id));

  if (missingDest.length > 0 || missingOrig.length > 0) {
    try {
      const staticTrans = await staticDb.getAllAsync<{
        card_id: number;
        lang_name: string;
        translation: string;
      }>(
        `SELECT card_id, lang_name, translation FROM card_translations 
         WHERE lang_name IN (${langPlaceholders}) AND card_id IN (${cardPlaceholders});`,
        [...allLangs, ...cardIds]
      );

      for (const row of staticTrans) {
        const rowLang = row.lang_name.toLowerCase();
        if (destLowerSet.has(rowLang) && !destMap.has(row.card_id)) {
          destMap.set(row.card_id, row.translation);
        }
        if (origLowerSet.has(rowLang) && !origMap.has(row.card_id)) {
          origMap.set(row.card_id, row.translation);
        }
      }
    } catch (e) {
      console.warn('[Vault] Notice querying static card_translations:', e);
    }
  }

  // Fallback definitions from staticDb if defMap is missing
  const missingDefs = cardIds.filter((id) => !defMap.has(id));
  if (missingDefs.length > 0) {
    try {
      const staticDefs = await staticDb.getAllAsync<{
        card_id: number;
        lang_name: string;
        definition: string;
      }>(
        `SELECT card_id, lang_name, definition FROM card_definitions 
         WHERE lang_name IN (${langPlaceholders}) AND card_id IN (${cardPlaceholders});`,
        [...allLangs, ...cardIds]
      );
      for (const row of staticDefs) {
        const rowLang = row.lang_name.toLowerCase();
        if (origLowerSet.has(rowLang)) {
          defMap.set(row.card_id, row.definition);
        } else if (destLowerSet.has(rowLang) && !defMap.has(row.card_id)) {
          defMap.set(row.card_id, row.definition);
        }
      }
    } catch (e) {
      console.warn('[Vault] Notice querying static card_definitions:', e);
    }
  }

  return { destMap, origMap, defMap };
}

export { CATEGORY_ICONS, SUBCATEGORY_ICONS, resolveDeckIcon, capitalizeTitle } from './deckHierarchy';

type DeckTranslationRow = {
  deck_id: number;
  theme_translation?: string | null;
  subtheme_translation?: string | null;
  deck_translation?: string | null;
  subdeck_translation?: string | null;
  category_translation?: string | null;
  subcategory_translation?: string | null;
};

/** Older rows only carry category/subcategory, which map to theme/deck. */
function toDeckTitles(row: DeckTranslationRow): DeckTitleTranslation {
  return {
    theme: row.theme_translation || row.category_translation || '',
    subtheme: row.subtheme_translation || '',
    deck: row.deck_translation || row.subcategory_translation || '',
    subdeck: row.subdeck_translation || '',
  };
}

/**
 * Loads translated theme, deck and subdeck titles for a list of deck IDs.
 * Checks Downloaded_Deck_Translations in user_vault.sqlite, then falls back to staticDb.
 * English uses the lexicon's own (English) names, so it returns no translations.
 */
export async function loadDeckTranslationsForDecks(
  deckIds: number[],
  langParam: string
): Promise<Map<number, DeckTitleTranslation>> {
  const result = new Map<number, DeckTitleTranslation>();
  if (deckIds.length === 0) return result;

  const candidates = getCandidateLanguageNames(langParam);
  if (candidates.includes('English')) return result;

  const userDb = await getUserDb();
  const staticDb = await getStaticDb();
  const candPlaceholders = candidates.map(() => '?').join(',');
  const deckPlaceholders = deckIds.map(() => '?').join(',');

  // 1. Query Downloaded_Deck_Translations in userDb (rows saved before subdecks existed lack subdeck titles)
  try {
    const downloaded = await userDb.getAllAsync<DeckTranslationRow>(
      `SELECT deck_id, theme_translation, subtheme_translation, deck_translation, subdeck_translation,
              category_translation, subcategory_translation
       FROM Downloaded_Deck_Translations
       WHERE lang_name IN (${candPlaceholders}) AND deck_id IN (${deckPlaceholders});`,
      [...candidates, ...deckIds]
    );
    for (const row of downloaded) {
      if (!result.has(row.deck_id) && row.subdeck_translation) {
        result.set(row.deck_id, toDeckTitles(row));
      }
    }
  } catch (e) {
    // Downloaded_Deck_Translations may be empty or not yet migrated
  }

  // 2. Query staticDb deck_translations for any missing decks
  const missingDecks = deckIds.filter((id) => !result.has(id));
  if (missingDecks.length > 0) {
    const missingPlaceholders = missingDecks.map(() => '?').join(',');
    try {
      const staticRows = await staticDb.getAllAsync<DeckTranslationRow>(
        `SELECT deck_id, theme_translation, subtheme_translation, deck_translation, subdeck_translation
         FROM deck_translations
         WHERE lang_name IN (${candPlaceholders}) AND deck_id IN (${missingPlaceholders});`,
        [...candidates, ...missingDecks]
      );
      for (const row of staticRows) {
        if (!result.has(row.deck_id)) {
          result.set(row.deck_id, toDeckTitles(row));
        }
      }
    } catch (e) {
      console.warn('[Vault] Notice querying deck_translations:', e);
    }
  }

  return result;
}

let deckCatalogCache: DeckRow[] | null = null;

/** All rows of the static decks table (one per subdeck), cached for the session. */
export async function getDeckCatalog(): Promise<DeckRow[]> {
  if (!deckCatalogCache) {
    const staticDb = await getStaticDb();
    deckCatalogCache = await staticDb.getAllAsync<DeckRow>(
      'SELECT deck_id, theme, subtheme, deck, subdeck, difficulty FROM decks ORDER BY deck_id ASC;'
    );
  }
  return deckCatalogCache;
}

/** Theme, deck and subdeck labels for every deck_id, in the requested title language. */
export async function getDeckLabels(translationLang: string): Promise<Map<number, DeckLabels>> {
  const catalog = await getDeckCatalog();
  const translations = await loadDeckTranslationsForDecks(
    catalog.map((d) => d.deck_id),
    translationLang
  );
  return buildDeckLabels(catalog, translations);
}

async function resolveTitleLanguage(
  targetLang: string,
  originLang?: string,
  titleLangPreference?: DeckTitleLanguageMode
): Promise<string> {
  const pref = titleLangPreference || (await getDeckTitleLanguagePreference());
  const effectiveOrigin = originLang || (await getLanguagePairSettings()).origin_lang;
  return pref === 'target' ? targetLang : effectiveOrigin;
}

/**
 * Tab 1: Themes & Thematic Decks.
 * Returns the lexicon's decks as Theme › Deck › Subdeck, with per-subdeck progress.
 */
export async function getThemesWithProgressiveDecks(
  targetLang = 'es',
  originLang?: string,
  titleLangPreference?: DeckTitleLanguageMode
): Promise<ThemeGroup[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);

  const decksRows = await getDeckCatalog();

  // Card counts and card → deck mapping
  const cardDeckRows = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
  }>('SELECT card_id, deck_id FROM cards;');
  const cardCountMap = new Map<number, number>();
  const cardToDeckMap = new Map<number, number>();
  cardDeckRows.forEach((r) => {
    cardToDeckMap.set(r.card_id, r.deck_id);
    cardCountMap.set(r.deck_id, (cardCountMap.get(r.deck_id) || 0) + 1);
  });

  // Tally user queue & mastery progress per subdeck
  const userProgressRows = await userDb.getAllAsync<{
    card_id: number;
    stability: number;
    reps: number;
  }>('SELECT card_id, stability, reps FROM User_Cards WHERE target_lang IN (?, ?);', [langName, targetLang]);

  const deckQueuedCount = new Map<number, number>();
  const deckMasteredCount = new Map<number, number>();
  const seenCards = new Set<number>();
  for (const uCard of userProgressRows) {
    if (seenCards.has(uCard.card_id)) continue;
    seenCards.add(uCard.card_id);
    const deckId = cardToDeckMap.get(uCard.card_id);
    if (deckId === undefined) continue;
    deckQueuedCount.set(deckId, (deckQueuedCount.get(deckId) || 0) + 1);
    if (uCard.stability >= 21 || uCard.reps >= 3) {
      deckMasteredCount.set(deckId, (deckMasteredCount.get(deckId) || 0) + 1);
    }
  }

  // Unlock states (by subdeck id or whole theme)
  const unlockedRows = await userDb.getAllAsync<{ deck_id: string }>(
    'SELECT deck_id FROM Deck_Access WHERE is_unlocked = 1;'
  );
  const unlockedSet = new Set(unlockedRows.map((r) => r.deck_id));

  const translationLang = await resolveTitleLanguage(targetLang, originLang, titleLangPreference);
  const labels = await getDeckLabels(translationLang);

  const leaves: DeckWithProgress[] = [];
  for (const d of decksRows) {
    const l = labels.get(d.deck_id);
    if (!l) continue;
    const cefr = difficultyToCefr(d.difficulty);
    const isUnlocked =
      d.deck_id === 1 || // First decks always unlocked
      d.deck_id === 2 ||
      unlockedSet.has(String(d.deck_id)) ||
      unlockedSet.has(d.theme);

    leaves.push({
      id: String(d.deck_id),
      real_deck_id: d.deck_id,
      theme_id: l.themeKey,
      theme_name: l.themeName,
      subtheme_name: l.subthemeName || undefined,
      deck_key: l.deckKey,
      deck_name: l.deckName,
      deck_icon_name: resolveDeckIcon(d.theme, d.deck),
      subdeck_name: l.subdeckName,
      has_subdecks: l.hasSubdecks,
      is_main_subdeck: !d.subdeck || d.subdeck.trim().toLowerCase() === d.deck.trim().toLowerCase(),
      name: l.displayName,
      full_name: l.fullName,
      subtitle: l.subtitle,
      description: '',
      difficulty_level: d.difficulty,
      difficulty_label: cefr,
      cefr_level: cefr,
      icon_name: resolveDeckIcon(d.theme, d.deck, d.subdeck),
      card_count: cardCountMap.get(d.deck_id) || 0,
      queued_count: deckQueuedCount.get(d.deck_id) || 0,
      mastered_count: deckMasteredCount.get(d.deck_id) || 0,
      is_pro: false,
      is_locked: !isUnlocked,
    });
  }

  return groupDecksIntoThemes(leaves);
}

/**
 * Tab 2: Difficulty Progression Map.
 * Organizes the static data into smaller UI-only decks sliced by (deck_id, difficulty).
 * For instance: "Domestic Animals (A1)", "Family Members (A1)", "Domestic Animals (B1)", etc.
 * Shows only the cards of that difficulty tier.
 */
export async function getAllDecksOrderedByDifficulty(
  targetLang = 'es',
  originLang?: string,
  titleLangPreference?: DeckTitleLanguageMode
): Promise<DeckWithProgress[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const translationLang = await resolveTitleLanguage(targetLang, originLang, titleLangPreference);

  // Group cards by (deck_id, difficulty)
  const sliceRows = await staticDb.getAllAsync<{
    deck_id: number;
    theme: string;
    deck: string;
    subdeck: string | null;
    difficulty: number;
    card_count: number;
  }>(`
    SELECT 
      d.deck_id,
      d.theme,
      d.deck,
      d.subdeck,
      c.difficulty,
      COUNT(c.card_id) as card_count
    FROM decks d
    JOIN cards c ON c.deck_id = d.deck_id
    GROUP BY d.deck_id, c.difficulty
    ORDER BY c.difficulty ASC, d.deck_id ASC;
  `);

  const labels = await getDeckLabels(translationLang);

  // Fetch all user cards for this language
  const userCards = await userDb.getAllAsync<{
    card_id: number;
    stability: number;
    reps: number;
  }>(
    'SELECT card_id, stability, reps FROM User_Cards WHERE target_lang IN (?, ?);',
    [langName, targetLang]
  );

  const cardMap = new Map<number, { stability: number; reps: number }>();
  userCards.forEach((c) =>
    cardMap.set(c.card_id, { stability: c.stability, reps: c.reps })
  );

  // Fetch card (deck_id, difficulty) mapping
  const allCards = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    difficulty: number;
  }>('SELECT card_id, deck_id, difficulty FROM cards;');

  const sliceQueuedCount = new Map<string, number>();
  const sliceMasteredCount = new Map<string, number>();

  for (const c of allCards) {
    const uc = cardMap.get(c.card_id);
    if (!uc) continue;

    const sliceKey = `${c.deck_id}_${c.difficulty}`;
    sliceQueuedCount.set(
      sliceKey,
      (sliceQueuedCount.get(sliceKey) || 0) + 1
    );

    if (uc.stability >= 21 || uc.reps >= 3) {
      sliceMasteredCount.set(
        sliceKey,
        (sliceMasteredCount.get(sliceKey) || 0) + 1
      );
    }
  }

  // Build UI-only sliced decks
  const result: DeckWithProgress[] = [];

  for (const s of sliceRows) {
    const sliceKey = `${s.deck_id}_${s.difficulty}`;
    const cefr = difficultyToCefr(s.difficulty);
    const iconName = resolveDeckIcon(s.theme, s.deck, s.subdeck);
    const queued = sliceQueuedCount.get(sliceKey) || 0;
    const mastered = sliceMasteredCount.get(sliceKey) || 0;

    const l = labels.get(s.deck_id);
    const themeName = l?.themeName || capitalizeTitle(s.theme);
    // Outside the theme list each subdeck is named with its parent deck.
    const name = l?.fullName || capitalizeTitle(s.subdeck || s.deck);

    result.push({
      id: `diff_${s.deck_id}_${s.difficulty}`,
      real_deck_id: s.deck_id,
      difficulty_slice: s.difficulty,
      theme_id: l?.themeKey || s.theme,
      theme_name: themeName,
      deck_key: l?.deckKey,
      deck_name: l?.deckName,
      subdeck_name: l?.subdeckName,
      has_subdecks: l?.hasSubdecks,
      full_name: name,
      name,
      description: '',
      difficulty_level: s.difficulty,
      difficulty_label: cefr,
      cefr_level: cefr,
      icon_name: iconName,
      card_count: s.card_count,
      queued_count: queued,
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
  deckIdOrSliceId: string | number,
  explicitDifficultySlice?: number
): { realDeckId: number; difficultySlice?: number } {
  const str = String(deckIdOrSliceId ?? '1');
  if (str.startsWith('diff_')) {
    const parts = str.split('_');
    const dId = parseInt(parts[1], 10);
    const diff = parseInt(parts[2], 10);
    return {
      realDeckId: dId,
      difficultySlice: explicitDifficultySlice !== undefined ? explicitDifficultySlice : diff,
    };
  }
  return {
    realDeckId: parseInt(str, 10) || 1,
    difficultySlice: explicitDifficultySlice,
  };
}

/**
 * Returns cards for a deck. If difficultySlice is present, filters strictly to that difficulty tier.
 */
/**
 * Returns cards for a deck. If difficultySlice is present, filters strictly to that difficulty tier.
 */
export async function getCardsByDeck(
  deckIdOrSliceId: string | number,
  targetLang = 'es',
  difficultySlice?: number,
  originLang?: string,
  limit = 100,
  offset = 0
): Promise<DeckCardDetail[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();

  const destLangName = resolveLanguageName(targetLang);
  const effectiveOrigin = originLang || (await getLanguagePairSettings()).origin_lang;
  const origLangName = resolveLanguageName(effectiveOrigin);

  const { realDeckId, difficultySlice: slice } = parseDeckIdentifier(
    deckIdOrSliceId,
    difficultySlice
  );

  let query = 'SELECT c.card_id, c.deck_id, c.primary_term, c.pos, c.cili_id, c.difficulty FROM cards c WHERE c.deck_id = ?';
  const params: any[] = [realDeckId];

  if (slice !== undefined) {
    query += ' AND c.difficulty = ?';
    params.push(slice);
  }

  query += ' ORDER BY c.card_id ASC LIMIT ? OFFSET ?;';
  params.push(limit, offset);

  const cardRows = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    primary_term: string;
    pos: string;
    cili_id: string;
    difficulty: number;
  }>(query, params);

  if (cardRows.length === 0) return [];

  const cardIds = cardRows.map((c) => c.card_id);
  const placeholders = cardIds.map(() => '?').join(',');

  // Fetch translations for both destination and origin
  const { destMap, origMap, defMap } = await loadCardTranslationsForPair(cardIds, destLangName, origLangName);

  // Fetch user card records for these card IDs
  const userCards = await userDb.getAllAsync<{
    id: string;
    card_id: number;
    stability: number;
    reps: number;
  }>(
    `SELECT id, card_id, stability, reps FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND card_id IN (${placeholders});`,
    [destLangName, targetLang, ...cardIds]
  );

  const userMap = new Map<number, { id: string; stability: number; reps: number }>();
  userCards.forEach((uc) =>
    userMap.set(uc.card_id, {
      id: uc.id,
      stability: uc.stability,
      reps: uc.reps,
    })
  );

  return cardRows.map((c) => {
    const uc = userMap.get(c.card_id);
    const frontTerm = destMap.get(c.card_id) || c.primary_term;
    const backTerm = origMap.get(c.card_id) || c.primary_term;
    const definition = defMap.get(c.card_id) || '';

    return {
      concept_id: c.cili_id || `c_${c.card_id}`,
      concept_desc: definition,
      front_lexeme_id: c.card_id,
      front_term: frontTerm,
      front_lang: targetLang,
      front_pos: c.pos || null,
      front_cefr: difficultyToCefr(c.difficulty),
      back_lexeme_id: c.card_id,
      back_term: backTerm,
      back_lang: effectiveOrigin,
      is_queued: !!uc,
      user_card_id: uc ? uc.id : undefined,
      stability: uc ? uc.stability : undefined,
      reps: uc ? uc.reps : undefined,
    };
  });
}

/**
 * Enqueues all unqueued cards in a deck (or difficulty slice) into User_Cards in user_vault.sqlite.
 */
export async function addEntireDeckToQueue(
  deckIdOrSliceId: string | number,
  targetLang = 'es',
  difficultySlice?: number,
  originLang?: string
): Promise<number> {
  const cards = await getCardsByDeck(deckIdOrSliceId, targetLang, difficultySlice, originLang);
  const unqueued = cards.filter((c) => !c.is_queued);
  if (unqueued.length === 0) return 0;

  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const origName = resolveLanguageName(originLang || (await getLanguagePairSettings()).origin_lang);
  const now = new Date().toISOString();

  await userDb.withTransactionAsync(async () => {
    for (const c of unqueued) {
      const cardIdStr = `card_${c.front_lexeme_id}_${langName}`;
      await userDb.runAsync(
        `INSERT OR REPLACE INTO User_Cards (
          id, card_id, target_lang, origin_lang, due_date, state, stability, difficulty,
          elapsed_days, scheduled_days, reps, lapses, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [cardIdStr, c.front_lexeme_id, langName, origName, now, 0, 0, 0, 0, 0, 0, 0, now]
      );
    }
  });

  return unqueued.length;
}

/**
 * Adds a single card to User_Cards queue.
 */
export async function addWordToQueue(
  frontLexemeId: number,
  _backLexemeId: number,
  _conceptId: string,
  targetLang = 'es',
  originLang?: string
): Promise<string> {
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const origName = resolveLanguageName(originLang || (await getLanguagePairSettings()).origin_lang);
  const now = new Date().toISOString();
  const cardIdStr = `card_${frontLexemeId}_${langName}`;

  await userDb.runAsync(
    `INSERT OR REPLACE INTO User_Cards (
      id, card_id, target_lang, origin_lang, due_date, state, stability, difficulty,
      elapsed_days, scheduled_days, reps, lapses, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [cardIdStr, frontLexemeId, langName, origName, now, 0, 0, 0, 0, 0, 0, 0, now]
  );

  return cardIdStr;
}

export async function addLexemeToQueue(
  frontLexemeId: number,
  targetLang = 'es',
  originLang?: string
): Promise<string | null> {
  return addWordToQueue(frontLexemeId, frontLexemeId, `c_${frontLexemeId}`, targetLang, originLang);
}

export async function removeWordFromQueue(cardId: string): Promise<void> {
  const userDb = await getUserDb();
  await userDb.runAsync('DELETE FROM User_Cards WHERE id = ?;', [cardId]);
}

/**
 * Returns cards currently due for spaced repetition review.
 */
export async function getDueCards(
  filterDeckId?: string | number,
  targetLang = 'es',
  originLang?: string,
  limit = 100
): Promise<CardWithDetails[]> {
  const userDb = await getUserDb();
  const staticDb = await getStaticDb();
  const effectiveOrigin = originLang || (await getLanguagePairSettings()).origin_lang;
  const now = new Date().toISOString();

  // Multi-Language Review Mode ('all')
  if (targetLang === 'all') {
    const userCards = await userDb.getAllAsync<{
      id: string;
      card_id: number;
      target_lang: string;
      origin_lang?: string;
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
      'SELECT id, card_id, target_lang, origin_lang, due_date, state, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at FROM User_Cards WHERE due_date <= ? ORDER BY due_date ASC LIMIT ?;',
      [now, limit]
    );

    if (userCards.length === 0) {
      return [];
    }

    const cardIds = Array.from(new Set(userCards.map((uc) => uc.card_id)));
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
    }>(
      `SELECT c.card_id, c.deck_id, c.primary_term, c.pos, c.definition, c.cili_id, c.difficulty
       FROM cards c
       WHERE c.card_id IN (${placeholders});`,
      cardIds
    );
    const staticMap = new Map<number, (typeof staticRows)[0]>();
    staticRows.forEach((r) => staticMap.set(r.card_id, r));

    // Group user cards by distinct pair
    const groups = new Map<string, typeof userCards>();
    for (const uc of userCards) {
      const pairKey = `${uc.target_lang}:${uc.origin_lang || effectiveOrigin}`;
      if (!groups.has(pairKey)) groups.set(pairKey, []);
      groups.get(pairKey)!.push(uc);
    }

    const result: CardWithDetails[] = [];

    for (const [key, cardsInGroup] of groups.entries()) {
      const [tLang, oLang] = key.split(':');
      const destLangName = resolveLanguageName(tLang);
      const origLangName = resolveLanguageName(oLang);
      const groupCardIds = Array.from(new Set(cardsInGroup.map((c) => c.card_id)));

      const { destMap, origMap, defMap } = await loadCardTranslationsForPair(groupCardIds, destLangName, origLangName);

      const destCandidateList = getCandidateLanguageNames(tLang);
      const origCandidateList = getCandidateLanguageNames(oLang);
      const isDestEnglish = destCandidateList.some((c) => c.toLowerCase() === 'english' || c.toLowerCase() === 'en');
      const isOrigEnglish = origCandidateList.some((c) => c.toLowerCase() === 'english' || c.toLowerCase() === 'en');

      for (const uc of cardsInGroup) {
        const sCard = staticMap.get(uc.card_id);
        if (!sCard) continue;

        if (filterRealDeckId !== undefined && sCard.deck_id !== filterRealDeckId) continue;
        if (filterSlice !== undefined && sCard.difficulty !== filterSlice) continue;

        const cefr = difficultyToCefr(sCard.difficulty);
        const frontTerm = destMap.get(sCard.card_id);
        const backTerm = origMap.get(sCard.card_id);

        if (!isDestEnglish && !frontTerm) continue;
        if (!isOrigEnglish && !backTerm) continue;

        const effectiveFront = frontTerm || sCard.primary_term;
        const effectiveBack = backTerm || sCard.primary_term;
        const definition = defMap.get(sCard.card_id) || sCard.definition || '';

        result.push({
          id: uc.id,
          card_id: uc.card_id,
          target_lang: uc.target_lang,
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
          front_term: effectiveFront,
          front_lang: uc.target_lang,
          front_pos: sCard.pos || null,
          front_cefr: cefr,
          back_term: effectiveBack,
          back_lang: uc.origin_lang || effectiveOrigin,
          back_pos: sCard.pos || null,
          back_cefr: cefr,
          concept_desc: definition,
        });
      }
    }

    result.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return result;
  }

  const langName = resolveLanguageName(targetLang);
  const origLangName = resolveLanguageName(effectiveOrigin);

  // 1. Get due user cards
  const userCards = await userDb.getAllAsync<{
    id: string;
    card_id: number;
    target_lang: string;
    origin_lang?: string;
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
    'SELECT id, card_id, target_lang, origin_lang, due_date, state, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND due_date <= ? ORDER BY due_date ASC LIMIT ?;',
    [langName, targetLang, now, limit]
  );

  if (userCards.length === 0) {
    if (!filterDeckId) {
      const totalEnrolled = await userDb.getFirstAsync<{ count: number }>(
        'SELECT count(*) as count FROM User_Cards WHERE target_lang IN (?, ?);',
        [langName, targetLang]
      );
      if (!totalEnrolled || totalEnrolled.count === 0) {
        // Auto-enqueue introductory cards (Deck 1: members) which has full translations in all 123 languages
        await addEntireDeckToQueue('1', targetLang, undefined, originLang);
        return getDueCards(undefined, targetLang, originLang);
      }
    }
    return [];
  }

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
  }>(
    `SELECT c.card_id, c.deck_id, c.primary_term, c.pos, c.definition, c.cili_id, c.difficulty
     FROM cards c
     WHERE c.card_id IN (${placeholders});`,
    cardIds
  );

  const { destMap, origMap, defMap } = await loadCardTranslationsForPair(cardIds, langName, origLangName);
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
    const destCandidateList = getCandidateLanguageNames(targetLang);
    const origCandidateList = getCandidateLanguageNames(effectiveOrigin);
    const isDestEnglish = destCandidateList.some((c) => c.toLowerCase() === 'english' || c.toLowerCase() === 'en');
    const isOrigEnglish = origCandidateList.some((c) => c.toLowerCase() === 'english' || c.toLowerCase() === 'en');

    const frontTerm = destMap.get(sCard.card_id);
    const backTerm = origMap.get(sCard.card_id);

    if (!isDestEnglish && !frontTerm) continue;
    if (!isOrigEnglish && !backTerm) continue;

    const effectiveFront = frontTerm || sCard.primary_term;
    const effectiveBack = backTerm || sCard.primary_term;
    const definition = defMap.get(sCard.card_id) || sCard.definition || '';

    result.push({
      id: uc.id,
      card_id: uc.card_id,
      target_lang: uc.target_lang,
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
      front_term: effectiveFront,
      front_lang: targetLang,
      front_pos: sCard.pos || null,
      front_cefr: cefr,
      back_term: effectiveBack,
      back_lang: effectiveOrigin,
      back_pos: sCard.pos || null,
      back_cefr: cefr,
      concept_desc: definition,
    });
  }

  return result;
}

/**
 * Returns cards for review in a specific deck (even if not strictly due, for practice mode).
 */
export async function getDeckCardsForReview(
  deckIdOrSliceId: string | number,
  targetLang = 'es',
  originLang?: string
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
      c.definition,
      c.cili_id,
      c.difficulty
    FROM cards c
    WHERE c.deck_id = ?
  `;
  const params: any[] = [realDeckId];

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
    `SELECT id, card_id, target_lang, origin_lang, due_date, state, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND card_id IN (${placeholders});`,
    [langName, targetLang, ...cardIds]
  );

  // If no user cards exist in this deck yet, auto-enqueue them so the user can immediately practice!
  if (userCards.length === 0) {
    await addEntireDeckToQueue(deckIdOrSliceId, targetLang, slice, originLang);
    return getDeckCardsForReview(deckIdOrSliceId, targetLang, originLang);
  }

  const staticMap = new Map<number, (typeof staticRows)[0]>();
  staticRows.forEach((r) => staticMap.set(r.card_id, r));

  const effectiveOrigin = originLang || (await getLanguagePairSettings()).origin_lang;
  const { destMap, origMap, defMap } = await loadCardTranslationsForPair(cardIds, targetLang, effectiveOrigin);

  const result: CardWithDetails[] = [];

  for (const uc of userCards) {
    const sCard = staticMap.get(uc.card_id);
    if (!sCard) continue;

    const cefr = difficultyToCefr(sCard.difficulty);
    const destCandidateList = getCandidateLanguageNames(targetLang);
    const origCandidateList = getCandidateLanguageNames(effectiveOrigin);
    const isDestEnglish = destCandidateList.some((c) => c.toLowerCase() === 'english' || c.toLowerCase() === 'en');
    const isOrigEnglish = origCandidateList.some((c) => c.toLowerCase() === 'english' || c.toLowerCase() === 'en');

    const frontTerm = destMap.get(sCard.card_id);
    const backTerm = origMap.get(sCard.card_id);

    if (!isDestEnglish && !frontTerm) continue;
    if (!isOrigEnglish && !backTerm) continue;

    const effectiveFront = frontTerm || sCard.primary_term;
    const effectiveBack = backTerm || sCard.primary_term;
    const definition = defMap.get(sCard.card_id) || sCard.definition || '';

    result.push({
      id: uc.id,
      card_id: uc.card_id,
      target_lang: uc.target_lang,
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
      front_term: effectiveFront,
      front_lang: targetLang,
      front_pos: sCard.pos || null,
      front_cefr: cefr,
      back_term: effectiveBack,
      back_lang: effectiveOrigin,
      back_pos: sCard.pos || null,
      back_cefr: cefr,
      concept_desc: definition,
    });
  }

  return result;
}

/**
 * Returns words for the Difficulty list view.
 */
export async function getWordsByDifficulty(
  cefr: string,
  targetLang = 'es',
  originLang?: string,
  limit = 100,
  offset = 0,
  titleLangPreference?: DeckTitleLanguageMode
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
      c.cili_id,
      c.difficulty,
      d.theme,
      d.deck
    FROM cards c
    JOIN decks d ON d.deck_id = c.deck_id
  `;
  const params: any[] = [];

  if (cefr !== 'ALL') {
    query += ' WHERE c.difficulty = ?';
    params.push(cefrToDifficulty(cefr));
  }

  query += ' ORDER BY c.difficulty ASC, c.card_id ASC LIMIT ? OFFSET ?;';
  params.push(limit, offset);

  const rows = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    primary_term: string;
    pos: string;
    cili_id: string;
    difficulty: number;
    theme: string;
    deck: string;
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
    `SELECT id, card_id, state, stability, reps, lapses, due_date FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND card_id IN (${placeholders});`,
    [langName, targetLang, ...cardIds]
  );

  const ucMap = new Map<number, (typeof userCards)[0]>();
  userCards.forEach((uc) => ucMap.set(uc.card_id, uc));

  const effectiveOrigin = originLang || (await getLanguagePairSettings()).origin_lang;
  const { destMap, origMap, defMap } = await loadCardTranslationsForPair(cardIds, targetLang, effectiveOrigin);

  const translationLang = await resolveTitleLanguage(targetLang, effectiveOrigin, titleLangPreference);
  const deckLabels = await getDeckLabels(translationLang);

  return rows.map((r) => {
    const uc = ucMap.get(r.card_id);
    const cefrLevel = difficultyToCefr(r.difficulty);
    const frontTerm = destMap.get(r.card_id) || r.primary_term;
    const backTerm = origMap.get(r.card_id) || r.primary_term;
    const definition = defMap.get(r.card_id) || '';

    const labels = deckLabels.get(r.deck_id);
    const deckName = labels?.fullName || capitalizeTitle(r.deck);
    const themeName = labels?.themeName || capitalizeTitle(r.theme);

    return {
      concept_id: r.cili_id || `c_${r.card_id}`,
      concept_desc: definition,
      front_lexeme_id: r.card_id,
      front_term: frontTerm,
      front_lang: targetLang,
      front_pos: r.pos || null,
      front_cefr: cefrLevel,
      back_lexeme_id: r.card_id,
      back_term: backTerm,
      back_lang: effectiveOrigin,
      deck_name: deckName,
      theme_name: themeName,
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

  // Queued cards per tier
  const queuedRows = await userDb.getAllAsync<{
    difficulty: number;
    count: number;
  }>(
    `SELECT difficulty, count(id) as count FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) GROUP BY difficulty;`,
    [langName, targetLang]
  );

  // Mastered cards (stability >= 21 or reps >= 3) per tier
  const masteredRows = await userDb.getAllAsync<{
    difficulty: number;
    count: number;
  }>(
    `SELECT difficulty, count(id) as count FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND (stability >= 21 OR reps >= 3) GROUP BY difficulty;`,
    [langName, targetLang]
  );

  const totalMap = new Map<number, number>();
  totalRows.forEach((r) => totalMap.set(r.difficulty, r.count));

  const queuedMap = new Map<number, number>();
  queuedRows.forEach((r) => queuedMap.set(r.difficulty, r.count));

  const masteredMap = new Map<number, number>();
  masteredRows.forEach((r) => masteredMap.set(r.difficulty, r.count));

  const tiers: { cefr: CEFRLevel; label: string; tier: number }[] = [
    { cefr: 'A1', label: 'Intern Bench', tier: 1 },
    { cefr: 'A2', label: 'Lab Assistant Station', tier: 2 },
    { cefr: 'B1', label: 'Technician Workshop', tier: 3 },
    { cefr: 'B2', label: 'Researcher Wing', tier: 4 },
    { cefr: 'C1', label: 'Scientist Institute', tier: 5 },
    { cefr: 'C2', label: 'Professor Observatory', tier: 6 },
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
  targetLang = 'es',
  originLang?: string
): Promise<number> {
  const words = await getWordsByDifficulty(cefr, targetLang, originLang);
  const unqueued = words.filter((w) => !w.is_queued);
  if (unqueued.length === 0) return 0;

  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const effectiveOrigin = originLang || (await getLanguagePairSettings()).origin_lang;
  const now = new Date().toISOString();

  await userDb.withTransactionAsync(async () => {
    for (const w of unqueued) {
      const cardIdStr = `card_${w.front_lexeme_id}_${langName}`;
      await userDb.runAsync(
        `INSERT OR REPLACE INTO User_Cards (
          id, card_id, target_lang, origin_lang, due_date, state, stability, difficulty,
          elapsed_days, scheduled_days, reps, lapses, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [cardIdStr, w.front_lexeme_id, langName, effectiveOrigin, now, 0, 0, 0, 0, 0, 0, 0, now]
      );
    }
  });

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
  }>('SELECT card_id, state, stability, reps, lapses, due_date FROM User_Cards WHERE (target_lang = ? OR target_lang = ?);', [langName, targetLang]);

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
  targetLang = 'es',
  originLang?: string,
  limit = 50,
  offset = 0,
  titleLangPreference?: DeckTitleLanguageMode
): Promise<MasteryWordItem[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const effectiveOrigin = originLang || (await getLanguagePairSettings()).origin_lang;
  const now = new Date().toISOString();
  const translationLang = await resolveTitleLanguage(targetLang, effectiveOrigin, titleLangPreference);

  if (stage === 'available') {
    // 1. Get all card IDs already queued for this language
    const queuedRows = await userDb.getAllAsync<{ card_id: number }>(
      'SELECT card_id FROM User_Cards WHERE target_lang IN (?, ?);',
      [langName, targetLang]
    );
    const queuedIds = queuedRows.map((r) => r.card_id);

    let query = `
      SELECT 
        c.card_id,
        c.deck_id,
        c.primary_term,
        c.pos,
        c.cili_id,
        c.difficulty,
        d.theme,
        d.deck
      FROM cards c
      JOIN decks d ON d.deck_id = c.deck_id
    `;
    const params: any[] = [];
    if (queuedIds.length > 0) {
      const placeholders = queuedIds.map(() => '?').join(',');
      query += ` WHERE c.card_id NOT IN (${placeholders})`;
      params.push(...queuedIds);
    }
    query += ' ORDER BY c.card_id ASC LIMIT ? OFFSET ?;';
    params.push(limit, offset);

    const availableCards = await staticDb.getAllAsync<{
      card_id: number;
      deck_id: number;
      primary_term: string;
      pos: string;
      cili_id: string;
      difficulty: number;
      theme: string;
      deck: string;
    }>(query, params);

    if (availableCards.length === 0) return [];

    const cardIds = availableCards.map((c) => c.card_id);
    const { destMap, origMap, defMap } = await loadCardTranslationsForPair(cardIds, targetLang, effectiveOrigin);
    const deckLabels = await getDeckLabels(translationLang);

    return availableCards.map((c) => {
      const frontTerm = destMap.get(c.card_id) || c.primary_term;
      const backTerm = origMap.get(c.card_id) || c.primary_term;
      const definition = defMap.get(c.card_id) || '';
      const labels = deckLabels.get(c.deck_id);
      const deckName = labels?.fullName || capitalizeTitle(c.deck);
      const themeName = labels?.themeName || capitalizeTitle(c.theme);

      return {
        concept_id: c.cili_id || `c_${c.card_id}`,
        concept_desc: definition,
        front_lexeme_id: c.card_id,
        front_term: frontTerm,
        front_lang: targetLang,
        front_pos: c.pos || null,
        front_cefr: difficultyToCefr(c.difficulty),
        back_lexeme_id: c.card_id,
        back_term: backTerm,
        back_lang: effectiveOrigin,
        deck_name: deckName,
        theme_name: themeName,
        is_queued: false,
        stage: 'available',
      };
    });
  }

  // Stages backed by User_Cards: 'new_in_queue' | 'learning' | 'slipping' | 'mastered'
  let stageCondition = '';
  const userParams: any[] = [langName, targetLang];

  if (stage === 'new_in_queue') {
    stageCondition = 'AND (reps = 0 OR state = 0)';
  } else if (stage === 'slipping') {
    stageCondition = 'AND (lapses > 0 AND due_date < ?)';
    userParams.push(now);
  } else if (stage === 'mastered') {
    stageCondition = 'AND (stability >= 21 OR reps >= 3)';
  } else if (stage === 'learning') {
    stageCondition = 'AND NOT (reps = 0 OR state = 0) AND NOT (stability >= 21 OR reps >= 3) AND NOT (lapses > 0 AND due_date < ?)';
    userParams.push(now);
  }

  userParams.push(limit, offset);

  const userCards = await userDb.getAllAsync<{
    id: string;
    card_id: number;
    state: number;
    stability: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    due_date: string;
  }>(
    `SELECT id, card_id, state, stability, scheduled_days, reps, lapses, due_date
     FROM User_Cards
     WHERE (target_lang = ? OR target_lang = ?)
       ${stageCondition}
     ORDER BY due_date ASC
     LIMIT ? OFFSET ?;`,
    userParams
  );

  if (userCards.length === 0) return [];

  const cardIds = userCards.map((uc) => uc.card_id);
  const placeholders = cardIds.map(() => '?').join(',');

  const cardMeta = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    primary_term: string;
    pos: string;
    cili_id: string;
    difficulty: number;
    theme: string;
    deck: string;
  }>(
    `SELECT 
      c.card_id,
      c.deck_id,
      c.primary_term,
      c.pos,
      c.cili_id,
      c.difficulty,
      d.theme,
      d.deck
    FROM cards c
    JOIN decks d ON d.deck_id = c.deck_id
    WHERE c.card_id IN (${placeholders});`,
    cardIds
  );

  const metaMap = new Map<number, (typeof cardMeta)[0]>();
  cardMeta.forEach((m) => metaMap.set(m.card_id, m));

  const { destMap, origMap, defMap } = await loadCardTranslationsForPair(cardIds, targetLang, effectiveOrigin);
  const deckLabels = await getDeckLabels(translationLang);

  return userCards.map((uc) => {
    const meta = metaMap.get(uc.card_id);
    const primaryTerm = meta?.primary_term || '';
    const frontTerm = destMap.get(uc.card_id) || primaryTerm;
    const backTerm = origMap.get(uc.card_id) || primaryTerm;
    const definition = defMap.get(uc.card_id) || '';
    const labels = meta ? deckLabels.get(meta.deck_id) : undefined;
    const deckName = labels?.fullName || (meta ? capitalizeTitle(meta.deck) : undefined);
    const themeName = labels?.themeName || (meta ? capitalizeTitle(meta.theme) : undefined);

    return {
      concept_id: meta?.cili_id || `c_${uc.card_id}`,
      concept_desc: definition,
      front_lexeme_id: uc.card_id,
      front_term: frontTerm,
      front_lang: targetLang,
      front_pos: meta?.pos || null,
      front_cefr: meta ? difficultyToCefr(meta.difficulty) : 'A1',
      back_lexeme_id: uc.card_id,
      back_term: backTerm,
      back_lang: effectiveOrigin,
      deck_name: deckName,
      theme_name: themeName,
      is_queued: true,
      user_card_id: uc.id,
      stage,
      stability: uc.stability,
      scheduled_days: uc.scheduled_days,
      reps: uc.reps,
      lapses: uc.lapses,
      due_date: uc.due_date,
      state: uc.state,
    };
  });
}

/**
 * Adds available (unqueued) words into User_Cards up to a limit.
 */
export async function addAvailableWordsToQueue(
  limit = 10,
  targetLang = 'es'
): Promise<number> {
  const available = await getMasteryWords('available', targetLang, undefined, limit, 0);
  if (available.length === 0) return 0;

  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const now = new Date().toISOString();

  await userDb.withTransactionAsync(async () => {
    for (const w of available) {
      const cardIdStr = `card_${w.front_lexeme_id}_${langName}`;
      await userDb.runAsync(
        `INSERT OR REPLACE INTO User_Cards (
          id, card_id, target_lang, due_date, state, stability, difficulty,
          elapsed_days, scheduled_days, reps, lapses, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [cardIdStr, w.front_lexeme_id, langName, now, 0, 0, 0, 0, 0, 0, 0, now]
      );
    }
  });

  return available.length;
}

/**
 * Fetches a random selection of unlearned cards (not present in User_Cards for targetLang)
 * across random decks and subdecks.
 */
export async function getRandomUnlearnedWords(
  limit = 10,
  targetLang = 'es',
  originLang?: string,
  titleLangPreference?: DeckTitleLanguageMode
): Promise<MasteryWordItem[]> {
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const langName = resolveLanguageName(targetLang);
  const effectiveOrigin = originLang || (await getLanguagePairSettings()).origin_lang;
  const translationLang = await resolveTitleLanguage(targetLang, effectiveOrigin, titleLangPreference);

  // 1. Get all card IDs already queued/learned for this language
  const queuedRows = await userDb.getAllAsync<{ card_id: number }>(
    'SELECT card_id FROM User_Cards WHERE target_lang IN (?, ?);',
    [langName, targetLang]
  );
  const queuedIds = queuedRows.map((r) => r.card_id);

  let query = `
    SELECT 
      c.card_id,
      c.deck_id,
      c.primary_term,
      c.pos,
      c.cili_id,
      c.difficulty,
      d.theme,
      d.deck
    FROM cards c
    JOIN decks d ON d.deck_id = c.deck_id
  `;
  const params: any[] = [];
  if (queuedIds.length > 0) {
    const placeholders = queuedIds.map(() => '?').join(',');
    query += ` WHERE c.card_id NOT IN (${placeholders})`;
    params.push(...queuedIds);
  }
  query += ' ORDER BY RANDOM() LIMIT ?;';
  params.push(limit);

  const randomCards = await staticDb.getAllAsync<{
    card_id: number;
    deck_id: number;
    primary_term: string;
    pos: string;
    cili_id: string;
    difficulty: number;
    theme: string;
    deck: string;
  }>(query, params);

  if (randomCards.length === 0) return [];

  const cardIds = randomCards.map((c) => c.card_id);
  const { destMap, origMap, defMap } = await loadCardTranslationsForPair(cardIds, targetLang, effectiveOrigin);
  const deckLabels = await getDeckLabels(translationLang);

  return randomCards.map((c) => {
    const frontTerm = destMap.get(c.card_id) || c.primary_term;
    const backTerm = origMap.get(c.card_id) || c.primary_term;
    const definition = defMap.get(c.card_id) || '';
    const labels = deckLabels.get(c.deck_id);
    const deckName = labels?.fullName || capitalizeTitle(c.deck);
    const themeName = labels?.themeName || capitalizeTitle(c.theme);

    return {
      concept_id: c.cili_id || `c_${c.card_id}`,
      concept_desc: definition,
      front_lexeme_id: c.card_id,
      front_term: frontTerm,
      front_lang: targetLang,
      front_pos: c.pos || null,
      front_cefr: difficultyToCefr(c.difficulty),
      back_lexeme_id: c.card_id,
      back_term: backTerm,
      back_lang: effectiveOrigin,
      deck_name: deckName,
      theme_name: themeName,
      is_queued: false,
      stage: 'available',
    };
  });
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

  // 1. Primary update by card unique string ID (e.g. 'card_1_Spanish')
  const updateRes = await userDb.runAsync(
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

  // 2. Fallback: If no rows updated, match by numeric card_id
  if (updateRes.changes === 0) {
    const numericId = parseInt(cardId.split('_')[1] || cardId.replace(/\D/g, '') || '0', 10);
    if (numericId > 0) {
      const fallbackRes = await userDb.runAsync(
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
        WHERE card_id = ?;`,
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
          numericId,
        ]
      );

      // 3. Fallback: If card was never enrolled, insert it with the updated FSRS metrics
      if (fallbackRes.changes === 0) {
        const activeSettings = await getLanguagePairSettings();
        const langName = resolveLanguageName(activeSettings.destination_lang);
        const origName = resolveLanguageName(activeSettings.origin_lang);
        const finalId = cardId.startsWith('card_') ? cardId : `card_${numericId}_${langName}`;
        await userDb.runAsync(
          `INSERT OR REPLACE INTO User_Cards (
            id, card_id, target_lang, origin_lang, due_date, state, stability, difficulty,
            elapsed_days, scheduled_days, reps, lapses, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            finalId,
            numericId,
            langName,
            origName,
            data.due_date,
            data.state,
            data.stability,
            data.difficulty,
            data.elapsed_days,
            data.scheduled_days,
            data.reps,
            data.lapses,
            now,
          ]
        );
      }
    }
  }
}

/**
 * Searches cards & translations in the static lexicon database.
 */
export async function searchLexicon(
  searchTerm: string,
  targetLang?: string
): Promise<(Lexeme & { concept_desc: string; concept_id: string })[]> {
  if (!searchTerm.trim()) return [];
  const staticDb = await getStaticDb();
  const userDb = await getUserDb();
  const activeLang = targetLang || (await getLanguagePairSettings()).destination_lang;
  const candidates = getCandidateLanguageNames(activeLang);
  const candPlaceholders = candidates.map(() => '?').join(',');
  const pattern = `%${searchTerm.trim()}%`;

  const rows = await staticDb.getAllAsync<{
    card_id: number;
    primary_term: string;
    pos: string;
    definition: string;
    cili_id: string;
    difficulty: number;
    translation: string | null;
  }>(
    `SELECT 
      c.card_id,
      c.primary_term,
      c.pos,
      c.definition,
      c.cili_id,
      c.difficulty,
      ct.translation as translation
    FROM cards c
    LEFT JOIN card_translations ct ON ct.card_id = c.card_id AND ct.lang_name IN (${candPlaceholders})
    WHERE c.primary_term LIKE ? OR ct.translation LIKE ? OR c.definition LIKE ?
    LIMIT 30;`,
    [...candidates, pattern, pattern, pattern]
  );

  // Also check Downloaded_Card_Translations
  const downloadedMatches = await userDb.getAllAsync<{
    card_id: number;
    translation: string;
  }>(
    `SELECT card_id, translation FROM Downloaded_Card_Translations WHERE lang_name IN (${candPlaceholders}) AND translation LIKE ? LIMIT 30;`,
    [...candidates, pattern]
  );

  const downloadedMap = new Map<number, string>();
  downloadedMatches.forEach((d) => downloadedMap.set(d.card_id, d.translation));

  const existingIds = new Set(rows.map((r) => r.card_id));
  const missingCardIds = downloadedMatches
    .map((d) => d.card_id)
    .filter((id) => !existingIds.has(id));

  if (missingCardIds.length > 0) {
    const placeholders = missingCardIds.map(() => '?').join(',');
    const extraRows = await staticDb.getAllAsync<{
      card_id: number;
      primary_term: string;
      pos: string;
      definition: string;
      cili_id: string;
      difficulty: number;
    }>(
      `SELECT card_id, primary_term, pos, definition, cili_id, difficulty FROM cards WHERE card_id IN (${placeholders});`,
      missingCardIds
    );
    extraRows.forEach((r) => {
      rows.push({
        ...r,
        translation: downloadedMap.get(r.card_id) || null,
      });
    });
  }

  return rows.slice(0, 30).map((r) => {
    const translation = downloadedMap.get(r.card_id) || r.translation || r.primary_term;
    return {
      id: r.card_id,
      language: activeLang,
      term: translation,
      pos: r.pos || null,
      cefr_level: difficultyToCefr(r.difficulty),
      frequency_rank: null,
      concept_desc: r.definition || '',
      concept_id: r.cili_id || `c_${r.card_id}`,
    };
  });
}

export const searchLexemesFTS = searchLexicon;

/**
 * Returns domains hierarchy for DomainBrowser.
 */
export async function getDomainsHierarchy(
  targetLang?: string,
  originLang?: string,
  titleLangPreference?: DeckTitleLanguageMode
): Promise<Domain[]> {
  const effectiveTarget = targetLang || (await getLanguagePairSettings()).destination_lang;
  const translationLang = await resolveTitleLanguage(effectiveTarget, originLang, titleLangPreference);
  const rows = await getDeckCatalog();
  const labels = await getDeckLabels(translationLang);

  const domains: Domain[] = [];
  const seenThemes = new Set<string>();
  for (const r of rows) {
    const l = labels.get(r.deck_id);
    if (!l || seenThemes.has(r.theme)) continue;
    seenThemes.add(r.theme);
    domains.push({
      id: `domain_${r.theme}`,
      parent_id: null,
      name: l.themeName,
      description: '',
      difficulty_level: 1,
      icon_name: resolveDeckIcon(r.theme),
      is_introductory: false,
    });
  }

  for (const r of rows) {
    domains.push({
      id: `sub_${r.deck_id}`,
      parent_id: `domain_${r.theme}`,
      name: labels.get(r.deck_id)?.fullName || capitalizeTitle(r.subdeck || r.deck),
      description: '',
      difficulty_level: r.difficulty,
      icon_name: resolveDeckIcon(r.theme, r.deck, r.subdeck),
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
    whereClauses.push('d.theme = ?');
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
 * Adds a single card to the queue for DomainBrowser or search.
 */
export async function addCardToQueue(
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
  try {
    const userDb = await getUserDb();
    let numericId = 1;
    if (typeof cardId === 'number') {
      numericId = cardId;
    } else if (typeof cardId === 'string') {
      const parts = cardId.split('_');
      if (parts.length > 1 && !isNaN(parseInt(parts[1], 10))) {
        numericId = parseInt(parts[1], 10);
      } else {
        const digits = cardId.replace(/\D/g, '');
        numericId = digits ? parseInt(digits, 10) : 1;
      }
    }
    const now = new Date().toISOString();

    await userDb.runAsync(
      'INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);',
      [numericId, rating, now]
    );
  } catch (err) {
    console.warn('[Vault] Notice during logReviewEvent:', err);
  }
}

/**
 * Records a card review attempt: updates FSRS state and writes review log in a single atomic SQLite transaction.
 */
export async function recordCardReview(
  cardId: string,
  fsrsData: {
    due_date: string;
    state: number;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
  },
  rating: number
): Promise<void> {
  const userDb = await getUserDb();
  await userDb.withTransactionAsync(async () => {
    await updateCardFSRS(cardId, fsrsData);
    await logReviewEvent(cardId, rating);
  });
}

/**
 * Seeds sample past review events into user_vault.sqlite Review_Logs so heatmap shows realistic streaks.
 */
export async function seedSampleReviewLogs(db: SQLite.SQLiteDatabase): Promise<void> {
  const now = new Date();
  const daysActive = [0, 1, 2, 4, 5, 7, 8, 9, 11, 14, 15, 18, 20, 22, 25, 28, 30, 35, 42];

  await db.withTransactionAsync(async () => {
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
  });
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
  const now = new Date().toISOString();

  let totalCards = 0;
  let dueCards = 0;
  let newCards = 0;
  let masteredCards = 0;

  if (targetLang === 'all') {
    const totalRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards;'
    );
    totalCards = totalRow?.count || 0;

    const dueRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE due_date <= ?;',
      [now]
    );
    dueCards = dueRow?.count || 0;

    const newRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE reps = 0 OR state = 0;'
    );
    newCards = newRow?.count || 0;

    const masteredRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE stability >= 21 OR reps >= 3;'
    );
    masteredCards = masteredRow?.count || 0;
  } else {
    const langName = resolveLanguageName(targetLang);

    const totalRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE (target_lang = ? OR target_lang = ?);',
      [langName, targetLang]
    );
    totalCards = totalRow?.count || 0;

    const dueRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND due_date <= ?;',
      [langName, targetLang, now]
    );
    dueCards = dueRow?.count || 0;

    const newRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND (reps = 0 OR state = 0);',
      [langName, targetLang]
    );
    newCards = newRow?.count || 0;

    const masteredRow = await userDb.getFirstAsync<{ count: number }>(
      'SELECT count(*) as count FROM User_Cards WHERE (target_lang = ? OR target_lang = ?) AND (stability >= 21 OR reps >= 3);',
      [langName, targetLang]
    );
    masteredCards = masteredRow?.count || 0;
  }

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

  return {
    totalCards,
    dueCards,
    newCards,
    masteredCards,
    streakDays,
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

export type DeckTitleLanguageMode = 'origin' | 'target';

/**
 * Returns the deck titles display language preference.
 * Defaults to 'origin' so beginner learners see deck categories and titles
 * in their native/origin language instead of the unfamiliar target language.
 */
export async function getDeckTitleLanguagePreference(): Promise<DeckTitleLanguageMode> {
  const val = await getSetting('deck_title_language');
  return val === 'target' ? 'target' : 'origin';
}

export async function setDeckTitleLanguagePreference(mode: DeckTitleLanguageMode): Promise<void> {
  await setSetting('deck_title_language', mode);
}

