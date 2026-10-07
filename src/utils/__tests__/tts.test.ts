import * as Speech from 'expo-speech';
import {
  speakWord,
  stopSpeech,
  normalizeLanguageCode,
  findBestVoice,
  configureAudioSession,
  ttsAudioCache,
  getVoices,
} from '../tts';

// Mock expo-modules-core
const mockRequireOptionalNativeModule = jest.fn().mockReturnValue({});
jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: (...args: any[]) => mockRequireOptionalNativeModule(...args),
}));

// Mock expo-speech
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  isSpeakingAsync: jest.fn().mockResolvedValue(false),
  getAvailableVoicesAsync: jest.fn().mockResolvedValue([]),
}));

// Mock expo-audio
const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-audio', () => ({
  setAudioModeAsync: (...args: any[]) => mockSetAudioModeAsync(...args),
}));

describe('TTS Utility Unit & Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOptionalNativeModule.mockReturnValue({});
    ttsAudioCache.clear();
    ttsAudioCache._resetVoiceCache();
    ttsAudioCache._resetThrottle();
    ttsAudioCache._resetAudioSessionConfigured();
  });

  describe('normalizeLanguageCode', () => {
    it('normalizes common ISO language codes to regional BCP-47 tags', () => {
      expect(normalizeLanguageCode('es')).toBe('es-ES');
      expect(normalizeLanguageCode('en')).toBe('en-US');
      expect(normalizeLanguageCode('fr')).toBe('fr-FR');
      expect(normalizeLanguageCode('de')).toBe('de-DE');
      expect(normalizeLanguageCode('ja')).toBe('ja-JP');
      expect(normalizeLanguageCode('pt')).toBe('pt-BR');
      expect(normalizeLanguageCode('zh')).toBe('zh-CN');
      expect(normalizeLanguageCode('ru')).toBe('ru-RU');
      expect(normalizeLanguageCode('ko')).toBe('ko-KR');
      expect(normalizeLanguageCode('it')).toBe('it-IT');
    });

    it('normalizes language names in english to standard BCP-47 tags', () => {
      expect(normalizeLanguageCode('Spanish')).toBe('es-ES');
      expect(normalizeLanguageCode('english')).toBe('en-US');
      expect(normalizeLanguageCode('French')).toBe('fr-FR');
      expect(normalizeLanguageCode('German')).toBe('de-DE');
      expect(normalizeLanguageCode('JAPANESE')).toBe('ja-JP');
      expect(normalizeLanguageCode('Portuguese')).toBe('pt-BR');
      expect(normalizeLanguageCode('Chinese')).toBe('zh-CN');
      expect(normalizeLanguageCode('Latin')).toBe('la');
      expect(normalizeLanguageCode('latīna')).toBe('la');
      expect(normalizeLanguageCode('Basque')).toBe('eu-ES');
      expect(normalizeLanguageCode('Euskara')).toBe('eu-ES');
      expect(normalizeLanguageCode('la')).toBe('la');
      expect(normalizeLanguageCode('eu')).toBe('eu-ES');
    });

    it('normalizes casing on hyphenated codes', () => {
      expect(normalizeLanguageCode('pt-br')).toBe('pt-BR');
      expect(normalizeLanguageCode('zh-tw')).toBe('zh-TW');
      expect(normalizeLanguageCode('es-mx')).toBe('es-MX');
    });

    it('falls back safely for undefined, null, or empty string', () => {
      expect(normalizeLanguageCode(undefined as any)).toBe('en-US');
      expect(normalizeLanguageCode('')).toBe('en-US');
      expect(normalizeLanguageCode('   ')).toBe('en-US');
    });
  });

  describe('configureAudioSession', () => {
    it('calls setAudioModeAsync with playsInSilentMode: true when native module is available', async () => {
      mockRequireOptionalNativeModule.mockReturnValue({});
      await configureAudioSession();
      expect(mockSetAudioModeAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: 'mixWithOthers',
        })
      );
    });

    it('skips setAudioModeAsync safely when native ExpoAudio module is missing (e.g. simulator without rebuild)', async () => {
      mockRequireOptionalNativeModule.mockReturnValue(null);
      await configureAudioSession();
      expect(mockSetAudioModeAsync).not.toHaveBeenCalled();
    });
  });

  describe('findBestVoice', () => {
    it('finds exact matching voice by language tag', async () => {
      (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([
        {
          identifier: 'com.apple.voice.es-ES.monica',
          language: 'es-ES',
          name: 'Monica',
          quality: 'Default',
        },
        {
          identifier: 'com.apple.voice.en-US.samantha',
          language: 'en-US',
          name: 'Samantha',
          quality: 'Default',
        },
      ]);

      const voice = await findBestVoice('es-ES');
      expect(voice).toBeDefined();
      expect(voice?.identifier).toBe('com.apple.voice.es-ES.monica');
    });

    it('falls back to prefix match when exact match is missing', async () => {
      (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([
        {
          identifier: 'com.apple.voice.es-MX.paulani',
          language: 'es-MX',
          name: 'Paulina',
          quality: 'Default',
        },
        {
          identifier: 'com.apple.voice.en-US.samantha',
          language: 'en-US',
          name: 'Samantha',
          quality: 'Default',
        },
      ]);

      const voice = await findBestVoice('es-ES');
      expect(voice).toBeDefined();
      expect(voice?.identifier).toBe('com.apple.voice.es-MX.paulani');
    });

    it('returns undefined if no voices are available', async () => {
      (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([]);
      const voice = await findBestVoice('ja-JP');
      expect(voice).toBeUndefined();
    });

    it('falls back to Italian voice for Latin (la) when no native Latin voice exists', async () => {
      (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([
        {
          identifier: 'com.apple.voice.en-US.samantha',
          language: 'en-US',
          name: 'Samantha',
          quality: 'Default',
        },
        {
          identifier: 'com.apple.voice.it-IT.alice',
          language: 'it-IT',
          name: 'Alice',
          quality: 'Default',
        },
      ]);

      const voice = await findBestVoice('la');
      expect(voice).toBeDefined();
      expect(voice?.identifier).toBe('com.apple.voice.it-IT.alice');
      expect(voice?.language).toBe('it-IT');
    });

    it('falls back to Spanish voice for Basque (eu-ES) when no native Basque voice exists', async () => {
      (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([
        {
          identifier: 'com.apple.voice.en-US.samantha',
          language: 'en-US',
          name: 'Samantha',
          quality: 'Default',
        },
        {
          identifier: 'com.apple.voice.es-ES.monica',
          language: 'es-ES',
          name: 'Monica',
          quality: 'Default',
        },
      ]);

      const voice = await findBestVoice('eu-ES');
      expect(voice).toBeDefined();
      expect(voice?.identifier).toBe('com.apple.voice.es-ES.monica');
      expect(voice?.language).toBe('es-ES');
    });

    it('prefers native Basque voice when one is installed', async () => {
      (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([
        {
          identifier: 'com.apple.voice.es-ES.monica',
          language: 'es-ES',
          name: 'Monica',
          quality: 'Default',
        },
        {
          identifier: 'com.google.voice.eu-ES.miren',
          language: 'eu-ES',
          name: 'Miren',
          quality: 'Default',
        },
      ]);

      const voice = await findBestVoice('eu-ES');
      expect(voice).toBeDefined();
      expect(voice?.identifier).toBe('com.google.voice.eu-ES.miren');
      expect(voice?.language).toBe('eu-ES');
    });
  });

  describe('speakWord', () => {
    it('ignores empty or whitespace-only terms', async () => {
      await speakWord('');
      await speakWord('   ');
      expect(Speech.speak).not.toHaveBeenCalled();
    });

    it('speaks term with normalized language and proper audio session', async () => {
      (Speech.isSpeakingAsync as jest.Mock).mockResolvedValueOnce(false);

      await speakWord('casa', 'es');

      expect(Speech.speak).toHaveBeenCalledWith(
        'casa',
        expect.objectContaining({
          language: 'es-ES',
          volume: 1.0,
          rate: 0.88,
          pitch: 1.05,
          useApplicationAudioSession: true,
        })
      );
    });

    it('does not call Speech.stop() if speech engine is idle', async () => {
      (Speech.isSpeakingAsync as jest.Mock).mockResolvedValueOnce(false);

      await speakWord('bonjour', 'French');

      expect(Speech.stop).not.toHaveBeenCalled();
      expect(Speech.speak).toHaveBeenCalledWith(
        'bonjour',
        expect.objectContaining({
          language: 'fr-FR',
        })
      );
    });

    it('calls Speech.stop() if synthesizer is currently speaking', async () => {
      (Speech.isSpeakingAsync as jest.Mock).mockResolvedValueOnce(true);

      await speakWord('arigato', 'ja');

      expect(Speech.stop).toHaveBeenCalledTimes(1);
      expect(Speech.speak).toHaveBeenCalledWith(
        'arigato',
        expect.objectContaining({
          language: 'ja-JP',
        })
      );
    });

    it('throttles rapid duplicate calls for the same word', async () => {
      (Speech.isSpeakingAsync as jest.Mock).mockResolvedValue(false);

      await speakWord('hola', 'es');
      await speakWord('hola', 'es');

      // The second immediate call for 'hola' should be throttled
      expect(Speech.speak).toHaveBeenCalledTimes(1);
    });

    it('speaks Latin words using Italian phonetic voice when no native Latin voice exists', async () => {
      (Speech.isSpeakingAsync as jest.Mock).mockResolvedValue(false);
      (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([
        {
          identifier: 'com.apple.voice.en-US.samantha',
          language: 'en-US',
          name: 'Samantha',
          quality: 'Default',
        },
        {
          identifier: 'com.apple.voice.it-IT.alice',
          language: 'it-IT',
          name: 'Alice',
          quality: 'Default',
        },
      ]);

      await speakWord('senatus', 'la');

      expect(Speech.speak).toHaveBeenCalledWith(
        'senatus',
        expect.objectContaining({
          language: 'it-IT',
          voice: 'com.apple.voice.it-IT.alice',
        })
      );
    });

    it('speaks Basque words using Spanish phonetic voice when no native Basque voice exists', async () => {
      (Speech.isSpeakingAsync as jest.Mock).mockResolvedValue(false);
      (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([
        {
          identifier: 'com.apple.voice.en-US.samantha',
          language: 'en-US',
          name: 'Samantha',
          quality: 'Default',
        },
        {
          identifier: 'com.apple.voice.es-ES.monica',
          language: 'es-ES',
          name: 'Monica',
          quality: 'Default',
        },
      ]);

      await speakWord('egun on', 'eu');

      expect(Speech.speak).toHaveBeenCalledWith(
        'egun on',
        expect.objectContaining({
          language: 'es-ES',
          voice: 'com.apple.voice.es-ES.monica',
        })
      );
    });

    it('uses phonetic fallback language when voice list is completely empty to prevent English fallback', async () => {
      (Speech.isSpeakingAsync as jest.Mock).mockResolvedValue(false);
      (Speech.getAvailableVoicesAsync as jest.Mock).mockResolvedValueOnce([]);

      await speakWord('amare', 'Latin');

      expect(Speech.speak).toHaveBeenCalledWith(
        'amare',
        expect.objectContaining({
          language: 'it-IT',
        })
      );
    });
  });

  describe('stopSpeech', () => {
    it('calls Speech.stop() cleanly', async () => {
      await stopSpeech();
      expect(Speech.stop).toHaveBeenCalled();
    });
  });

  describe('ttsAudioCache', () => {
    it('stores and retrieves cached items', () => {
      ttsAudioCache.set('es', 'gato', 'audio-uri-data');
      expect(ttsAudioCache.has('es', 'gato')).toBe(true);
      expect(ttsAudioCache.get('es', 'gato')).toBe('audio-uri-data');

      ttsAudioCache.clear();
      expect(ttsAudioCache.has('es', 'gato')).toBe(false);
      expect(ttsAudioCache.get('es', 'gato')).toBeUndefined();
    });
  });
});
