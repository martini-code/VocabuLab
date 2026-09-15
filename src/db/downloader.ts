import {
  getStaticDb,
  getUserDb,
  resolveLanguageName,
  getDownloadedLanguages,
} from './vault';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE_CODE } from '../locales/languages';
import { DownloadedLanguage, LanguagePairSettings } from '../types';

export interface LanguageDownloadResult {
  success: boolean;
  language: DownloadedLanguage;
  source: 'local_extract';
  message: string;
}

/**
 * Confirms local bundled database.
 */
export async function syncDatabaseFromR2(): Promise<void> {
  // Master lexicon database is bundled locally as SQLite.
}

/**
 * Extracts a language pack directly from the static lexicon database into user_vault.sqlite.
 * Keeps user data completely isolated in separate tables without intermediate files or JSONs.
 */
export async function downloadLanguagePack(
  codeOrName: string
): Promise<LanguageDownloadResult> {
  const langName = resolveLanguageName(codeOrName);
  const langOpt = SUPPORTED_LANGUAGES.find(
    (l) => l.name.toLowerCase() === langName.toLowerCase() || l.code.toLowerCase() === codeOrName.toLowerCase()
  );
  const code = langOpt ? langOpt.code : codeOrName.toLowerCase();

  const userDb = await getUserDb();
  const staticDb = await getStaticDb();

  // Extract directly from staticDb card_translations & card_definitions via SQL
  const translations = await staticDb.getAllAsync<{
    card_id: number;
    lang_name: string;
    translation: string;
    source: string;
    role: string;
  }>(
    'SELECT card_id, lang_name, translation, source, role FROM card_translations WHERE lang_name = ?;',
    [langName]
  );

  const definitions = await staticDb.getAllAsync<{
    card_id: number;
    lang_name: string;
    definition: string;
    source: string;
  }>(
    'SELECT card_id, lang_name, definition, source FROM card_definitions WHERE lang_name = ?;',
    [langName]
  );

  // 3. Ingest into user_vault.sqlite isolated downloaded tables
  const now = new Date().toISOString();
  let approxBytes = 0;

  for (const t of translations) {
    approxBytes += (t.translation ? t.translation.length * 2 : 0) + 32;
    await userDb.runAsync(
      `INSERT OR REPLACE INTO Downloaded_Card_Translations (card_id, lang_name, translation, source, role)
       VALUES (?, ?, ?, ?, ?);`,
      [t.card_id, langName, t.translation, t.source || null, t.role || null]
    );
  }

  for (const d of definitions) {
    approxBytes += (d.definition ? d.definition.length * 2 : 0) + 32;
    await userDb.runAsync(
      `INSERT OR REPLACE INTO Downloaded_Card_Definitions (card_id, lang_name, definition, source)
       VALUES (?, ?, ?, ?);`,
      [d.card_id, langName, d.definition, d.source || null]
    );
  }

  // Add baseline SQLite page size estimate
  const finalSizeBytes = Math.max(approxBytes, 16384);

  // 4. Update Downloaded_Languages registry
  await userDb.runAsync(
    `INSERT OR REPLACE INTO Downloaded_Languages (code, lang_name, downloaded_at, card_count, size_bytes)
     VALUES (?, ?, ?, ?, ?);`,
    [code, langName, now, translations.length, finalSizeBytes]
  );

  const downloadedLang: DownloadedLanguage = {
    code,
    lang_name: langName,
    downloaded_at: now,
    card_count: translations.length,
    size_bytes: finalSizeBytes,
  };

  return {
    success: true,
    language: downloadedLang,
    source: 'local_extract',
    message: `Installed ${langName} (${translations.length} cards, ~${Math.round(finalSizeBytes / 1024)} KB).`,
  };
}

/**
 * Removes a downloaded language pack from user_vault.sqlite and frees disk space.
 */
export async function deleteLanguagePack(codeOrName: string): Promise<void> {
  const langName = resolveLanguageName(codeOrName);
  const userDb = await getUserDb();

  await userDb.runAsync('DELETE FROM Downloaded_Card_Translations WHERE lang_name = ?;', [langName]);
  await userDb.runAsync('DELETE FROM Downloaded_Card_Definitions WHERE lang_name = ?;', [langName]);
  await userDb.runAsync('DELETE FROM Downloaded_Languages WHERE lang_name = ? OR code = ?;', [langName, codeOrName]);

  // Reclaim disk space
  try {
    await userDb.execAsync('VACUUM;');
  } catch (e) {
    console.warn('[Downloader] Notice during database vacuum:', e);
  }
}

/**
 * Ensures the user's default language pair is installed on first launch.
 */
export async function ensureDefaultLanguagePairInstalled(
  deviceLangCode: string = 'en'
): Promise<LanguagePairSettings> {
  const userDb = await getUserDb();

  // Check existing language pair setting
  const settingRow = await userDb.getFirstAsync<{ value: string }>(
    "SELECT value FROM Settings WHERE key = 'language_pair';"
  );

  let pair: LanguagePairSettings;

  if (settingRow) {
    try {
      pair = JSON.parse(settingRow.value);
    } catch {
      pair = { origin_lang: deviceLangCode, destination_lang: deviceLangCode === 'en' ? 'es' : 'en' };
    }
  } else {
    const origin = deviceLangCode.toLowerCase();
    const destination = origin === 'en' ? 'es' : 'en';
    pair = { origin_lang: origin, destination_lang: destination };

    await userDb.runAsync(
      "INSERT OR REPLACE INTO Settings (key, value, updated_at) VALUES ('language_pair', ?, ?);",
      [JSON.stringify(pair), new Date().toISOString()]
    );
  }

  // Check if origin and destination languages are downloaded
  const downloaded = await getDownloadedLanguages();
  const downloadedNames = new Set(downloaded.map((d) => d.lang_name.toLowerCase()));

  const originName = resolveLanguageName(pair.origin_lang);
  const destName = resolveLanguageName(pair.destination_lang);

  if (!downloadedNames.has(originName.toLowerCase())) {
    await downloadLanguagePack(pair.origin_lang);
  }

  if (!downloadedNames.has(destName.toLowerCase())) {
    await downloadLanguagePack(pair.destination_lang);
  }

  // Also ensure English is available
  if (!downloadedNames.has('english')) {
    await downloadLanguagePack('en');
  }

  return pair;
}
