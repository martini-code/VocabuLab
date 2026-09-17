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
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
  ],
  getLanguageByCode: (code: string) =>
    ({
      en: { code: 'en', name: 'English', nativeName: 'English' },
      es: { code: 'es', name: 'Spanish', nativeName: 'Español' },
      fr: { code: 'fr', name: 'French', nativeName: 'Français' },
    }[code] || null),
  getLanguageByName: (_name: string) => null,
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
    // The subtitle is hardcoded in the component
    const subtitle = await findByText('123 Global Languages • On-Demand Packs (~25 KB)');
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

  it('shows Downloaded filter tab', async () => {
    const { findByText } = await render(<LanguageSelectorModal {...defaultProps} />);
    await findByText('Language Fortress');
    // downloadedCodesSet always includes 'en', so size >= 1
    // The tab text is "Downloaded (N)"
    const downloadedTab = await findByText(/Downloaded \(\d+\)/);
    expect(downloadedTab).toBeTruthy();
  });

  it('shows language pair banner with origin (English) and destination (Spanish)', async () => {
    const { findByText, findAllByText } = await render(
      <LanguageSelectorModal {...defaultProps} />
    );
    await findByText('Language Fortress');
    // After loadSettings resolves: origin_lang='en' → "English" ; destination_lang='es' → "Español"
    const originNames = await findAllByText('English');
    expect(originNames.length).toBeGreaterThanOrEqual(1);
    const destNames = await findAllByText('Español');
    expect(destNames.length).toBeGreaterThanOrEqual(1);
  });

  it('shows NATIVE / APP and I AM LEARNING labels in pair banner', async () => {
    const { findByText } = await render(<LanguageSelectorModal {...defaultProps} />);
    await findByText('Language Fortress');
    const nativeLabel = await findByText('NATIVE / APP');
    expect(nativeLabel).toBeTruthy();
    const learningLabel = await findByText('I AM LEARNING');
    expect(learningLabel).toBeTruthy();
  });

  it('renders language list items from SUPPORTED_LANGUAGES', async () => {
    const { findByText, findAllByText } = await render(
      <LanguageSelectorModal {...defaultProps} />
    );
    await findByText('Language Fortress');
    // FlatList mock renders up to 10 items; we have en, es, fr
    // "Spanish (ES)" appears in both the banner and the row item
    const spanishRows = await findAllByText(/Spanish \(ES\)/);
    expect(spanishRows.length).toBeGreaterThanOrEqual(1);
    const frenchRow = await findByText(/French \(FR\)/);
    expect(frenchRow).toBeTruthy();
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
});
