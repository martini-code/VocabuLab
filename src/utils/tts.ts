import * as Speech from 'expo-speech';

const LANGUAGE_CODE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  ja: 'ja-JP',
  it: 'it-IT',
};

// In-memory buffer/URI cache for network or pre-synthesized TTS requests
const audioBufferCache = new Map<string, string>();

// Throttle tracking
let lastSpokenText = '';
let lastSpokenTime = 0;
const MIN_SPEAK_INTERVAL_MS = 300; // minimum ms between triggering speech for same or different terms

// Queue & active speech tracking
let isCancelling = false;

/**
 * Pronounces a term using native speech synthesis.
 * Throttles rapid button taps and cancels any currently playing speech before initiating a new utterance.
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
    // 1. Immediately cancel any currently playing or scheduled speech
    isCancelling = true;
    try {
      await Speech.stop();
    } catch {
      // Ignore stop error if engine is idle
    } finally {
      isCancelling = false;
    }

    const normalizedLang = (langCode || 'en').toLowerCase().trim();
    const voiceLang = LANGUAGE_CODE_MAP[normalizedLang] || normalizedLang;
    const cacheKey = `${voiceLang}:${cleanText}`;

    // Mark cache availability
    if (!audioBufferCache.has(cacheKey)) {
      audioBufferCache.set(cacheKey, cleanText);
    }

    // 2. Synthesize new utterance cleanly
    Speech.speak(cleanText, {
      language: voiceLang,
      rate: 0.88,
      pitch: 1.05,
    });
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
};
