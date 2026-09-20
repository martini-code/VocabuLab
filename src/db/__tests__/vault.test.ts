/**
 * vault.test.ts
 *
 * Comprehensive unit tests for vault.ts.
 *
 * Strategy:
 *  1. Pure function tests  – imported directly, no mocks needed.
 *  2. Async function tests – expo-sqlite mocked at the module level;
 *     mockDb is a shared object so mock state is reset with jest.clearAllMocks()
 *     between tests.
 *
 * better-sqlite3 is NOT available in this project, so all DB-layer tests
 * use the expo-sqlite mock pattern.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mocks – must be declared before any import that touches the mocked modules
// ─────────────────────────────────────────────────────────────────────────────

const mockGetFirstAsync = jest.fn();
const mockRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockGetAllAsync = jest.fn();
const mockExecAsync = jest.fn().mockResolvedValue(undefined);
const mockWithTransactionAsync = jest.fn().mockImplementation((fn: () => Promise<void>) => fn());

const mockDb = {
  getFirstAsync: mockGetFirstAsync,
  getAllAsync: mockGetAllAsync,
  runAsync: mockRunAsync,
  execAsync: mockExecAsync,
  withTransactionAsync: mockWithTransactionAsync,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockImplementation(async () => mockDb),
  importDatabaseFromAssetAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../schema', () => ({ USER_SCHEMA_SQL: '' }));

jest.mock('../../locales/languages', () => {
  const actual = jest.requireActual('../../locales/languages');
  return {
    ...actual,
    SUPPORTED_LANGUAGES: [
      { code: 'en',    name: 'English',                  nativeName: 'English', flag: '🇬🇧' },
      { code: 'es',    name: 'Spanish',                  nativeName: 'Español', flag: '🇪🇸' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)',       nativeName: 'Português (Brasil)', flag: '🇧🇷' },
      { code: 'zh',    name: 'Chinese (Simplified)',      nativeName: '中文 (简体)', flag: '🇨🇳' },
      { code: 'fr',    name: 'French',                   nativeName: 'Français', flag: '🇫🇷' },
      { code: 'fr-CA', name: 'French (Canada)',           nativeName: 'Français (Canada)', flag: '🇨🇦' },
      { code: 'no',    name: 'Norwegian (Bokmål)',        nativeName: 'Norsk (Bokmål)', flag: '🇳🇴' },
      { code: 'ku',    name: 'Kurdish (Kurmanji)',        nativeName: 'Kurmancî', flag: '🇮🇶' },
      { code: 'ckb',   name: 'Kurdish (Sorani)',          nativeName: 'کوردی سۆرانی', flag: '🇮🇶' },
      { code: 'ar',    name: 'Arabic',                   nativeName: 'العربية', flag: '🇸🇦' },
      { code: 'de',    name: 'German',                   nativeName: 'Deutsch', flag: '🇩🇪' },
      { code: 'it',    name: 'Italian',                  nativeName: 'Italiano', flag: '🇮🇹' },
      { code: 'ja',    name: 'Japanese',                 nativeName: '日本語', flag: '🇯🇵' },
      { code: 'ko',    name: 'Korean',                   nativeName: '한국어', flag: '🇰🇷' },
      { code: 'pt-PT', name: 'Portuguese (Portugal)',     nativeName: 'Português (Portugal)', flag: '🇵🇹' },
      { code: 'zh-TW', name: 'Chinese (Traditional)',    nativeName: '中文 (繁體)', flag: '🇹🇼' },
    ],
  };
});

jest.mock('../../locales', () => ({
  getDeviceLanguage: jest.fn().mockReturnValue('en'),
}));

// Asset require used inside getStaticDb – stub so Jest does not choke
jest.mock('../../../assets/lexicon_v1.0.0.db', () => 1, { virtual: true });

// ─────────────────────────────────────────────────────────────────────────────
// Imports (after mocks)
// ─────────────────────────────────────────────────────────────────────────────

import {
  resolveLanguageName,
  getCandidateLanguageNames,
  difficultyToCefr,
  cefrToDifficulty,
  capitalizeTitle,
  getLanguagePairSettings,
  setLanguagePairSettings,
  getDownloadedLanguages,
  logReviewEvent,
  updateCardFSRS,
  getDeckTitleLanguagePreference,
  setDeckTitleLanguagePreference,
} from '../vault';

// ─────────────────────────────────────────────────────────────────────────────
// 1. resolveLanguageName
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveLanguageName', () => {
  it('resolves "es" → Spanish', () => {
    expect(resolveLanguageName('es')).toBe('Spanish');
  });

  it('resolves "en" → English', () => {
    expect(resolveLanguageName('en')).toBe('English');
  });

  it('resolves "pt" → Portuguese (Brazil) (base alias)', () => {
    expect(resolveLanguageName('pt')).toBe('Portuguese (Brazil)');
  });

  it('resolves "pt-br" → Portuguese (Brazil)', () => {
    expect(resolveLanguageName('pt-br')).toBe('Portuguese (Brazil)');
  });

  it('resolves "zh" → Chinese (Simplified)', () => {
    expect(resolveLanguageName('zh')).toBe('Chinese (Simplified)');
  });

  it('resolves "zh-hans" → Chinese (Simplified)', () => {
    expect(resolveLanguageName('zh-hans')).toBe('Chinese (Simplified)');
  });

  it('resolves "no" → Norwegian (Bokmål)', () => {
    expect(resolveLanguageName('no')).toBe('Norwegian (Bokmål)');
  });

  it('resolves "nb" → Norwegian (Bokmål)', () => {
    expect(resolveLanguageName('nb')).toBe('Norwegian (Bokmål)');
  });

  it('resolves "ku" → Kurdish (Kurmanji)', () => {
    expect(resolveLanguageName('ku')).toBe('Kurdish (Kurmanji)');
  });

  it('resolves "ckb" → Kurdish (Sorani)', () => {
    expect(resolveLanguageName('ckb')).toBe('Kurdish (Sorani)');
  });

  it('resolves "arabic" full alias → Arabic', () => {
    expect(resolveLanguageName('arabic')).toBe('Arabic');
  });

  it('returns "Spanish" for empty string (fallback)', () => {
    expect(resolveLanguageName('')).toBe('Spanish');
  });

  it('capitalizes unknown codes (best-effort)', () => {
    expect(resolveLanguageName('xyz')).toBe('Xyz');
  });

  it('resolves "spanish" (full name alias) → Spanish', () => {
    expect(resolveLanguageName('spanish')).toBe('Spanish');
  });

  it('resolves "English" (exact name) → English', () => {
    expect(resolveLanguageName('English')).toBe('English');
  });

  it('is case-insensitive for known codes', () => {
    expect(resolveLanguageName('ES')).toBe('Spanish');
    expect(resolveLanguageName('EN')).toBe('English');
  });

  it('resolves "de" → German', () => {
    expect(resolveLanguageName('de')).toBe('German');
  });

  it('resolves "fr-ca" → French (Canada)', () => {
    expect(resolveLanguageName('fr-ca')).toBe('French (Canada)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. getCandidateLanguageNames
// ─────────────────────────────────────────────────────────────────────────────

describe('getCandidateLanguageNames', () => {
  it('includes "Spanish" and "es" for "es"', () => {
    const candidates = getCandidateLanguageNames('es');
    expect(candidates).toContain('Spanish');
    expect(candidates).toContain('es');
  });

  it('includes both Portuguese variants for "pt"', () => {
    const candidates = getCandidateLanguageNames('pt');
    expect(candidates).toContain('Portuguese (Brazil)');
    expect(candidates).toContain('Portuguese (Portugal)');
  });

  it('includes both Portuguese variants for "pt-BR"', () => {
    const candidates = getCandidateLanguageNames('pt-BR');
    expect(candidates).toContain('Portuguese (Brazil)');
    expect(candidates).toContain('Portuguese (Portugal)');
  });

  it('includes both Chinese variants for "zh"', () => {
    const candidates = getCandidateLanguageNames('zh');
    expect(candidates).toContain('Chinese (Simplified)');
    expect(candidates).toContain('Chinese (Traditional)');
  });

  it('includes French and French (Canada) for "fr"', () => {
    const candidates = getCandidateLanguageNames('fr');
    expect(candidates).toContain('French');
    expect(candidates).toContain('French (Canada)');
  });

  it('includes Norwegian (Bokmål) for "no"', () => {
    const candidates = getCandidateLanguageNames('no');
    expect(candidates).toContain('Norwegian (Bokmål)');
    expect(candidates).toContain('Norwegian');
  });

  it('includes English and "en" for "en"', () => {
    const candidates = getCandidateLanguageNames('en');
    expect(candidates).toContain('English');
    expect(candidates).toContain('en');
  });

  it('includes Arabic and "ar" for "ar"', () => {
    const candidates = getCandidateLanguageNames('ar');
    expect(candidates).toContain('Arabic');
    expect(candidates).toContain('ar');
  });

  it('returns default ["Spanish", "es"] for empty string', () => {
    expect(getCandidateLanguageNames('')).toEqual(['Spanish', 'es']);
  });

  it('includes both Kurdish variants for "ku"', () => {
    const candidates = getCandidateLanguageNames('ku');
    expect(candidates).toContain('Kurdish (Kurmanji)');
    expect(candidates).toContain('Kurdish (Sorani)');
  });

  it('returns an array without duplicates (Set-backed)', () => {
    const candidates = getCandidateLanguageNames('es');
    const unique = new Set(candidates);
    expect(unique.size).toBe(candidates.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. difficultyToCefr
// ─────────────────────────────────────────────────────────────────────────────

describe('difficultyToCefr', () => {
  it.each<[number, string]>([
    [1, 'A1'],
    [2, 'A2'],
    [3, 'B1'],
    [4, 'B2'],
    [5, 'C1'],
    [6, 'C2'],
  ])('maps %i → %s', (difficulty, expected) => {
    expect(difficultyToCefr(difficulty)).toBe(expected);
  });

  it('falls back to A1 for 0', () => {
    expect(difficultyToCefr(0)).toBe('A1');
  });

  it('falls back to A1 for negative values', () => {
    expect(difficultyToCefr(-1)).toBe('A1');
  });

  it('falls back to A1 for values above 6', () => {
    expect(difficultyToCefr(99)).toBe('A1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. cefrToDifficulty
// ─────────────────────────────────────────────────────────────────────────────

describe('cefrToDifficulty', () => {
  it.each<[string, number]>([
    ['A1', 1],
    ['A2', 2],
    ['B1', 3],
    ['B2', 4],
    ['C1', 5],
    ['C2', 6],
  ])('maps %s → %i', (cefr, expected) => {
    expect(cefrToDifficulty(cefr)).toBe(expected);
  });

  it('is case-insensitive: "a1" → 1', () => {
    expect(cefrToDifficulty('a1')).toBe(1);
  });

  it('is case-insensitive: "c2" → 6', () => {
    expect(cefrToDifficulty('c2')).toBe(6);
  });

  it('falls back to 1 for unknown CEFR strings', () => {
    expect(cefrToDifficulty('UNKNOWN')).toBe(1);
  });

  it('falls back to 1 for empty string', () => {
    expect(cefrToDifficulty('')).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. capitalizeTitle
// ─────────────────────────────────────────────────────────────────────────────

describe('capitalizeTitle', () => {
  it('capitalizes the first letter of each word', () => {
    expect(capitalizeTitle('hello world')).toBe('Hello World');
  });

  it('handles parenthesized words: (hello) → (Hello)', () => {
    expect(capitalizeTitle('french (canada)')).toBe('French (Canada)');
  });

  it('returns empty string for empty input', () => {
    expect(capitalizeTitle('')).toBe('');
  });

  it('handles a single word', () => {
    expect(capitalizeTitle('spanish')).toBe('Spanish');
  });

  it('does not lower-case already-capitalized words', () => {
    expect(capitalizeTitle('Spanish')).toBe('Spanish');
  });

  it('capitalizes all words in a multi-word phrase', () => {
    expect(capitalizeTitle('the quick brown fox')).toBe('The Quick Brown Fox');
  });

  it('handles parenthesized word at start of phrase', () => {
    expect(capitalizeTitle('(brazil) portuguese')).toBe('(Brazil) Portuguese');
  });

  it('preserves mixed case after first char', () => {
    expect(capitalizeTitle('hEllo wOrld')).toBe('HEllo WOrld');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. getLanguagePairSettings
// ─────────────────────────────────────────────────────────────────────────────

describe('getLanguagePairSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    mockExecAsync.mockResolvedValue(undefined);
  });

  it('returns device-language-derived fallback when Settings row is absent', async () => {
    mockGetFirstAsync.mockResolvedValueOnce(null);
    const pair = await getLanguagePairSettings();
    // getDeviceLanguage() mocked to return 'en' → destination_lang becomes 'es'
    expect(pair).toEqual({ origin_lang: 'en', destination_lang: 'es' });
  });

  it('parses stored JSON from Settings table when row exists', async () => {
    const stored = { origin_lang: 'fr', destination_lang: 'es' };
    mockGetFirstAsync.mockResolvedValueOnce({ value: JSON.stringify(stored) });
    const pair = await getLanguagePairSettings();
    expect(pair).toEqual(stored);
  });

  it('falls back to default when stored JSON is malformed', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ value: 'not-valid-json{{{' });
    const pair = await getLanguagePairSettings();
    expect(pair).toEqual({ origin_lang: 'en', destination_lang: 'es' });
  });

  it('queries the Settings table with the correct key', async () => {
    mockGetFirstAsync.mockResolvedValueOnce(null);
    await getLanguagePairSettings();
    expect(mockGetFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("key = 'language_pair'")
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. setLanguagePairSettings
// ─────────────────────────────────────────────────────────────────────────────

describe('setLanguagePairSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    mockExecAsync.mockResolvedValue(undefined);
  });

  it('calls runAsync with INSERT OR REPLACE into Settings', async () => {
    const pair = { origin_lang: 'de', destination_lang: 'en' };
    await setLanguagePairSettings(pair);
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE'),
      expect.arrayContaining([JSON.stringify(pair)])
    );
  });

  it('serializes the pair as JSON as the first parameter', async () => {
    const pair = { origin_lang: 'ja', destination_lang: 'ko' };
    await setLanguagePairSettings(pair);
    const [, params] = mockRunAsync.mock.calls[0];
    expect(params[0]).toBe(JSON.stringify(pair));
  });

  it('includes an ISO timestamp string as the second parameter', async () => {
    const pair = { origin_lang: 'en', destination_lang: 'es' };
    await setLanguagePairSettings(pair);
    const [, params] = mockRunAsync.mock.calls[0];
    expect(typeof params[1]).toBe('string');
    expect(() => new Date(params[1])).not.toThrow();
    expect(new Date(params[1]).getFullYear()).toBeGreaterThanOrEqual(2024);
  });

  it('writes to the Settings table', async () => {
    const pair = { origin_lang: 'fr', destination_lang: 'es' };
    await setLanguagePairSettings(pair);
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('Settings'),
      expect.any(Array)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. getDownloadedLanguages
// ─────────────────────────────────────────────────────────────────────────────

describe('getDownloadedLanguages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    mockExecAsync.mockResolvedValue(undefined);
  });

  it('calls getAllAsync querying Downloaded_Languages', async () => {
    mockGetAllAsync.mockResolvedValueOnce([]);
    await getDownloadedLanguages();
    expect(mockGetAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('Downloaded_Languages')
    );
  });

  it('returns an empty array when no languages are downloaded', async () => {
    mockGetAllAsync.mockResolvedValueOnce([]);
    const result = await getDownloadedLanguages();
    expect(result).toEqual([]);
  });

  it('returns rows from getAllAsync as-is', async () => {
    const langs = [
      {
        code: 'es',
        lang_name: 'Spanish',
        downloaded_at: '2024-01-01T00:00:00.000Z',
        card_count: 100,
        size_bytes: 25000,
      },
    ];
    mockGetAllAsync.mockResolvedValueOnce(langs);
    const result = await getDownloadedLanguages();
    expect(result).toEqual(langs);
  });

  it('returns multiple downloaded languages', async () => {
    const langs = [
      { code: 'de', lang_name: 'German',  downloaded_at: '2024-02-01T00:00:00.000Z', card_count: 200, size_bytes: 50000 },
      { code: 'es', lang_name: 'Spanish', downloaded_at: '2024-01-01T00:00:00.000Z', card_count: 100, size_bytes: 25000 },
      { code: 'fr', lang_name: 'French',  downloaded_at: '2024-03-01T00:00:00.000Z', card_count: 150, size_bytes: 37500 },
    ];
    mockGetAllAsync.mockResolvedValueOnce(langs);
    const result = await getDownloadedLanguages();
    expect(result).toHaveLength(3);
    expect(result).toEqual(langs);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. logReviewEvent
// ─────────────────────────────────────────────────────────────────────────────

describe('logReviewEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    mockExecAsync.mockResolvedValue(undefined);
  });

  it('inserts into Review_Logs when given a numeric card id', async () => {
    await logReviewEvent(42, 3);
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('Review_Logs'),
      expect.arrayContaining([42, 3])
    );
  });

  it('extracts numeric id from string format "card_7_Spanish"', async () => {
    await logReviewEvent('card_7_Spanish', 2);
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('Review_Logs'),
      expect.arrayContaining([7, 2])
    );
  });

  it('extracts digits from arbitrary string ids like "review99"', async () => {
    await logReviewEvent('review99', 1);
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('Review_Logs'),
      expect.arrayContaining([99, 1])
    );
  });

  it('defaults to card_id=1 for non-numeric string ids', async () => {
    await logReviewEvent('abc', 4);
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('Review_Logs'),
      expect.arrayContaining([1, 4])
    );
  });

  it('includes a timestamp string as the third parameter', async () => {
    await logReviewEvent(5, 3);
    const [, params] = mockRunAsync.mock.calls[0];
    expect(typeof params[2]).toBe('string');
    expect(new Date(params[2]).getFullYear()).toBeGreaterThanOrEqual(2024);
  });

  it('does not throw when runAsync rejects (error swallowed internally)', async () => {
    mockRunAsync.mockRejectedValueOnce(new Error('DB error'));
    await expect(logReviewEvent(1, 3)).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. updateCardFSRS
// ─────────────────────────────────────────────────────────────────────────────

describe('updateCardFSRS', () => {
  const fsrsData = {
    due_date: '2025-01-01T00:00:00.000Z',
    state: 2,
    stability: 5.5,
    difficulty: 3.0,
    elapsed_days: 3,
    scheduled_days: 7,
    reps: 4,
    lapses: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecAsync.mockResolvedValue(undefined);
    mockWithTransactionAsync.mockImplementation((fn: () => Promise<void>) => fn());
  });

  it('calls runAsync with UPDATE User_Cards WHERE id = ? on first try', async () => {
    mockRunAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 0 });
    await updateCardFSRS('card_1_Spanish', fsrsData);
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE User_Cards'),
      expect.arrayContaining(['card_1_Spanish'])
    );
  });

  it('passes all FSRS fields in the update parameters', async () => {
    mockRunAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 0 });
    await updateCardFSRS('card_1_Spanish', fsrsData);
    const [, params] = mockRunAsync.mock.calls[0];
    expect(params).toContain(fsrsData.due_date);
    expect(params).toContain(fsrsData.state);
    expect(params).toContain(fsrsData.stability);
    expect(params).toContain(fsrsData.difficulty);
    expect(params).toContain(fsrsData.elapsed_days);
    expect(params).toContain(fsrsData.scheduled_days);
    expect(params).toContain(fsrsData.reps);
    expect(params).toContain(fsrsData.lapses);
  });

  it('falls back to numeric card_id UPDATE when string-id UPDATE finds 0 rows', async () => {
    // UPDATE by string id → 0 changes
    mockRunAsync.mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });
    // UPDATE by numeric card_id → 1 change
    mockRunAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 0 });

    await updateCardFSRS('card_99_Spanish', fsrsData);

    expect(mockRunAsync).toHaveBeenCalledTimes(2);
    const [secondSql, secondParams] = mockRunAsync.mock.calls[1];
    expect(secondSql).toContain('UPDATE User_Cards');
    expect(secondParams).toContain(99);
  });

  it('inserts a new card when both UPDATE paths find 0 rows', async () => {
    // String-id UPDATE → 0 changes
    mockRunAsync.mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });
    // Numeric-id UPDATE → 0 changes
    mockRunAsync.mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });
    // getLanguagePairSettings inner call
    mockGetFirstAsync.mockResolvedValueOnce(null);
    // INSERT
    mockRunAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 1 });

    await updateCardFSRS('card_5_Spanish', fsrsData);

    // Three runAsync calls total: UPDATE by id, UPDATE by numeric card_id, INSERT
    expect(mockRunAsync).toHaveBeenCalledTimes(3);
    const [insertSql] = mockRunAsync.mock.calls[2];
    expect(insertSql).toContain('INSERT OR REPLACE INTO User_Cards');
  });

  it('does NOT call the fallback when the first UPDATE changes a row', async () => {
    mockRunAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 0 });
    await updateCardFSRS('card_1_Spanish', fsrsData);
    // Only one runAsync call (the primary UPDATE)
    expect(mockRunAsync).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. getDeckTitleLanguagePreference & setDeckTitleLanguagePreference
// ─────────────────────────────────────────────────────────────────────────────

describe('getDeckTitleLanguagePreference and setDeckTitleLanguagePreference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to "origin" when no preference is stored in Settings table', async () => {
    mockGetFirstAsync.mockResolvedValueOnce(null);

    const pref = await getDeckTitleLanguagePreference();
    expect(pref).toBe('origin');
    expect(mockGetFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('SELECT value FROM Settings WHERE key = ?;'),
      ['deck_title_language']
    );
  });

  it('returns "target" when preference is explicitly set to "target"', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ value: 'target' });

    const pref = await getDeckTitleLanguagePreference();
    expect(pref).toBe('target');
  });

  it('returns "origin" when preference is stored as "origin"', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ value: 'origin' });

    const pref = await getDeckTitleLanguagePreference();
    expect(pref).toBe('origin');
  });

  it('sets preference to "target" by running INSERT OR REPLACE INTO Settings', async () => {
    mockRunAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 1 });

    await setDeckTitleLanguagePreference('target');
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES (?, ?, ?);'),
      expect.arrayContaining(['deck_title_language', 'target'])
    );
  });

  it('sets preference to "origin" by running INSERT OR REPLACE INTO Settings', async () => {
    mockRunAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 1 });

    await setDeckTitleLanguagePreference('origin');
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES (?, ?, ?);'),
      expect.arrayContaining(['deck_title_language', 'origin'])
    );
  });
});

