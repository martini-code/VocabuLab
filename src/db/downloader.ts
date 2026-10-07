import {
  getStaticDb,
  getUserDb,
  resolveLanguageName,
  getDownloadedLanguages,
  getCandidateLanguageNames,
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
export async function downloadLanguagePack(codeOrName: string): Promise<LanguageDownloadResult> {
  const langName = resolveLanguageName(codeOrName);
  const langOpt = SUPPORTED_LANGUAGES.find(
    (l) =>
      l.name.toLowerCase() === langName.toLowerCase() ||
      l.code.toLowerCase() === codeOrName.toLowerCase()
  );
  const code = langOpt ? langOpt.code : codeOrName.toLowerCase();

  const userDb = await getUserDb();
  const staticDb = await getStaticDb();

  const candidates = getCandidateLanguageNames(codeOrName);
  const placeholders = candidates.map(() => '?').join(',');

  // Extract directly from staticDb card_translations & card_definitions via SQL using candidate matches
  const allTranslations = await staticDb.getAllAsync<{
    card_id: number;
    lang_name: string;
    translation: string;
    source: string;
    role: string;
  }>(
    `SELECT card_id, lang_name, translation, source, role FROM card_translations WHERE lang_name IN (${placeholders});`,
    candidates
  );

  const translationByCard = new Map<number, (typeof allTranslations)[0]>();
  for (const t of allTranslations) {
    if (!translationByCard.has(t.card_id) || t.lang_name.toLowerCase() === langName.toLowerCase()) {
      translationByCard.set(t.card_id, t);
    }
  }
  const translations = Array.from(translationByCard.values());

  const allDefinitions = await staticDb.getAllAsync<{
    card_id: number;
    lang_name: string;
    definition: string;
    source: string;
  }>(
    `SELECT card_id, lang_name, definition, source FROM card_definitions WHERE lang_name IN (${placeholders});`,
    candidates
  );

  const definitionByCard = new Map<number, (typeof allDefinitions)[0]>();
  for (const d of allDefinitions) {
    if (!definitionByCard.has(d.card_id) || d.lang_name.toLowerCase() === langName.toLowerCase()) {
      definitionByCard.set(d.card_id, d);
    }
  }
  const definitions = Array.from(definitionByCard.values());

  // Ingest into user_vault.sqlite isolated downloaded tables
  const now = new Date().toISOString();
  let approxBytes = 0;

  await userDb.withTransactionAsync(async () => {
    for (const t of translations) {
      approxBytes += (t.translation ? t.translation.length * 2 : 0) + 32;
      await userDb.runAsync(
        `INSERT OR REPLACE INTO Downloaded_Card_Translations (card_id, lang_name, translation, source, role)
         VALUES (?, ?, ?, ?, ?);`,
        [t.card_id, langName, t.translation, t.source || null, t.role || null]
      );
      if (t.lang_name.toLowerCase() !== langName.toLowerCase()) {
        await userDb.runAsync(
          `INSERT OR REPLACE INTO Downloaded_Card_Translations (card_id, lang_name, translation, source, role)
           VALUES (?, ?, ?, ?, ?);`,
          [t.card_id, t.lang_name, t.translation, t.source || null, t.role || null]
        );
      }
    }

    for (const d of definitions) {
      approxBytes += (d.definition ? d.definition.length * 2 : 0) + 32;
      await userDb.runAsync(
        `INSERT OR REPLACE INTO Downloaded_Card_Definitions (card_id, lang_name, definition, source)
         VALUES (?, ?, ?, ?);`,
        [d.card_id, langName, d.definition, d.source || null]
      );
      if (d.lang_name.toLowerCase() !== langName.toLowerCase()) {
        await userDb.runAsync(
          `INSERT OR REPLACE INTO Downloaded_Card_Definitions (card_id, lang_name, definition, source)
           VALUES (?, ?, ?, ?);`,
          [d.card_id, d.lang_name, d.definition, d.source || null]
        );
      }
    }
  });

  // Extract deck translations matching candidates
  try {
    const deckTranslations = await staticDb.getAllAsync<{
      deck_id: number;
      lang_name: string;
      category_translation: string;
      subcategory_translation: string;
      source: string;
    }>(
      `SELECT deck_id, lang_name, category_translation, subcategory_translation, source FROM deck_translations WHERE lang_name IN (${placeholders});`,
      candidates
    );

    await userDb.withTransactionAsync(async () => {
      for (const dt of deckTranslations) {
        approxBytes +=
          ((dt.category_translation || '').length + (dt.subcategory_translation || '').length) * 2 +
          32;
        await userDb.runAsync(
          `INSERT OR REPLACE INTO Downloaded_Deck_Translations (deck_id, lang_name, category_translation, subcategory_translation, source)
           VALUES (?, ?, ?, ?, ?);`,
          [
            dt.deck_id,
            langName,
            dt.category_translation,
            dt.subcategory_translation,
            dt.source || null,
          ]
        );
        if (dt.lang_name.toLowerCase() !== langName.toLowerCase()) {
          await userDb.runAsync(
            `INSERT OR REPLACE INTO Downloaded_Deck_Translations (deck_id, lang_name, category_translation, subcategory_translation, source)
             VALUES (?, ?, ?, ?, ?);`,
            [
              dt.deck_id,
              dt.lang_name,
              dt.category_translation,
              dt.subcategory_translation,
              dt.source || null,
            ]
          );
        }
      }
    });
  } catch (e) {
    console.warn('[Downloader] Notice extracting deck_translations:', e);
  }

  // Add baseline SQLite page size estimate
  const finalSizeBytes = Math.max(approxBytes, 16384);

  // Update Downloaded_Languages registry
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

  await userDb.runAsync('DELETE FROM Downloaded_Card_Translations WHERE lang_name = ?;', [
    langName,
  ]);
  await userDb.runAsync('DELETE FROM Downloaded_Card_Definitions WHERE lang_name = ?;', [langName]);
  await userDb.runAsync('DELETE FROM Downloaded_Deck_Translations WHERE lang_name = ?;', [
    langName,
  ]);
  await userDb.runAsync('DELETE FROM Downloaded_Languages WHERE lang_name = ? OR code = ?;', [
    langName,
    codeOrName,
  ]);

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
      pair = {
        origin_lang: deviceLangCode,
        destination_lang: deviceLangCode === 'en' ? 'es' : 'en',
      };
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

  // Check if origin and destination languages are downloaded and up to date
  const downloaded = await getDownloadedLanguages();
  const downloadedMap = new Map(downloaded.map((d) => [d.lang_name.toLowerCase(), d]));

  const originName = resolveLanguageName(pair.origin_lang);
  const destName = resolveLanguageName(pair.destination_lang);

  const originEntry = downloadedMap.get(originName.toLowerCase());
  if (!originEntry || originEntry.card_count < 90) {
    await downloadLanguagePack(pair.origin_lang);
  }

  const destEntry = downloadedMap.get(destName.toLowerCase());
  if (!destEntry || destEntry.card_count < 90) {
    await downloadLanguagePack(pair.destination_lang);
  }

  // Also ensure English is available
  const enEntry = downloadedMap.get('english');
  if (!enEntry || enEntry.card_count < 90) {
    await downloadLanguagePack('en');
  }

  return pair;
}
