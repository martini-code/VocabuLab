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
    Rocket: icon('Rocket'),
    Sparkles: icon('Sparkles'),
    Coins: icon('Coins'),
    TestTube: icon('TestTube'),
    ShieldCheck: icon('ShieldCheck'),
    CheckCircle2: icon('CheckCircle2'),
    Clock: icon('Clock'),
    Sliders: icon('Sliders'),
  };
});

// ─── react-i18next mock ───────────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: any) => opts?.defaultValue ?? _key,
    i18n: { language: 'en' },
  }),
}));

import { TOKEN_CONFIG } from '../../../config/secrets';

// ─── tokenWallet mock ─────────────────────────────────────────────────────────
jest.mock('../../../services/tokenWallet', () => {
  const { TOKEN_CONFIG: TC } = require('../../../config/secrets');
  return {
    tokenWallet: {
      getWalletStatus: jest.fn().mockResolvedValue({
        tokens: TC.INITIAL_TOKENS,
        tokenWordCredits: TC.WORDS_PER_TOKEN * 2,
        dailyPassWords: TC.DAILY_PASS_WORDS,
        totalWordsAllowance: TC.DAILY_PASS_WORDS + TC.WORDS_PER_TOKEN * 2,
        adsWatchedToday: 0,
        maxDailyAds: TC.MAX_DAILY_ADS,
        canWatchAd: true,
      }),
      subscribe: jest.fn().mockReturnValue(() => {}),
    },
  };
});

// Convenience alias used in tests that override the mock
const BASE_WALLET_STATE = {
  tokens: TOKEN_CONFIG.INITIAL_TOKENS,
  tokenWordCredits: TOKEN_CONFIG.WORDS_PER_TOKEN * 2,
  dailyPassWords: TOKEN_CONFIG.DAILY_PASS_WORDS,
  totalWordsAllowance: TOKEN_CONFIG.DAILY_PASS_WORDS + TOKEN_CONFIG.WORDS_PER_TOKEN * 2,
  adsWatchedToday: 0,
  maxDailyAds: TOKEN_CONFIG.MAX_DAILY_ADS,
  canWatchAd: true,
};

// ─── adMobService mock ────────────────────────────────────────────────────────
jest.mock('../../../services/adMobService', () => ({
  adMobService: {
    showRewardedAd: jest.fn().mockResolvedValue({ success: true }),
    openAdInspector: jest.fn().mockResolvedValue({ success: true }),
  },
}));

// ─── LexMascot mock ────────────────────────────────────────────────────────
jest.mock('../../mascot/Mascots', () => {
  const React = require('react');
  return {
    LexMascot: ({ mood }: any) =>
      React.createElement('View', { testID: `mascot-${mood}` }),
  };
});

// ─── Component under test ─────────────────────────────────────────────────────
import { InsufficientTokensModal } from '../InsufficientTokensModal';

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onOpenPlusModal: jest.fn(),
  requiredWords: 10,
};

afterEach(async () => {
  jest.clearAllMocks();
  await cleanup();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InsufficientTokensModal', () => {
  it('renders null when visible is false', async () => {
    const { queryByText } = await render(
      <InsufficientTokensModal {...defaultProps} visible={false} />
    );
    // !visible → returns null immediately
    expect(queryByText('More Words Needed')).toBeNull();
  });

  it('renders More Words Needed when visible and wallet loads', async () => {
    const { findByText } = await render(<InsufficientTokensModal {...defaultProps} />);
    const title = await findByText('More Words Needed');
    expect(title).toBeTruthy();
  });

  it('shows ALLOWANCE NEEDED badge', async () => {
    const { findByText } = await render(<InsufficientTokensModal {...defaultProps} />);
    const badge = await findByText('ALLOWANCE NEEDED');
    expect(badge).toBeTruthy();
  });

  it('close button calls onClose', async () => {
    const onClose = jest.fn();
    const { findByText, getAllByTestId } = await render(
      <InsufficientTokensModal {...defaultProps} onClose={onClose} />
    );
    await findByText('More Words Needed');
    // The X icon is inside a TouchableOpacity (rendered as View with onPress)
    const xIcons = getAllByTestId('icon-X');
    await fireEvent.press(xIcons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Required label with requiredWords value', async () => {
    const { findByText } = await render(
      <InsufficientTokensModal {...defaultProps} requiredWords={10} />
    );
    await findByText('More Words Needed');
    const reqLabel = await findByText('Required');
    expect(reqLabel).toBeTruthy();
    // requiredWords = 10 shown as stat value
    const reqValue = await findByText('10');
    expect(reqValue).toBeTruthy();
  });

  it('shows Available label with wallet totalWordsAllowance', async () => {
    const { findByText } = await render(<InsufficientTokensModal {...defaultProps} />);
    await findByText('More Words Needed');
    const availLabel = await findByText('Available');
    expect(availLabel).toBeTruthy();
    const availValue = await findByText(String(BASE_WALLET_STATE.totalWordsAllowance));
    expect(availValue).toBeTruthy();
  });

  it('shows Watch Ad button when canWatchAd is true', async () => {
    const { findByText } = await render(<InsufficientTokensModal {...defaultProps} />);
    const btn = await findByText('Watch Ad (+1 Token / 10 Words)');
    expect(btn).toBeTruthy();
  });

  it('shows Daily Ad Limit Reached when canWatchAd is false', async () => {
    const { tokenWallet } = require('../../../services/tokenWallet');
    tokenWallet.getWalletStatus.mockResolvedValueOnce({
      ...BASE_WALLET_STATE,
      canWatchAd: false,
    });

    const { findByText } = await render(<InsufficientTokensModal {...defaultProps} />);
    const limitTitle = await findByText('Daily Ad Limit Reached');
    expect(limitTitle).toBeTruthy();
  });

  it('Or Unlock Unlimited with Plus calls onClose then onOpenPlusModal', async () => {
    const onClose = jest.fn();
    const onOpenPlusModal = jest.fn();

    const { findByText } = await render(
      <InsufficientTokensModal
        {...defaultProps}
        onClose={onClose}
        onOpenPlusModal={onOpenPlusModal}
      />
    );

    const btn = await findByText('Or Unlock Unlimited with Plus');
    await fireEvent.press(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenPlusModal).toHaveBeenCalledTimes(1);
  });

  it('shows thinking mascot', async () => {
    const { findByTestId } = await render(<InsufficientTokensModal {...defaultProps} />);
    const mascot = await findByTestId('mascot-thinking');
    expect(mascot).toBeTruthy();
  });
});
