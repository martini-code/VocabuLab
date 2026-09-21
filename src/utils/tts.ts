import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { resolveLanguageCode } from '../locales/languages';

// Audio session configuration state
let isAudioSessionConfigured = false;

/**
 * Checks if the native ExpoAudio module is compiled and available in the current native binary.
 * Prevents throwing "Cannot find native module 'ExpoAudio'" on simulators or Expo Go clients
 * that were built without expo-audio linked.
 */
export function hasNativeExpoAudio(): boolean {
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (typeof requireOptionalNativeModule === 'function') {
      return requireOptionalNativeModule('ExpoAudio') != null;
    }
  } catch {
    // Non-fatal if expo-modules-core is unavailable
  }
  return false;
}

/**
 * Pre-warms and configures the audio session so speech synthesis
 * can play aloud even if the hardware silent / mute switch is enabled on physical iPhones.
 */
export async function configureAudioSession(): Promise<void> {
  if (isAudioSessionConfigured) return;
  if (!hasNativeExpoAudio()) {
    return;
  }
  try {
    const { setAudioModeAsync } = require('expo-audio');
    if (typeof setAudioModeAsync === 'function') {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      });
      isAudioSessionConfigured = true;
    }
  } catch (err) {
    // Non-fatal if expo-audio native module is not available (e.g. headless tests or web)
    console.debug('[TTS] Audio session setup skipped/unavailable:', (err as Error).message);
  }
}

// Map of 2-letter ISO / short language codes to standard BCP-47 speech tags
export const LANGUAGE_CODE_MAP: Record<string, string> = {
  af: 'af-ZA',
  sq: 'sq-AL',
  am: 'am-ET',
  ar: 'ar-SA',
  hy: 'hy-AM',
  as: 'as-IN',
  ay: 'ay-BO',
  az: 'az-AZ',
  bm: 'bm-ML',
  eu: 'eu-ES',
  be: 'be-BY',
  bn: 'bn-BD',
  bho: 'bho-IN',
  bs: 'bs-BA',
  bg: 'bg-BG',
  my: 'my-MM',
  yue: 'yue-HK',
  ca: 'ca-ES',
  ceb: 'ceb-PH',
  ny: 'ny-MW',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-TW',
  hr: 'hr-HR',
  cs: 'cs-CZ',
  da: 'da-DK',
  nl: 'nl-NL',
  en: 'en-US',
  eo: 'eo',
  et: 'et-EE',
  ee: 'ee-GH',
  fi: 'fi-FI',
  fr: 'fr-FR',
  'fr-ca': 'fr-CA',
  gl: 'gl-ES',
  ka: 'ka-GE',
  de: 'de-DE',
  el: 'el-GR',
  gn: 'gn-PY',
  gu: 'gu-IN',
  ht: 'ht-HT',
  ha: 'ha-NG',
  haw: 'haw-US',
  he: 'he-IL',
  hi: 'hi-IN',
  hmn: 'hmn',
  hu: 'hu-HU',
  is: 'is-IS',
  ig: 'ig-NG',
  id: 'id-ID',
  ga: 'ga-IE',
  it: 'it-IT',
  ja: 'ja-JP',
  jv: 'jv-ID',
  kn: 'kn-IN',
  kk: 'kk-KZ',
  km: 'km-KH',
  rw: 'rw-RW',
  ko: 'ko-KR',
  ku: 'ku-TR',
  ckb: 'ckb-IQ',
  ky: 'ky-KG',
  lo: 'lo-LA',
  la: 'la',
  lv: 'lv-LV',
  ln: 'ln-CD',
  lt: 'lt-LT',
  lg: 'lg-UG',
  mk: 'mk-MK',
  mai: 'mai-IN',
  mg: 'mg-MG',
  ml: 'ml-IN',
  ms: 'ms-MY',
  mt: 'mt-MT',
  mr: 'mr-IN',
  mn: 'mn-MN',
  ne: 'ne-NP',
  nb: 'nb-NO',
  no: 'nb-NO',
  or: 'or-IN',
  om: 'om-ET',
  ps: 'ps-AF',
  fa: 'fa-IR',
  pl: 'pl-PL',
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-PT',
  pa: 'pa-IN',
  qu: 'qu-PE',
  ro: 'ro-RO',
  ru: 'ru-RU',
  sa: 'sa-IN',
  gd: 'gd-GB',
  sr: 'sr-RS',
  st: 'st-ZA',
  sn: 'sn-ZW',
  sd: 'sd-PK',
  si: 'si-LK',
  sk: 'sk-SK',
  sl: 'sl-SI',
  so: 'so-SO',
  es: 'es-ES',
  su: 'su-ID',
  sw: 'sw-KE',
  sv: 'sv-SE',
  tl: 'fil-PH',
  fil: 'fil-PH',
  tg: 'tg-TJ',
  ta: 'ta-IN',
  tt: 'tt-RU',
  te: 'te-IN',
  th: 'th-TH',
  ti: 'ti-ET',
  tn: 'tn-ZA',
  tr: 'tr-TR',
  tk: 'tk-TM',
  ak: 'ak-GH',
  uk: 'uk-UA',
  ur: 'ur-PK',
  ug: 'ug-CN',
  uz: 'uz-UZ',
  vi: 'vi-VN',
  cy: 'cy-GB',
  xh: 'xh-ZA',
  yi: 'yi',
  yo: 'yo-NG',
  zu: 'zu-ZA',
};

// Common language names mapped to BCP-47 codes
export const LANGUAGE_NAME_MAP: Record<string, string> = {
  english: 'en-US',
  spanish: 'es-ES',
  french: 'fr-FR',
  german: 'de-DE',
  japanese: 'ja-JP',
  italian: 'it-IT',
  portuguese: 'pt-BR',
  russian: 'ru-RU',
  korean: 'ko-KR',
  chinese: 'zh-CN',
  mandarin: 'zh-CN',
  cantonese: 'yue-HK',
  arabic: 'ar-SA',
  dutch: 'nl-NL',
  polish: 'pl-PL',
  turkish: 'tr-TR',
  swedish: 'sv-SE',
  ukrainian: 'uk-UA',
  vietnamese: 'vi-VN',
  greek: 'el-GR',
  czech: 'cs-CZ',
  danish: 'da-DK',
  finnish: 'fi-FI',
  hebrew: 'he-IL',
  hindi: 'hi-IN',
  hungarian: 'hu-HU',
  indonesian: 'id-ID',
  norwegian: 'nb-NO',
  romanian: 'ro-RO',
  slovak: 'sk-SK',
  thai: 'th-TH',
  catalan: 'ca-ES',
  bulgarian: 'bg-BG',
  croatian: 'hr-HR',
  malay: 'ms-MY',
  persian: 'fa-IR',
  farsi: 'fa-IR',
  tagalog: 'fil-PH',
  filipino: 'fil-PH',
  latin: 'la',
  latīna: 'la',
  basque: 'eu-ES',
  euskara: 'eu-ES',
  esperanto: 'eo',
  sanskrit: 'sa-IN',
  galician: 'gl-ES',
};

/**
 * Phonetic fallback mapping for languages that typically lack dedicated voices
 * in standard iOS / Android TTS distributions.
 * Without these fallbacks, OS synthesizers fall back to the default device locale (often English),
 * creating jarring, incorrect English accents for ancient or regional languages.
 */
export const PHONETIC_FALLBACK_MAP: Record<string, string[]> = {
  // Latin -> Italian (gold standard classical/ecclesiastical pronunciation) or Spanish
  la: ['it-IT', 'it', 'es-ES', 'es'],
  // Basque (Euskara) -> Spanish (matches Iberian 5-vowel system and phonetic articulation)
  eu: ['es-ES', 'es'],
  // Esperanto -> Italian, Spanish
  eo: ['it-IT', 'es-ES'],
  // Galician -> Portuguese, Spanish
  gl: ['pt-PT', 'es-ES', 'pt-BR'],
  // Sanskrit -> Hindi
  sa: ['hi-IN', 'hi'],
  // Yiddish -> German
  yi: ['de-DE', 'de'],
  // Haitian Creole -> French
  ht: ['fr-FR', 'fr'],
  // Belarusian -> Russian, Ukrainian
  be: ['ru-RU', 'uk-UA'],
  // Bosnian -> Croatian, Serbian
  bs: ['hr-HR', 'sr-RS'],
  // Aymara, Quechua, Guarani -> Spanish
  ay: ['es-ES', 'es'],
  qu: ['es-ES', 'es'],
  gn: ['es-ES', 'es'],
  // Bhojpuri, Maithili -> Hindi
  bho: ['hi-IN', 'hi'],
  mai: ['hi-IN', 'hi'],
  // Javanese, Sundanese -> Indonesian
  jv: ['id-ID', 'id'],
  su: ['id-ID', 'id'],
  // Cebuano -> Filipino / Tagalog
  ceb: ['fil-PH', 'tl'],
  // Malagasy -> French
  mg: ['fr-FR', 'fr'],
  // Scottish Gaelic -> Irish, English (UK)
  gd: ['ga-IE', 'en-GB'],
  // Tatar, Turkmen -> Russian, Turkish
  tt: ['ru-RU', 'tr-TR'],
  tk: ['tr-TR', 'ru-RU'],
  // Tajik -> Persian, Russian
  tg: ['fa-IR', 'ru-RU'],
  // Kurdish -> Turkish, Persian
  ku: ['tr-TR', 'fa-IR'],
  ckb: ['ar-SA', 'fa-IR'],
  // Bambara, Lingala -> French
  bm: ['fr-FR', 'fr'],
  ln: ['fr-FR', 'fr'],
  // Ewe, Twi -> English (UK)
  ee: ['en-GB', 'en'],
  ak: ['en-GB', 'en'],
};

/**
 * Returns the best phonetic fallback language code if the requested language
 * is known to lack native TTS voices on consumer devices.
 */
export function getPhoneticFallbackLanguage(langTag: string): string {
  if (!langTag) return 'en-US';
  const clean = langTag.toLowerCase().trim();
  const base = clean.split(/[-_]/)[0];
  const fallbacks = PHONETIC_FALLBACK_MAP[base] || PHONETIC_FALLBACK_MAP[clean];
  if (fallbacks && fallbacks.length > 0) {
    return fallbacks[0];
  }
  return langTag;
}

/**
 * Normalizes input language names or ISO codes into standard BCP-47 tags
 * recognized by native speech synthesizers (iOS AVSpeechSynthesisVoice & Android TTS).
 */
export function normalizeLanguageCode(lang: string = 'en'): string {
  if (!lang || typeof lang !== 'string' || lang.trim().length === 0) return 'en-US';
  const trimmed = lang.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check full language names map
  if (LANGUAGE_NAME_MAP[lower]) {
    return LANGUAGE_NAME_MAP[lower];
  }

  // 2. Check code map
  if (LANGUAGE_CODE_MAP[lower]) {
    return LANGUAGE_CODE_MAP[lower];
  }

  // 3. Normalize existing hyphenated tags (e.g. pt-br -> pt-BR, es-mx -> es-MX)
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 2) {
      return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
    }
  }

  // 4. Resolve canonical code using full 123-language registry
  const canonical = resolveLanguageCode(trimmed);
  const canonicalLower = canonical.toLowerCase();
  if (LANGUAGE_CODE_MAP[canonicalLower]) {
    return LANGUAGE_CODE_MAP[canonicalLower];
  }

  return lower;
}


// In-memory voices cache
let cachedVoices: Speech.Voice[] | null = null;
let isFetchingVoices = false;

/**
 * Retrieves available device voices, caching the result to minimize native bridge traffic.
 */
export async function getVoices(): Promise<Speech.Voice[]> {
  if (cachedVoices && cachedVoices.length > 0) return cachedVoices;
  if (isFetchingVoices) return cachedVoices || [];
  try {
    isFetchingVoices = true;
    const voices = await Speech.getAvailableVoicesAsync();
    cachedVoices = voices || [];
    return cachedVoices;
  } catch {
    return [];
  } finally {
    isFetchingVoices = false;
  }
}

/**
 * Finds the most suitable voice available on the device for a target language tag.
 * If no native voice exists for the target language (e.g. Latin or Basque on iOS),
 * it searches installed voices using a phonetically compatible fallback language
 * (e.g. Italian for Latin, Spanish for Basque).
 */
export async function findBestVoice(langTag: string): Promise<Speech.Voice | undefined> {
  const voices = await getVoices();
  if (!voices || voices.length === 0) return undefined;

  const target = langTag.toLowerCase();
  const targetPrefix = target.split('-')[0];

  // 1. Exact match on target language code
  const exact = voices.find((v) => v.language && v.language.toLowerCase() === target);
  if (exact) return exact;

  // 2. Prefix match on target language family (e.g., es matches es-ES or es-MX)
  const prefixMatch = voices.find(
    (v) => v.language && v.language.toLowerCase().startsWith(`${targetPrefix}-`)
  );
  if (prefixMatch) return prefixMatch;

  // 3. Fallback to any voice containing the target language prefix
  const partialMatch = voices.find(
    (v) => v.language && v.language.toLowerCase().includes(targetPrefix)
  );
  if (partialMatch) return partialMatch;

  // 4. Phonetic fallback for languages without native voices (e.g. Latin -> Italian, Basque -> Spanish)
  const fallbacks = PHONETIC_FALLBACK_MAP[targetPrefix] || PHONETIC_FALLBACK_MAP[target];
  if (fallbacks && fallbacks.length > 0) {
    for (const fbTag of fallbacks) {
      const fbLower = fbTag.toLowerCase();
      const fbPrefix = fbLower.split('-')[0];

      const fbExact = voices.find((v) => v.language && v.language.toLowerCase() === fbLower);
      if (fbExact) return fbExact;

      const fbPrefixMatch = voices.find(
        (v) => v.language && v.language.toLowerCase().startsWith(`${fbPrefix}-`)
      );
      if (fbPrefixMatch) return fbPrefixMatch;

      const fbPartial = voices.find(
        (v) => v.language && v.language.toLowerCase().includes(fbPrefix)
      );
      if (fbPartial) return fbPartial;
    }
  }

  return undefined;
}

// In-memory buffer/URI cache for network or pre-synthesized TTS requests
const audioBufferCache = new Map<string, string>();

// Throttle tracking
let lastSpokenText = '';
let lastSpokenTime = 0;
const MIN_SPEAK_INTERVAL_MS = 300; // minimum ms between triggering speech for same or different terms

/**
 * Pronounces a term using native speech synthesis.
 * Throttles rapid button taps, activates silent mode playback on physical iOS devices,
 * and matches installed native voices or appropriate phonetic fallbacks.
 */
export async function speakWord(text: string, langCode: string = 'es'): Promise<void> {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return;
  }

  const cleanText = text.trim();
  const now = Date.now();

  // Throttle: ignore rapid duplicate taps within minimum interval
  if (cleanText === lastSpokenText && now - lastSpokenTime < MIN_SPEAK_INTERVAL_MS) {
    return;
  }

  // Prevent overlapping invocation storms
  if (now - lastSpokenTime < 120) {
    return;
  }

  lastSpokenText = cleanText;
  lastSpokenTime = now;

  try {
    // 1. Ensure audio session is initialized for playback even in silent mode
    await configureAudioSession();

    // 2. Only interrupt if currently speaking to avoid race condition on idle synthesizers
    const isSpeaking = await Speech.isSpeakingAsync().catch(() => false);
    if (isSpeaking) {
      try {
        await Speech.stop();
        // Give native audio engine a short buffer to clear previous buffer
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch {
        // Ignore stop error
      }
    }

    const voiceLang = normalizeLanguageCode(langCode);
    const cacheKey = `${voiceLang}:${cleanText}`;

    // Mark cache availability
    if (!audioBufferCache.has(cacheKey)) {
      audioBufferCache.set(cacheKey, cleanText);
    }

    // 3. Find matching voice on device (including phonetic fallback if no native voice installed)
    const matchedVoice = await findBestVoice(voiceLang);

    // Determine effective speech language:
    // If a matched voice is found on the device, use its specific language;
    // otherwise, use phonetic fallback language (e.g. it-IT for Latin, es-ES for Basque)
    // so iOS/Android does NOT default to system English!
    const effectiveLanguage = matchedVoice?.language || getPhoneticFallbackLanguage(voiceLang);

    // 4. Synthesize new utterance cleanly
    const options: Speech.SpeechOptions = {
      language: effectiveLanguage,
      rate: 0.88,
      pitch: 1.05,
      volume: 1.0,
      onError: (error) => {
        console.warn(`[TTS] Native playback error for "${cleanText}" (${effectiveLanguage}):`, error);
        // Fallback without specific voice identifier if customized voice failed
        if (matchedVoice) {
          Speech.speak(cleanText, {
            language: effectiveLanguage.split('-')[0] || 'en',
            rate: 0.88,
            pitch: 1.0,
            volume: 1.0,
          });
        }
      },
    };

    if (matchedVoice?.identifier) {
      options.voice = matchedVoice.identifier;
    }

    if (Platform.OS === 'ios' && isAudioSessionConfigured) {
      options.useApplicationAudioSession = true;
    }

    Speech.speak(cleanText, options);
  } catch (error) {
    console.warn('[TTS] Speech engine notice:', (error as Error).message);
  }
}


/**
 * Stops any ongoing audio narration immediately.
 */
export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // Ignore error
  }
}

/**
 * Cache utilities for pre-synthesized / network audio buffers.
 */
export const ttsAudioCache = {
  get: (lang: string, text: string): string | undefined => {
    return audioBufferCache.get(`${lang.toLowerCase().trim()}:${text.trim()}`);
  },
  set: (lang: string, text: string, audioDataOrUri: string): void => {
    audioBufferCache.set(`${lang.toLowerCase().trim()}:${text.trim()}`, audioDataOrUri);
  },
  has: (lang: string, text: string): boolean => {
    return audioBufferCache.has(`${lang.toLowerCase().trim()}:${text.trim()}`);
  },
  clear: (): void => {
    audioBufferCache.clear();
  },
  /** Reset cached voices (e.g. for testing) */
  _resetVoiceCache: (): void => {
    cachedVoices = null;
  },
  /** Reset audio session configuration state (e.g. for testing) */
  _resetAudioSessionConfigured: (): void => {
    isAudioSessionConfigured = false;
  },
  /** Reset debounce/throttle timers (e.g. for testing) */
  _resetThrottle: (): void => {
    lastSpokenText = '';
    lastSpokenTime = 0;
  },
};
