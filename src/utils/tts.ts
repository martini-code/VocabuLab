import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

// Audio session configuration state
let isAudioSessionConfigured = false;

/**
 * Pre-warms and configures the audio session so speech synthesis
 * can play aloud even if the hardware silent / mute switch is enabled on physical iPhones.
 */
export async function configureAudioSession(): Promise<void> {
  if (isAudioSessionConfigured) return;
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
const LANGUAGE_CODE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  ja: 'ja-JP',
  it: 'it-IT',
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-PT',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-TW',
  ru: 'ru-RU',
  ko: 'ko-KR',
  ar: 'ar-SA',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  sv: 'sv-SE',
  uk: 'uk-UA',
  vi: 'vi-VN',
  el: 'el-GR',
  cs: 'cs-CZ',
  da: 'da-DK',
  fi: 'fi-FI',
  he: 'he-IL',
  hi: 'hi-IN',
  hu: 'hu-HU',
  id: 'id-ID',
  nb: 'nb-NO',
  no: 'nb-NO',
  ro: 'ro-RO',
  sk: 'sk-SK',
  th: 'th-TH',
  ca: 'ca-ES',
  bg: 'bg-BG',
  hr: 'hr-HR',
  ms: 'ms-MY',
  fa: 'fa-IR',
  ur: 'ur-PK',
  bn: 'bn-BD',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  af: 'af-ZA',
  sq: 'sq-AL',
  am: 'am-ET',
  hy: 'hy-AM',
  az: 'az-AZ',
  eu: 'eu-ES',
  be: 'be-BY',
  bs: 'bs-BA',
  ka: 'ka-GE',
  is: 'is-IS',
  ga: 'ga-IE',
  lv: 'lv-LV',
  lt: 'lt-LT',
  mk: 'mk-MK',
  mt: 'mt-MT',
  sr: 'sr-RS',
  sl: 'sl-SI',
  sw: 'sw-KE',
  tl: 'fil-PH',
  fil: 'fil-PH',
};

// Common language names mapped to BCP-47 codes
const LANGUAGE_NAME_MAP: Record<string, string> = {
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
};

/**
 * Normalizes input language names or ISO codes into standard BCP-47 tags
 * recognized by native speech synthesizers (iOS AVSpeechSynthesisVoice & Android TTS).
 */
export function normalizeLanguageCode(lang: string = 'en'): string {
  if (!lang || typeof lang !== 'string' || lang.trim().length === 0) return 'en-US';
  const trimmed = lang.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check full language names
  if (LANGUAGE_NAME_MAP[lower]) {
    return LANGUAGE_NAME_MAP[lower];
  }

  // 2. Check code map
  if (LANGUAGE_CODE_MAP[lower]) {
    return LANGUAGE_CODE_MAP[lower];
  }

  // 3. Normalize existing hyphenated tags (e.g. pt-br -> pt-BR)
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 2) {
      return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
    }
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
 */
export async function findBestVoice(langTag: string): Promise<Speech.Voice | undefined> {
  const voices = await getVoices();
  if (!voices || voices.length === 0) return undefined;

  const target = langTag.toLowerCase();
  const targetPrefix = target.split('-')[0];

  // 1. Exact match on language code
  const exact = voices.find((v) => v.language && v.language.toLowerCase() === target);
  if (exact) return exact;

  // 2. Prefix match on language family (e.g., es matches es-ES or es-MX)
  const prefixMatch = voices.find(
    (v) => v.language && v.language.toLowerCase().startsWith(`${targetPrefix}-`)
  );
  if (prefixMatch) return prefixMatch;

  // 3. Fallback to any voice with the language prefix
  return voices.find(
    (v) => v.language && v.language.toLowerCase().includes(targetPrefix)
  );
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
 * and matches installed native voices.
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

    // 3. Find matching voice on device
    const matchedVoice = await findBestVoice(voiceLang);

    // 4. Synthesize new utterance cleanly
    const options: Speech.SpeechOptions = {
      language: matchedVoice?.language || voiceLang,
      rate: 0.88,
      pitch: 1.05,
      volume: 1.0,
      onError: (error) => {
        console.warn(`[TTS] Native playback error for "${cleanText}" (${voiceLang}):`, error);
        // Fallback without specific voice identifier if customized voice failed
        if (matchedVoice) {
          Speech.speak(cleanText, {
            language: voiceLang.split('-')[0] || 'en',
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

    if (Platform.OS === 'ios') {
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
  /** Reset debounce/throttle timers (e.g. for testing) */
  _resetThrottle: (): void => {
    lastSpokenText = '';
    lastSpokenTime = 0;
  },
};
