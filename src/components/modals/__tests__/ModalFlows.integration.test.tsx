import React, { useState } from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native/pure';
import { TokenWalletModal } from '../../tokens/TokenWalletModal';
import { InsufficientTokensModal } from '../../tokens/InsufficientTokensModal';
import { LanguageSelectorModal } from '../LanguageSelectorModal';
import { TokenPill } from '../../tokens/TokenPill';
import { View, Text, TouchableOpacity } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

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
      React.createElement(
        'View',
        { ref, testID, onClick: onPress, onResponderRelease: onPress, onPress, ...props },
        children
      )
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
      visible
        ? React.createElement(
            'View',
            { testID: 'modal-container', onRequestClose, onAccessibilityEscape: onRequestClose },
            children
          )
        : null,
    FlatList: ({ data, renderItem }: any) =>
      React.createElement(
        'View',
        { testID: 'flat-list' },
        ...(data || []).slice(0, 10).map((item: any, i: number) =>
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
    Flame: icon('Flame'),
    Shield: icon('Shield'),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      if (typeof opts === 'string') return opts;
      return opts?.defaultValue ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

const mockWalletState = {
  tokens: 2,
  tokenWordCredits: 20,
  dailyPassWords: 5,
  totalWordsAllowance: 25,
  adsWatchedToday: 0,
  maxDailyAds: 3,
  canWatchAd: true,
};

let walletListener: any = null;

jest.mock('../../../services/tokenWallet', () => ({
  tokenWallet: {
    getWalletStatus: jest.fn().mockImplementation(async () => mockWalletState),
    subscribe: jest.fn().mockImplementation((cb: any) => {
      walletListener = cb;
      return () => {
        walletListener = null;
      };
    }),
  },
}));

jest.mock('../../../services/adMobService', () => ({
  adMobService: {
    showRewardedAd: jest.fn().mockResolvedValue({ success: true }),
    openAdInspector: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../../mascot/Mascots', () => {
  const React = require('react');
  return {
    LexMascot: ({ mood, size }: any) =>
      React.createElement('View', { testID: `mascot-${mood}`, 'data-size': size }),
  };
});

jest.mock('../../../db/vault', () => ({
  getLanguagePairSettings: jest.fn().mockResolvedValue({
    origin_lang: 'en',
    destination_lang: 'es',
  }),
  setLanguagePairSettings: jest.fn().mockResolvedValue(undefined),
  getDownloadedLanguages: jest.fn().mockResolvedValue([
    {
      code: 'es',
      lang_name: 'Spanish',
      downloaded_at: '2026-09-01T00:00:00Z',
      card_count: 100,
      size_bytes: 25000,
    },
  ]),
  getEnrolledLanguagePairs: jest.fn().mockResolvedValue([]),
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
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  ],
  getLanguageByCode: (code: string) =>
    ({
      en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
      es: { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
      fr: { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
      de: { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    }[code] || null),
  getLanguageByName: (_name: string) => null,
  getLanguageFlag: (codeOrName: string) => {
    const map: Record<string, string> = { en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪' };
    return map[codeOrName.toLowerCase()] || '🌐';
  },
  resolveLanguageCode: (codeOrName: string) => codeOrName || 'es',
  formatLanguageCode: (codeOrName: string) => {
    if (!codeOrName) return '';
    return codeOrName.toUpperCase();
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Stateful Parent Test Harness mimicking App.tsx modal coordinator
// ─────────────────────────────────────────────────────────────────────────────

interface AppModalCoordinatorProps {
  onPlusModalOpened?: () => void;
  onPairChangedMock?: (pair: any) => void;
  onSuccessLearnMock?: () => void;
}

const AppModalCoordinator: React.FC<AppModalCoordinatorProps> = ({
  onPlusModalOpened = jest.fn(),
  onPairChangedMock = jest.fn(),
  onSuccessLearnMock = jest.fn(),
}) => {
  const [tokenWalletOpen, setTokenWalletOpen] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficientWords, setInsufficientWords] = useState(1);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [languageMode, setLanguageMode] = useState<'origin' | 'destination'>('destination');
  const [languagePair, setLanguagePair] = useState({ origin_lang: 'en', destination_lang: 'es' });
  const [plusModalOpen, setPlusModalOpen] = useState(false);

  return (
    <View testID="app-container">
      {/* Top Header Controls */}
      <View testID="header-bar">
        {/* Token Pill Button to open Token Wallet */}
        <TokenPill onPress={() => setTokenWalletOpen(true)} />

        {/* Destination Language Selector Pill */}
        <TouchableOpacity
          testID="open-dest-lang-pill"
          onPress={() => {
            setLanguageMode('destination');
            setLanguageModalOpen(true);
          }}
        >
          <Text testID="current-dest-lang">{languagePair.destination_lang.toUpperCase()}</Text>
        </TouchableOpacity>

        {/* Origin Language Selector Pill */}
        <TouchableOpacity
          testID="open-origin-lang-pill"
          onPress={() => {
            setLanguageMode('origin');
            setLanguageModalOpen(true);
          }}
        >
          <Text testID="current-origin-lang">{languagePair.origin_lang.toUpperCase()}</Text>
        </TouchableOpacity>

        {/* Action Button that simulates failing an allowance check */}
        <TouchableOpacity
          testID="trigger-insufficient-tokens-btn"
          onPress={() => {
            setInsufficientWords(30);
            setInsufficientOpen(true);
          }}
        >
          <Text>Learn Heavy Deck</Text>
        </TouchableOpacity>
      </View>

      {/* Plus Modal Stand-in indicator */}
      {plusModalOpen && (
        <View testID="plus-modal-standin">
          <Text>Plus Membership Gateway</Text>
          <TouchableOpacity
            testID="close-plus-modal-btn"
            onPress={() => setPlusModalOpen(false)}
          >
            <Text>Close Plus</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 1. Token Wallet Modal */}
      <TokenWalletModal
        visible={tokenWalletOpen}
        onClose={() => setTokenWalletOpen(false)}
        onOpenPlusModal={() => {
          setPlusModalOpen(true);
          onPlusModalOpened();
        }}
      />

      {/* 2. Insufficient Tokens Modal */}
      <InsufficientTokensModal
        visible={insufficientOpen}
        onClose={() => setInsufficientOpen(false)}
        onOpenPlusModal={() => {
          setPlusModalOpen(true);
          onPlusModalOpened();
        }}
        requiredWords={insufficientWords}
        onSuccessLearn={onSuccessLearnMock}
      />

      {/* 3. Language Selector Modal */}
      <LanguageSelectorModal
        visible={languageModalOpen}
        onClose={() => setLanguageModalOpen(false)}
        initialMode={languageMode}
        onPairChanged={(newPair) => {
          setLanguagePair(newPair);
          onPairChangedMock(newPair);
        }}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Modal Openings & Closings Integration Tests', () => {
  afterEach(async () => {
    await cleanup();
  });

  describe('Token Wallet Modal Opening & Closing Lifecycle', () => {
    it('is initially closed, opens on TokenPill press, and closes on X dismiss', async () => {
      const { queryByText, findByText, findAllByText, getByTestId } = await render(
        <AppModalCoordinator />
      );

      // Initially closed
      expect(queryByText('ROYAL TOKENS')).toBeNull();

      // Open Token Wallet via TokenPill
      const tokenPill = getByTestId('token-pill-btn');
      await fireEvent.press(tokenPill);

      // Verify modal content is rendered
      const walletTitle = await findByText('ROYAL TOKENS');
      expect(walletTitle).toBeTruthy();
      expect(await findByText('WORDS READY TO LEARN')).toBeTruthy();
      const allowanceElements = await findAllByText('25');
      expect(allowanceElements.length).toBeGreaterThanOrEqual(1);

      // Dismiss via Close Button (icon-X)
      await fireEvent.press(getByTestId('modal-close-btn'));

      // Verify modal is closed
      expect(queryByText('ROYAL TOKENS')).toBeNull();
    });

    it('re-opens cleanly after previous dismissal without lingering state', async () => {
      const { queryByText, findByText, getByTestId } = await render(<AppModalCoordinator />);

      // First open
      await fireEvent.press(getByTestId('token-pill-btn'));
      expect(await findByText('ROYAL TOKENS')).toBeTruthy();

      // First close
      await fireEvent.press(getByTestId('modal-close-btn'));
      expect(queryByText('ROYAL TOKENS')).toBeNull();

      // Second open
      await fireEvent.press(getByTestId('token-pill-btn'));
      expect(await findByText('ROYAL TOKENS')).toBeTruthy();

      // Second close
      await fireEvent.press(getByTestId('modal-close-btn'));
      expect(queryByText('ROYAL TOKENS')).toBeNull();
    });
  });

  describe('Language Selector Modal Opening, Modes & Closing Lifecycle', () => {
    it('opens destination mode from destination pill and closes on X', async () => {
      const { queryByText, findByText, getByTestId } = await render(<AppModalCoordinator />);

      // Initially closed
      expect(queryByText('Language Fortress')).toBeNull();

      // Open in destination mode
      await fireEvent.press(getByTestId('open-dest-lang-pill'));

      // Modal is visible
      const modalTitle = await findByText('Language Fortress');
      expect(modalTitle).toBeTruthy();
      expect(await findByText('Select the language you want to learn')).toBeTruthy();

      // Close modal
      await fireEvent.press(getByTestId('modal-close-btn'));

      // Modal dismissed
      expect(queryByText('Language Fortress')).toBeNull();
    });

    it('opens origin mode from origin pill with origin notice bar', async () => {
      const { queryByText, findByText, getByTestId } = await render(<AppModalCoordinator />);

      // Open in origin mode
      await fireEvent.press(getByTestId('open-origin-lang-pill'));

      // Modal is visible with origin prompt
      expect(await findByText('Language Fortress')).toBeTruthy();
      expect(
        await findByText('Configuring App Interface & Explanation Language')
      ).toBeTruthy();

      // Close modal
      await fireEvent.press(getByTestId('modal-close-btn'));
      expect(queryByText('Language Fortress')).toBeNull();
    });
  });

  describe('Insufficient Tokens Modal Opening & Closing Lifecycle', () => {
    it('opens when insufficient allowance is triggered, shows required count, and closes on X', async () => {
      const { queryByText, findByText, findAllByText, getByTestId } = await render(
        <AppModalCoordinator />
      );

      // Initially closed
      expect(queryByText('More Words Needed')).toBeNull();

      // Trigger insufficient tokens (requesting 30 words)
      await fireEvent.press(getByTestId('trigger-insufficient-tokens-btn'));

      // Insufficient modal opens
      expect(await findByText('More Words Needed')).toBeTruthy();
      expect(await findByText('ALLOWANCE NEEDED')).toBeTruthy();
      expect(await findByText('30')).toBeTruthy(); // Required words
      const availableElements = await findAllByText('25'); // Available words (in pill + modal)
      expect(availableElements.length).toBeGreaterThanOrEqual(1);

      // Close modal
      await fireEvent.press(getByTestId('modal-close-btn'));

      // Dismissed
      expect(queryByText('More Words Needed')).toBeNull();
    });

    it('transitions to Plus upgrade modal from InsufficientTokensModal', async () => {
      const onPlusOpened = jest.fn();
      const { queryByText, findByText, getByTestId } = await render(
        <AppModalCoordinator onPlusModalOpened={onPlusOpened} />
      );

      // Trigger insufficient tokens
      await fireEvent.press(getByTestId('trigger-insufficient-tokens-btn'));
      expect(await findByText('More Words Needed')).toBeTruthy();

      // Click "Or Unlock Unlimited with Plus" button
      const upgradeBtn = await findByText('Or Unlock Unlimited with Plus');
      await fireEvent.press(upgradeBtn);

      // Insufficient modal is dismissed and Plus gateway opens
      expect(queryByText('More Words Needed')).toBeNull();
      expect(await findByText('Plus Membership Gateway')).toBeTruthy();
      expect(onPlusOpened).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cross-Modal Isolation & Mutual Exclusivity', () => {
    it('opening one modal does not accidentally open another', async () => {
      const { queryByText, findByText, getByTestId } = await render(<AppModalCoordinator />);

      // Open Token Wallet only
      await fireEvent.press(getByTestId('token-pill-btn'));
      expect(await findByText('ROYAL TOKENS')).toBeTruthy();

      // Verify other modals are not open
      expect(queryByText('Language Fortress')).toBeNull();
      expect(queryByText('More Words Needed')).toBeNull();

      // Close Token Wallet
      await fireEvent.press(getByTestId('modal-close-btn'));
      expect(queryByText('ROYAL TOKENS')).toBeNull();

      // Open Language Selector only
      await fireEvent.press(getByTestId('open-dest-lang-pill'));
      expect(await findByText('Language Fortress')).toBeTruthy();

      // Verify others are closed
      expect(queryByText('ROYAL TOKENS')).toBeNull();
      expect(queryByText('More Words Needed')).toBeNull();
    });
  });

  describe('Language Selection Actions & Auto-Closing Flows', () => {
    it('selecting a language row updates active destination and auto-closes LanguageSelectorModal', async () => {
      const onPairChanged = jest.fn();
      const { queryByText, findByText, getByTestId } = await render(
        <AppModalCoordinator onPairChangedMock={onPairChanged} />
      );

      // Open in destination mode
      await fireEvent.press(getByTestId('open-dest-lang-pill'));
      expect(await findByText('Language Fortress')).toBeTruthy();

      // Select French from the list
      const frenchRow = await findByText('Français');
      await fireEvent.press(frenchRow);

      // Modal should automatically close
      expect(queryByText('Language Fortress')).toBeNull();

      // onPairChanged callback should be called with updated pair
      expect(onPairChanged).toHaveBeenCalledWith({
        origin_lang: 'en',
        destination_lang: 'fr',
      });

      // Destination pill should reflect new code 'FR'
      expect(await findByText('FR')).toBeTruthy();
    });

    it('swapping languages in LanguageSelectorModal updates pair with swapped roles', async () => {
      const onPairChanged = jest.fn();
      const { findByText, getByTestId } = await render(
        <AppModalCoordinator onPairChangedMock={onPairChanged} />
      );

      // Open in destination mode
      await fireEvent.press(getByTestId('open-dest-lang-pill'));
      await findByText('Language Fortress');

      // Press the swap languages button
      const swapBtn = getByTestId('swap-lang-btn');
      await fireEvent.press(swapBtn);

      // onPairChanged callback fired with swapped pair
      expect(onPairChanged).toHaveBeenCalledWith({
        origin_lang: 'es',
        destination_lang: 'en',
      });
    });
  });

  describe('Ad Interactivity & Modal Transitions', () => {
    it('watching rewarded ad that fulfills required words closes InsufficientTokensModal and triggers onSuccessLearn', async () => {
      const { adMobService } = require('../../../services/adMobService');
      const { tokenWallet } = require('../../../services/tokenWallet');

      // Mock adMobService to return success
      (adMobService.showRewardedAd as jest.Mock).mockResolvedValueOnce({ success: true });

      // After watching ad, wallet status has 35 words (greater than required 30)
      (tokenWallet.getWalletStatus as jest.Mock).mockResolvedValue({
        tokens: 3,
        tokenWordCredits: 30,
        dailyPassWords: 5,
        totalWordsAllowance: 35,
        adsWatchedToday: 1,
        maxDailyAds: 3,
        canWatchAd: true,
      });

      const onSuccessLearn = jest.fn();
      const { queryByText, findByText, getByTestId } = await render(
        <AppModalCoordinator onSuccessLearnMock={onSuccessLearn} />
      );

      // Open Insufficient Tokens modal (requesting 30 words)
      await fireEvent.press(getByTestId('trigger-insufficient-tokens-btn'));
      expect(await findByText('More Words Needed')).toBeTruthy();

      // Tap Watch Ad CTA
      const watchAdBtn = await findByText('Watch Ad (+1 Token / 10 Words)');
      await fireEvent.press(watchAdBtn);

      // Modal should automatically close upon fulfilling allowance
      expect(queryByText('More Words Needed')).toBeNull();
      // onSuccessLearn should be invoked
      expect(onSuccessLearn).toHaveBeenCalledTimes(1);
    });

    it('watching ad when limit is reached closes TokenWalletModal and opens Plus modal', async () => {
      const { adMobService } = require('../../../services/adMobService');
      (adMobService.showRewardedAd as jest.Mock).mockResolvedValueOnce({
        success: false,
        reason: 'limit_reached',
      });

      const onPlusOpened = jest.fn();
      const { queryByText, findByText, getByTestId } = await render(
        <AppModalCoordinator onPlusModalOpened={onPlusOpened} />
      );

      // Open Token Wallet
      await fireEvent.press(getByTestId('token-pill-btn'));
      expect(await findByText('ROYAL TOKENS')).toBeTruthy();

      // Tap WATCH AD CTA
      const watchAdBtn = await findByText('WATCH AD (+1 TOKEN)');
      await fireEvent.press(watchAdBtn);

      // Token Wallet should close and Plus modal should open
      expect(queryByText('ROYAL TOKENS')).toBeNull();
      expect(await findByText('Plus Membership Gateway')).toBeTruthy();
      expect(onPlusOpened).toHaveBeenCalledTimes(1);
    });
  });

  describe('Hardware Back Button Dismissal (onRequestClose)', () => {
    it('onRequestClose on TokenWalletModal closes the modal', async () => {
      const { queryByText, findByText, getByTestId } = await render(<AppModalCoordinator />);

      // Open Token Wallet
      await fireEvent.press(getByTestId('token-pill-btn'));
      expect(await findByText('ROYAL TOKENS')).toBeTruthy();

      // Trigger onRequestClose on modal container
      const modalContainer = getByTestId('modal-container');
      await fireEvent(modalContainer, 'requestClose');

      // Modal dismissed
      expect(queryByText('ROYAL TOKENS')).toBeNull();
    });

    it('onRequestClose on LanguageSelectorModal closes the modal', async () => {
      const { queryByText, findByText, getByTestId } = await render(<AppModalCoordinator />);

      // Open Language Selector
      await fireEvent.press(getByTestId('open-dest-lang-pill'));
      expect(await findByText('Language Fortress')).toBeTruthy();

      // Trigger onRequestClose
      const modalContainer = getByTestId('modal-container');
      await fireEvent(modalContainer, 'requestClose');

      // Modal dismissed
      expect(queryByText('Language Fortress')).toBeNull();
    });

    it('onRequestClose on InsufficientTokensModal closes the modal', async () => {
      const { queryByText, findByText, getByTestId } = await render(<AppModalCoordinator />);

      // Open Insufficient Tokens modal
      await fireEvent.press(getByTestId('trigger-insufficient-tokens-btn'));
      expect(await findByText('More Words Needed')).toBeTruthy();

      // Trigger onRequestClose
      const modalContainer = getByTestId('modal-container');
      await fireEvent(modalContainer, 'requestClose');

      // Modal dismissed
      expect(queryByText('More Words Needed')).toBeNull();
    });
  });
});
