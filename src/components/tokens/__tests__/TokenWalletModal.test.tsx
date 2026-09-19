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

// Convenience alias for tests that need to override the mock
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

// ─── SquireMascot mock ────────────────────────────────────────────────────────
jest.mock('../../mascot/Mascots', () => {
  const React = require('react');
  return {
    SquireMascot: ({ mood }: any) =>
      React.createElement('View', { testID: `mascot-${mood}` }),
  };
});

// ─── Component under test ─────────────────────────────────────────────────────
import { TokenWalletModal } from '../TokenWalletModal';

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onOpenPlusModal: jest.fn(),
};

afterEach(async () => {
  jest.clearAllMocks();
  await cleanup();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TokenWalletModal', () => {
  it('renders null when visible is false', async () => {
    const { queryByText } = await render(
      <TokenWalletModal {...defaultProps} visible={false} />
    );
    // With visible=false, Modal returns null → wallet useEffect never fires → component returns null
    expect(queryByText('ROYAL TOKENS')).toBeNull();
  });

  it('renders ROYAL TOKENS title when visible and wallet loads', async () => {
    const { findByText } = await render(<TokenWalletModal {...defaultProps} />);
    const title = await findByText('ROYAL TOKENS');
    expect(title).toBeTruthy();
  });

  it('shows subtitle when wallet loads', async () => {
    const { findByText } = await render(<TokenWalletModal {...defaultProps} />);
    await findByText('ROYAL TOKENS');
    const subtitle = await findByText('Learning Allowance & Passes');
    expect(subtitle).toBeTruthy();
  });

  it('close button calls onClose', async () => {
    const onClose = jest.fn();
    const { findByText, getAllByTestId } = await render(
      <TokenWalletModal {...defaultProps} onClose={onClose} />
    );
    await findByText('ROYAL TOKENS');
    // X icon is inside the close button (TouchableOpacity rendered as View with onPress)
    const xIcons = getAllByTestId('icon-X');
    // Press the first X icon's parent (the close button View renders the icon as a child)
    await fireEvent.press(xIcons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows total words allowance from wallet', async () => {
    const { findByText } = await render(<TokenWalletModal {...defaultProps} />);
    const value = await findByText(String(BASE_WALLET_STATE.totalWordsAllowance));
    expect(value).toBeTruthy();
  });

  it('shows ads remaining text when canWatchAd is true', async () => {
    const { findByText } = await render(<TokenWalletModal {...defaultProps} />);
    await findByText('ROYAL TOKENS');
    const remaining = Math.max(0, BASE_WALLET_STATE.maxDailyAds - BASE_WALLET_STATE.adsWatchedToday);
    const adText = await findByText(`${remaining} of ${BASE_WALLET_STATE.maxDailyAds} rewarded ads left today`);
    expect(adText).toBeTruthy();
  });

  it('shows WATCH AD button when canWatchAd is true', async () => {
    const { findByText } = await render(<TokenWalletModal {...defaultProps} />);
    const btn = await findByText('WATCH AD (+1 TOKEN)');
    expect(btn).toBeTruthy();
  });

  it('shows UNLOCK UNLIMITED WITH PLUS button when canWatchAd is false', async () => {
    const { tokenWallet } = require('../../../services/tokenWallet');
    tokenWallet.getWalletStatus.mockResolvedValueOnce({
      ...BASE_WALLET_STATE,
      canWatchAd: false,
    });

    const { findByText } = await render(<TokenWalletModal {...defaultProps} />);
    const btn = await findByText('UNLOCK UNLIMITED WITH PLUS');
    expect(btn).toBeTruthy();
  });

  it('UNLOCK UNLIMITED WITH PLUS button calls onClose and onOpenPlusModal', async () => {
    const { tokenWallet } = require('../../../services/tokenWallet');
    tokenWallet.getWalletStatus.mockResolvedValueOnce({
      ...BASE_WALLET_STATE,
      canWatchAd: false,
    });

    const onClose = jest.fn();
    const onOpenPlusModal = jest.fn();
    const { findByText } = await render(
      <TokenWalletModal
        {...defaultProps}
        onClose={onClose}
        onOpenPlusModal={onOpenPlusModal}
      />
    );

    const btn = await findByText('UNLOCK UNLIMITED WITH PLUS');
    await fireEvent.press(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenPlusModal).toHaveBeenCalledTimes(1);
  });
});
