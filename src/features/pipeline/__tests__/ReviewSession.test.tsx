import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native/pure';
import { ReviewSession } from '../ReviewSession';
import * as vaultModule from '../../../db/vault';
import { CardWithDetails, EnrolledLanguagePair } from '../../../types';

// Mock react-native
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

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: {
      View: ({ children, style, ...props }: any) =>
        React.createElement('View', { style, ...props }, children),
      Text: ({ children, style, ...props }: any) =>
        React.createElement('Text', { style, ...props }, children),
    },
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withTiming: (toValue: any) => toValue,
    interpolate: (value: any, _inRange: any, outRange: any) => outRange[0],
    Easing: {
      out: () => ({}),
      cubic: () => ({}),
    },
    runOnUI: (fn: () => any) => () => fn(),
  };
});

// Mock mascot
jest.mock('../../../components/mascot/Mascots', () => {
  const React = require('react');
  return {
    LabMascot: (props: any) =>
      React.createElement('View', { testID: 'lab-mascot', ...props }),
  };
});

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  const mockComponent = (name: string) => (props: any) =>
    React.createElement('View', { testID: `svg-${name}`, ...props }, props.children);
  return {
    __esModule: true,
    default: mockComponent('Svg'),
    Circle: mockComponent('Circle'),
    Path: mockComponent('Path'),
    Rect: mockComponent('Rect'),
    G: mockComponent('G'),
    Ellipse: mockComponent('Ellipse'),
    Polygon: mockComponent('Polygon'),
  };
});

// Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) =>
    React.createElement('View', { testID: `icon-${name}`, ...props });
  return {
    Volume2: icon('Volume2'),
    Layers: icon('Layers'),
    X: icon('X'),
    Zap: icon('Zap'),
    Globe: icon('Globe'),
    FlaskConical: icon('FlaskConical'),
    Sparkles: icon('Sparkles'),
    TrendingUp: icon('TrendingUp'),
    Brain: icon('Brain'),
    CheckCircle2: icon('CheckCircle2'),
    Clock: icon('Clock'),
    ArrowRight: icon('ArrowRight'),
    RotateCcw: icon('RotateCcw'),
  };
});

// Mock vault
jest.mock('../../../db/vault', () => ({
  getDueCards: jest.fn(),
  getDeckCardsForReview: jest.fn(),
  recordCardReview: jest.fn(),
  getEnrolledLanguagePairs: jest.fn(),
}));

// Mock tts
jest.mock('../../../utils/tts', () => ({
  speakWord: jest.fn(),
}));

const mockEnrolledPairs: EnrolledLanguagePair[] = [
  {
    id: 'es:en',
    destination_lang: 'es',
    origin_lang: 'en',
    destination_name: 'Spanish',
    origin_name: 'English',
    enrolled_at: '2026-09-01T00:00:00Z',
    progress: {
      totalCards: 20,
      dueCards: 5,
      newCards: 2,
      masteredCards: 13,
    },
  },
  {
    id: 'zh-CN:en',
    destination_lang: 'zh-CN',
    origin_lang: 'en',
    destination_name: 'Mandarin',
    origin_name: 'English',
    enrolled_at: '2026-09-05T00:00:00Z',
    progress: {
      totalCards: 15,
      dueCards: 3,
      newCards: 1,
      masteredCards: 11,
    },
  },
];

const mockSpanishCard: CardWithDetails = {
  id: 'card_1_Spanish',
  card_id: 1,
  target_lang: 'es',
  front_lexeme_id: 1,
  back_lexeme_id: 1,
  due_date: '2026-09-20T08:00:00Z',
  state: 1,
  stability: 4.0,
  difficulty: 3.0,
  elapsed_days: 1,
  scheduled_days: 2,
  reps: 2,
  lapses: 0,
  updated_at: '2026-09-20T08:00:00Z',
  front_term: 'Hola',
  front_lang: 'es',
  front_pos: 'interjection',
  front_cefr: 'A1',
  back_term: 'Hello',
  back_lang: 'en',
  back_pos: 'interjection',
  back_cefr: 'A1',
  concept_desc: 'Standard greeting',
};

const mockMandarinCard: CardWithDetails = {
  id: 'card_2_Mandarin',
  card_id: 2,
  target_lang: 'zh-CN',
  front_lexeme_id: 2,
  back_lexeme_id: 2,
  due_date: '2026-09-20T09:00:00Z',
  state: 1,
  stability: 3.5,
  difficulty: 4.0,
  elapsed_days: 1,
  scheduled_days: 2,
  reps: 1,
  lapses: 0,
  updated_at: '2026-09-20T09:00:00Z',
  front_term: '你好',
  front_lang: 'zh-CN',
  front_pos: 'phrase',
  front_cefr: 'A1',
  back_term: 'Hello',
  back_lang: 'en',
  back_pos: 'phrase',
  back_cefr: 'A1',
  concept_desc: 'Standard greeting in Mandarin',
};

describe('ReviewSession Multi-Language Learning Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (vaultModule.getEnrolledLanguagePairs as jest.Mock).mockResolvedValue(mockEnrolledPairs);
    (vaultModule.getDueCards as jest.Mock).mockResolvedValue([mockSpanishCard, mockMandarinCard]);
  });

  afterEach(async () => {
    await cleanup();
  });

  it('renders multi-language scope pills when user is enrolled in multiple languages', async () => {
    const { findByTestId, findByText } = await render(
      <ReviewSession targetLang="es" originLang="en" />
    );

    const selector = await findByTestId('review-scope-selector');
    expect(selector).toBeTruthy();

    // Total due: 5 (es) + 3 (zh-CN) = 8
    expect(await findByText('All Languages (8)')).toBeTruthy();
    expect(await findByText(/ES \(5\)/)).toBeTruthy();
    expect(await findByText(/ZH-CN \(3\)/)).toBeTruthy();
  });

  it('loads all languages combined when "All Languages" scope is selected', async () => {
    const { findByTestId } = await render(
      <ReviewSession targetLang="es" originLang="en" />
    );

    await findByTestId('review-scope-selector');
    expect(vaultModule.getDueCards).toHaveBeenCalledWith(undefined, 'all', 'en');
  });

  it('reloads queue for specific language when clicking that language scope pill', async () => {
    const { findByTestId } = await render(
      <ReviewSession targetLang="es" originLang="en" />
    );

    await findByTestId('review-scope-selector');

    const spanishPill = await findByTestId('scope-pill-es');
    await act(async () => {
      fireEvent.press(spanishPill);
    });

    expect(vaultModule.getDueCards).toHaveBeenCalledWith(undefined, 'es', 'en');
  });

  it('renders card with correct language tags after pressing Begin Review', async () => {
    const onReviewActiveChange = jest.fn();
    const { findByTestId, findAllByText, findByText } = await render(
      <ReviewSession targetLang="es" originLang="en" onReviewActiveChange={onReviewActiveChange} />
    );

    // Staging screen displays language and cards due data above Begin Review button
    expect(await findByText('DAILY REVIEW')).toBeTruthy();
    expect(await findByText('Cards Due')).toBeTruthy();
    const beginButton = await findByTestId('begin-review-button');
    expect(beginButton).toBeTruthy();

    // Press Begin Review to enter fullscreen review session
    await act(async () => {
      fireEvent.press(beginButton);
    });

    expect(onReviewActiveChange).toHaveBeenCalledWith(true);

    // Fullscreen review shows progress indicator and 'X' exit button
    expect(await findByTestId('close-review-button')).toBeTruthy();
    expect(await findByText('1 / 2')).toBeTruthy();

    // Front card shows term and language pair tag ES ➔ EN
    const termMatches = await findAllByText('Hola');
    expect(termMatches.length).toBeGreaterThanOrEqual(1);

    const langTagMatches = await findAllByText(/ES.*EN/);
    expect(langTagMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('exits active review and returns to staging when tapping the X button', async () => {
    const onReviewActiveChange = jest.fn();
    const { findByTestId, findByText } = await render(
      <ReviewSession targetLang="es" originLang="en" onReviewActiveChange={onReviewActiveChange} />
    );

    // Enter review
    const beginButton = await findByTestId('begin-review-button');
    await act(async () => {
      fireEvent.press(beginButton);
    });
    expect(onReviewActiveChange).toHaveBeenCalledWith(true);

    // Exit review via X button
    const closeButton = await findByTestId('close-review-button');
    await act(async () => {
      fireEvent.press(closeButton);
    });

    expect(onReviewActiveChange).toHaveBeenCalledWith(false);
    expect(await findByTestId('begin-review-button')).toBeTruthy();
  });
});
