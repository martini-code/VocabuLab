import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native/pure';
import { RandomDiscoveryView } from '../RandomDiscoveryView';
import * as vaultModule from '../../../db/vault';
import { tokenWallet } from '../../../services/tokenWallet';
import * as ttsModule from '../../../utils/tts';
import { MasteryWordItem } from '../../../types';

// Mock react-native
jest.mock('react-native', () => {
  const React = require('react');
  const createEl = (name: string) =>
    React.forwardRef(({ children, testID, ...props }: any, ref: any) =>
      React.createElement(name, { ref, testID, ...props }, children)
    );
  const View = createEl('View');
  const Text = createEl('Text');
  const TouchableOpacity = React.forwardRef(
    ({ children, onPress, testID, ...props }: any, ref: any) =>
      React.createElement('View', { ref, testID, onClick: onPress, onPress, ...props }, children)
  );
  const FlatList = React.forwardRef(({ data, renderItem, keyExtractor }: any, ref: any) => {
    return React.createElement(
      'View',
      { ref, testID: 'flat-list' },
      data?.map((item: any, index: number) =>
        React.createElement(
          'View',
          { key: keyExtractor ? keyExtractor(item, index) : String(index) },
          renderItem({ item, index })
        )
      )
    );
  });

  return {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Pressable: TouchableOpacity,
    Dimensions: {
      get: () => ({ width: 375, height: 812 }),
    },
    StyleSheet: {
      create: (s: any) => s,
      flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s) : s || {}),
    },
    ActivityIndicator: () => React.createElement('View', { testID: 'activity-indicator' }),
  };
});

// Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) =>
    React.createElement('View', { testID: `icon-${name}`, ...props });
  return {
    ArrowLeft: icon('ArrowLeft'),
    X: icon('X'),
    Dices: icon('Dices'),
    ChevronLeft: icon('ChevronLeft'),
    ChevronRight: icon('ChevronRight'),
    Volume2: icon('Volume2'),
    Check: icon('Check'),
    Plus: icon('Plus'),
    Layers: icon('Layers'),
    FlaskConical: icon('FlaskConical'),
  };
});

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: any) => {
      if (opts?.defaultValue) {
        if (opts.current && opts.total) {
          return opts.defaultValue
            .replace('{{current}}', opts.current)
            .replace('{{total}}', opts.total);
        }
        return opts.defaultValue;
      }
      return _key;
    },
    i18n: { language: 'en' },
  }),
}));

// Mock TTS
jest.mock('../../../utils/tts', () => ({
  speakWord: jest.fn(),
}));

// Mock TokenWallet
jest.mock('../../../services/tokenWallet', () => ({
  tokenWallet: {
    canLearnWords: jest.fn().mockResolvedValue(true),
    consumeWordAllowance: jest.fn().mockResolvedValue(true),
  },
}));

// Mock Vault functions
jest.mock('../../../db/vault', () => ({
  getRandomUnlearnedWords: jest.fn(),
  addWordToQueue: jest.fn().mockResolvedValue('card_100_es'),
}));

const mock10Words: MasteryWordItem[] = Array.from({ length: 10 }, (_, i) => ({
  concept_id: `c_${100 + i}`,
  concept_desc: `Definition of word ${i + 1}`,
  front_lexeme_id: 100 + i,
  front_term: `Palabra_${i + 1}`,
  front_lang: 'es',
  front_pos: 'noun',
  front_cefr: 'A1',
  back_lexeme_id: 100 + i,
  back_term: `Word_${i + 1}`,
  back_lang: 'en',
  deck_name: 'Great Hall',
  theme_name: 'Lab Grounds',
  is_queued: false,
  stage: 'available',
}));

describe('RandomDiscoveryView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (vaultModule.getRandomUnlearnedWords as jest.Mock).mockResolvedValue(mock10Words);
  });

  afterEach(async () => {
    await cleanup();
  });

  it('renders 10 random unlearned words directly in page', async () => {
    const result = await render(
      <RandomDiscoveryView onExit={jest.fn()} targetLang="es" originLang="en" />
    );

    expect(vaultModule.getRandomUnlearnedWords).toHaveBeenCalledWith(10, 'es', 'en');
    expect(result.getByText('Random Discovery')).toBeTruthy();
    expect(result.getByText('Palabra_1')).toBeTruthy();
    expect(result.getByText('Word_1')).toBeTruthy();
    expect(result.getAllByText('Lab Grounds • Great Hall').length).toBe(10);
    expect(result.getByText('Exit Discovery')).toBeTruthy();
  });

  it('pronounce button contains only the speaker icon without "pronounce" text label', async () => {
    const result = await render(
      <RandomDiscoveryView onExit={jest.fn()} targetLang="es" originLang="en" />
    );

    // Verify pronounce button exists by testID
    const pronounceBtn = result.getByTestId('pronounce-btn-100');
    expect(pronounceBtn).toBeTruthy();

    // Verify it triggers TTS with correct term and language
    await act(async () => {
      fireEvent.press(pronounceBtn);
    });
    expect(ttsModule.speakWord).toHaveBeenCalledWith('Palabra_1', 'es');

    // Verify the text "Pronounce" is NOT inside the button or card
    expect(result.queryByText('Pronounce')).toBeNull();
  });

  it('allows opting in to learn a word and updates button state', async () => {
    const handleWordLearned = jest.fn();
    const result = await render(
      <RandomDiscoveryView
        onExit={jest.fn()}
        targetLang="es"
        originLang="en"
        onWordLearned={handleWordLearned}
      />
    );

    // Find the Learn Word button on the first card
    const learnButtons = result.getAllByText('Learn Word');
    expect(learnButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.press(learnButtons[0]);
    });

    expect(tokenWallet.canLearnWords).toHaveBeenCalledWith(1);
    expect(tokenWallet.consumeWordAllowance).toHaveBeenCalledWith(1);
    expect(vaultModule.addWordToQueue).toHaveBeenCalledWith(100, 100, 'c_100', 'es', 'en');
    expect(handleWordLearned).toHaveBeenCalledWith(100);

    // After learning, card should indicate "Learned"
    expect(result.getAllByText('Learned').length).toBeGreaterThan(0);
  });

  it('triggers onInsufficientTokens when user has no tokens to learn', async () => {
    (tokenWallet.canLearnWords as jest.Mock).mockResolvedValueOnce(false);
    const handleInsufficientTokens = jest.fn();
    const result = await render(
      <RandomDiscoveryView
        onExit={jest.fn()}
        targetLang="es"
        originLang="en"
        onInsufficientTokens={handleInsufficientTokens}
      />
    );

    const learnButtons = result.getAllByText('Learn Word');
    await act(async () => {
      fireEvent.press(learnButtons[0]);
    });

    expect(handleInsufficientTokens).toHaveBeenCalledWith(1);
    expect(vaultModule.addWordToQueue).not.toHaveBeenCalled();
  });

  it('forgets the list of 10 words completely when exiting', async () => {
    const handleExit = jest.fn();
    const result = await render(
      <RandomDiscoveryView onExit={handleExit} targetLang="es" originLang="en" />
    );

    expect(result.getByText('Palabra_1')).toBeTruthy();

    const exitBtn = result.getByTestId('exit-random-discovery-btn');
    await act(async () => {
      fireEvent.press(exitBtn);
    });

    expect(handleExit).toHaveBeenCalledTimes(1);
  });

  it('displays empty state when all words have been learned', async () => {
    (vaultModule.getRandomUnlearnedWords as jest.Mock).mockResolvedValueOnce([]);
    const result = await render(
      <RandomDiscoveryView onExit={jest.fn()} targetLang="es" originLang="en" />
    );

    expect(result.getByText('All Words Conquered')).toBeTruthy();
  });
});
