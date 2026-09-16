import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './en/common.json';
import es from './es/common.json';
import pt from './pt/common.json';
import fr from './fr/common.json';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE_CODE, LanguageOption } from './languages';
import { localeLoaders } from './registry';

export const resources: Record<string, { common: any }> = {
  en: { common: en },
  es: { common: es },
  pt: { common: pt },
  fr: { common: fr },
};

/**
 * Ensures a language bundle is loaded into i18n.
 */
export function ensureLanguageLoaded(langCode: string): void {
  if (i18n.hasResourceBundle(langCode, 'common')) {
    return;
  }
  const loader = localeLoaders[langCode];
  if (loader) {
    try {
      const bundle = loader();
      i18n.addResourceBundle(langCode, 'common', bundle, true, true);
    } catch (e) {
      console.warn(`[i18n] Failed to load locale bundle for ${langCode}:`, e);
    }
  }
}

/**
 * Detects device language or falls back to default.
 */
export function getDeviceLanguage(): string {
  try {
    const locales = getLocales();
    if (locales && locales.length > 0 && locales[0].languageCode) {
      const code = locales[0].languageCode.toLowerCase();
      // Check if code matches any supported language
      const match = SUPPORTED_LANGUAGES.find(
        (l) => l.code.toLowerCase() === code || l.code.toLowerCase().startsWith(code)
      );
      if (match) {
        return match.code;
      }
    }
  } catch (error) {
    console.warn('[i18n] Error detecting device locale:', error);
  }
  return DEFAULT_LANGUAGE_CODE;
}

const initialLang = getDeviceLanguage();
if (initialLang && !resources[initialLang] && localeLoaders[initialLang]) {
  try {
    resources[initialLang] = { common: localeLoaders[initialLang]() };
  } catch (e) {
    console.warn(`[i18n] Failed to preload initial locale bundle for ${initialLang}:`, e);
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: DEFAULT_LANGUAGE_CODE,
  defaultNS: 'common',
  ns: ['common'],
  interpolation: {
    escapeValue: false, // React already protects against XSS
  },
  react: {
    useSuspense: false,
  },
});

/**
 * Dynamically switches the active app language.
 */
export async function changeAppLanguage(langCode: string): Promise<void> {
  ensureLanguageLoaded(langCode);
  await i18n.changeLanguage(langCode);
}

/**
 * Registers a new language bundle at runtime.
 */
export function registerLanguageBundle(langCode: string, bundle: Record<string, any>): void {
  i18n.addResourceBundle(langCode, 'common', bundle, true, true);
}

/**
 * Returns the currently active language details.
 */
export function getCurrentLanguageOption(): LanguageOption {
  const currentCode = i18n.language || DEFAULT_LANGUAGE_CODE;
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === currentCode || l.code.startsWith(currentCode));
  return found || SUPPORTED_LANGUAGES[0];
}

export default i18n;

// Strict TypeScript typing for i18next keys
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof en;
    };
  }
}
