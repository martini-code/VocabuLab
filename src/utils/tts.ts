import * as Speech from 'expo-speech';

const LANGUAGE_CODE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  ja: 'ja-JP',
  it: 'it-IT',
};

/**
 * Pronounces a term using native offline speech synthesis.
 */
export async function speakWord(text: string, langCode: string = 'es'): Promise<void> {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return;
  }

  const cleanText = text.trim();

  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }

    const normalizedLang = (langCode || 'en').toLowerCase().trim();
    const voiceLang = LANGUAGE_CODE_MAP[normalizedLang] || normalizedLang;

    Speech.speak(cleanText, {
      language: voiceLang,
      rate: 0.88,
      pitch: 1.05,
    });
  } catch (error) {
    console.warn('[TTS] Offline speech engine notice:', (error as Error).message);
  }
}

/**
 * Stops any ongoing audio narration.
 */
export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch (error) {
    // Ignore error
  }
}
