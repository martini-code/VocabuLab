import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native/pure';

// ─── react-native override ────────────────────────────────────────────────────
jest.mock('react-native', () => {
  const React = require('react');
  const createEl = (name: string) =>
    React.forwardRef(({ children, testID, ...props }: any, ref: any) =>
      React.createElement(name, { ref, testID, ...props }, children)
    );
  const View = createEl('View');
  const Text = createEl('Text');
  const ScrollView = createEl('ScrollView');
  const TouchableOpacity = React.forwardRef(
    ({ children, onPress, testID, ...props }: any, ref: any) =>
      React.createElement('View', { ref, testID, onClick: onPress, onPress, ...props }, children)
  );
  return {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Pressable: TouchableOpacity,
    SafeAreaView: View,
    StyleSheet: {
      create: (s: any) => s,
      flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s) : s || {}),
    },
    Platform: { OS: 'ios', select: (o: any) => o.ios ?? o.default },
    Modal: ({ visible, children, onRequestClose }: any) =>
      visible ? React.createElement('View', { testID: 'modal-container' }, children) : null,
    FlatList: ({ data, renderItem }: any) =>
      React.createElement(
        'View',
        { testID: 'flat-list' },
        ...(data || [])
          .slice(0, 10)
          .map((item: any, i: number) =>
            React.createElement('View', { key: i }, renderItem({ item, index: i }))
          )
      ),
    TextInput: ({ value, onChangeText, placeholder, testID, ...rest }: any) =>
      React.createElement('TextInput', {
        value,
        onChangeText,
        placeholder,
        testID: testID || 'text-input',
        ...rest,
      }),
    ActivityIndicator: ({ testID }: any) =>
      React.createElement('View', { testID: testID || 'activity-indicator' }),
    Alert: { alert: jest.fn() },
  };
});

// ─── lucide-react-native mock ─────────────────────────────────────────────────
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) =>
    React.createElement('View', { testID: `icon-${name}`, ...props });
  return {
    Globe: icon('Globe'),
    X: icon('X'),
    Search: icon('Search'),
    Check: icon('Check'),
    Download: icon('Download'),
    Trash2: icon('Trash2'),
    ArrowLeftRight: icon('ArrowLeftRight'),
    Languages: icon('Languages'),
    HardDrive: icon('HardDrive'),
    AlertCircle: icon('AlertCircle'),
    Tv: icon('Tv'),
    Crown: icon('Crown'),
    Sparkles: icon('Sparkles'),
    Coins: icon('Coins'),
    Scroll: icon('Scroll'),
    ShieldCheck: icon('ShieldCheck'),
    CheckCircle2: icon('CheckCircle2'),
    Clock: icon('Clock'),
    Sliders: icon('Sliders'),
  };
});

// ─── react-i18next mock ───────────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, optsOrDefault?: any) => {
      if (typeof optsOrDefault === 'string') return optsOrDefault;
      return optsOrDefault?.defaultValue ?? _key;
    },
    i18n: { language: 'en' },
  }),
}));

// ─── Database / service mocks ─────────────────────────────────────────────────
jest.mock('../../../db/vault', () => ({
  getLanguagePairSettings: jest
    .fn()
    .mockResolvedValue({ origin_lang: 'en', destination_lang: 'es' }),
  setLanguagePairSettings: jest.fn().mockResolvedValue(undefined),
  getDownloadedLanguages: jest.fn().mockResolvedValue([]),
  getEnrolledLanguagePairs: jest.fn().mockResolvedValue([
    {
      id: 'es:en',
      origin_lang: 'en',
      destination_lang: 'es',
      origin_name: 'English',
      destination_name: 'Spanish',
      enrolled_at: '2026-09-01T00:00:00Z',
      progress: {
        totalCards: 25,
        dueCards: 5,
        newCards: 2,
        masteredCards: 18,
      },
    },
    {
      id: 'fr:en',
      origin_lang: 'en',
      destination_lang: 'fr',
      origin_name: 'English',
      destination_name: 'French',
      enrolled_at: '2026-09-05T00:00:00Z',
      progress: {
        totalCards: 10,
        dueCards: 3,
        newCards: 1,
        masteredCards: 6,
      },
    },
  ]),
  enrollLanguagePair: jest.fn().mockResolvedValue(undefined),
  removeEnrolledLanguagePair: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../db/downloader', () => ({
  downloadLanguagePack: jest.fn().mockResolvedValue(undefined),
  deleteLanguagePack: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../locales', () => ({
  changeAppLanguage: jest.fn().mockResolvedValue(undefined),
  getDeviceLanguage: jest.fn().mockReturnValue('en'),
}));

jest.mock('../../../locales/languages', () => ({
  SUPPORTED_LANGUAGES: [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
  ],
  getLanguageByCode: (code: string) =>
    ({
      en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
      es: { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
      fr: { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
      'pt-br': { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
      'pt-BR': { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
    }[code] || null),
  getLanguageByName: (_name: string) => null,
  getLanguageFlag: (codeOrName: string) => {
    const map: Record<string, string> = { en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷', 'pt-br': '🇧🇷', 'pt-BR': '🇧🇷' };
    return map[codeOrName.toLowerCase()] || '🌐';
  },
  resolveLanguageCode: (codeOrName: string) => codeOrName || 'es',
  formatLanguageCode: (codeOrName: string) => {
    if (!codeOrName) return '';
    return codeOrName.toUpperCase();
  },
}));

// ─── Component under test ─────────────────────────────────────────────────────
import { LanguageSelectorModal } from '../LanguageSelectorModal';

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onPairChanged: jest.fn(),
};

afterEach(async () => {
  jest.clearAllMocks();
  await cleanup();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LanguageSelectorModal', () => {
  it('does not render when visible is false', async () => {
    const { queryByText, queryByTestId } = await render(
      <LanguageSelectorModal {...defaultProps} visible={false} />
    );
    // Modal mock returns null when visible=false
    expect(queryByText('Language Fortress')).toBeNull();
    expect(queryByTestId('modal-container')).toBeNull();
  });

  it('renders Language Fortress title when visible', async () => {
    const { findByText } = await render(<LanguageSelectorModal {...defaultProps} />);
    const title = await findByText('Language Fortress');
    expect(title).toBeTruthy();
  });

  it('renders subtitle with pack size info', async () => {
    const { findByText } = await render(<LanguageSelectorModal {...defaultProps} />);
    await findByText('Language Fortress');
    const subtitle = await findByText('123 Languages');
    expect(subtitle).toBeTruthy();
  });

  it('X button calls onClose', async () => {
    const onClose = jest.fn();
    const { findByText, getAllByTestId } = await render(
      <LanguageSelectorModal {...defaultProps} onClose={onClose} />
    );
    await findByText('Language Fortress');
    const xIcons = getAllByTestId('icon-X');
    await fireEvent.press(xIcons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows All Languages filter tab', async () => {
    const { findByText } = await render(<LanguageSelectorModal {...defaultProps} />);
    await findByText('Language Fortress');
    const allTab = await findByText('All Languages (123)');
    expect(allTab).toBeTruthy();
  });

  it('shows Downloaded tab with count', async () => {
    const { findByText } = await render(<LanguageSelectorModal {...defaultProps} />);
    await findByText('Language Fortress');
    // downloadedCodesSet always includes 'en', so size >= 1
    // The tab text is "Downloaded (N)"
    const downloadedTab = await findByText(/Downloaded \(\d+\)/);
    expect(downloadedTab).toBeTruthy();
  });

  it('shows language pair banner with origin (EN) and destination (ES)', async () => {
    const { findByText, findAllByText } = await render(
      <LanguageSelectorModal {...defaultProps} />
    );
    await findByText('Language Fortress');
    // Banner displays clean codes EN and ES with flags
    const originCodes = await findAllByText('EN');
    expect(originCodes.length).toBeGreaterThanOrEqual(1);
    const destCodes = await findAllByText('ES');
    expect(destCodes.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Native / App and I am learning labels in pair banner', async () => {
    const { findByText } = await render(<LanguageSelectorModal {...defaultProps} />);
    await findByText('Language Fortress');
    const nativeLabel = await findByText('Native / App');
    expect(nativeLabel).toBeTruthy();
    const learningLabel = await findByText('I am learning');
    expect(learningLabel).toBeTruthy();
  });

  it('renders language list items with language codes and native scripts', async () => {
    const { findByText, findAllByText } = await render(
      <LanguageSelectorModal {...defaultProps} />
    );
    await findByText('Language Fortress');
    // FlatList mock renders up to 10 items; we have en, es, fr
    // Language rows display clean code (ES, FR) and native script
    const spanishCodes = await findAllByText('ES');
    expect(spanishCodes.length).toBeGreaterThanOrEqual(1);
    const frenchCodes = await findAllByText('FR');
    expect(frenchCodes.length).toBeGreaterThanOrEqual(1);
    const francais = await findByText('Français');
    expect(francais).toBeTruthy();
  });

  it('shows search input placeholder text', async () => {
    const { findByPlaceholderText } = await render(
      <LanguageSelectorModal {...defaultProps} />
    );
    const input = await findByPlaceholderText(
      'Search by language, native name or code...'
    );
    expect(input).toBeTruthy();
  });

  it('renders enrolled learning languages carousel with live card and due counts', async () => {
    const { findByTestId, findByText } = await render(
      <LanguageSelectorModal {...defaultProps} />
    );
    await findByText('Language Fortress');

    const enrolledSection = await findByTestId('enrolled-languages-section');
    expect(enrolledSection).toBeTruthy();
    expect(await findByText('Your Learning Languages (2)')).toBeTruthy();

    // Verify Spanish enrolled card
    const esCard = await findByTestId('enrolled-card-es');
    expect(esCard).toBeTruthy();
    expect(await findByText('25 cards')).toBeTruthy();
    expect(await findByText('5 due')).toBeTruthy();
    expect(await findByText('Active')).toBeTruthy();

    // Verify French enrolled card
    const frCard = await findByTestId('enrolled-card-fr');
    expect(frCard).toBeTruthy();
    expect(await findByText('10 cards')).toBeTruthy();
    expect(await findByText('3 due')).toBeTruthy();
  });

  it('switches active language pair immediately when tapping an enrolled language card', async () => {
    const onPairChanged = jest.fn();
    const onClose = jest.fn();
    const vaultModule = require('../../../db/vault');

    const { findByTestId, findByText } = await render(
      <LanguageSelectorModal
        {...defaultProps}
        onPairChanged={onPairChanged}
        onClose={onClose}
      />
    );
    await findByText('Language Fortress');

    const frCard = await findByTestId('enrolled-card-fr');
    await act(async () => {
      fireEvent.press(frCard);
    });

    expect(vaultModule.setLanguagePairSettings).toHaveBeenCalledWith({
      destination_lang: 'fr',
      origin_lang: 'en',
    });
    expect(onPairChanged).toHaveBeenCalledWith({
      destination_lang: 'fr',
      origin_lang: 'en',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders long regional languages like PT-BR with both clean code and native name', async () => {
    const { findByText, findAllByText } = await render(
      <LanguageSelectorModal {...defaultProps} />
    );
    await findByText('Language Fortress');

    // Code is displayed cleanly as PT-BR
    const ptCodes = await findAllByText('PT-BR');
    expect(ptCodes.length).toBeGreaterThanOrEqual(1);

    // Native script is displayed on its own line
    const ptNative = await findByText('Português (Brasil)');
    expect(ptNative).toBeTruthy();
  });
});
