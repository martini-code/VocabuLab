import React, { useState } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react-native/pure';
import { ReviewCardFlipper } from '../ReviewCardFlipper';
import { CardWithDetails } from '../../../types';

// Mock react-native-reanimated worklet & animation hooks for headless React Native testing
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

// Mock lucide-react-native icons to simple View elements
jest.mock('lucide-react-native', () => {
  const React = require('react');
  return {
    Volume2: (props: any) => React.createElement('View', { testID: 'volume-icon', ...props }),
    FlaskConical: (props: any) => React.createElement('View', { testID: 'flask-icon', ...props }),
  };
});

describe('ReviewCardFlipper Integration Tests (Card Flip Interactions)', () => {
  // Properly await async cleanup() to ensure all pending act() scopes from
  // the previous test are fully flushed before the next test renders.
  afterEach(async () => {
    await cleanup();
  });

  const mockCard: CardWithDetails = {
    id: 'test-card-101',
    card_id: 101,
    target_lang: 'es',
    front_lexeme_id: 1,
    back_lexeme_id: 2,
    due_date: '2026-09-17T12:00:00.000Z',
    state: 0,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    updated_at: '2026-09-17T12:00:00.000Z',
    front_term: 'biblioteca',
    front_lang: 'es',
    front_pos: 'noun',
    front_cefr: 'A1',
    back_term: 'library',
    back_lang: 'en',
    back_pos: 'noun',
    back_cefr: 'A1',
    concept_desc: 'A building or room containing collections of books',
  };

  describe('Initial Unflipped State (Front Face Visibility)', () => {
    it('renders the front term, language tags, part-of-speech, and tap hint', async () => {
      const handleFlip = jest.fn();
      const handleSpeak = jest.fn();

      const { getAllByText, getByText, getByTestId, queryByText } = await render(
        <ReviewCardFlipper
          card={mockCard}
          isFlipped={false}
          onFlip={handleFlip}
          onSpeak={handleSpeak}
        />
      );

      // Verify front term and metadata are present
      expect(getAllByText('biblioteca').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('[noun]').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('ES ➔ EN').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('Level 1').length).toBeGreaterThanOrEqual(1);
      expect(queryByText('A1')).toBeNull();
      expect(getByText('Tap card to reveal translation')).toBeTruthy();
      expect(getByTestId('pronounce-btn')).toBeTruthy();
      expect(queryByText('Pronounce')).toBeNull();
    });
  });

  describe('Card Flip Interactions (Press & State Toggling)', () => {
    it('triggers onFlip callback when the card container is tapped', async () => {
      const handleFlip = jest.fn();
      const handleSpeak = jest.fn();

      const { getByText } = await render(
        <ReviewCardFlipper
          card={mockCard}
          isFlipped={false}
          onFlip={handleFlip}
          onSpeak={handleSpeak}
        />
      );

      // Press the front card face — fireEvent.press is async, must be awaited
      const tapPrompt = getByText('Tap card to reveal translation');
      await fireEvent.press(tapPrompt);

      expect(handleFlip).toHaveBeenCalledTimes(1);
    });

    it('displays the back translation and label when isFlipped is true', async () => {
      const handleFlip = jest.fn();
      const handleSpeak = jest.fn();

      const { getByText, getAllByText } = await render(
        <ReviewCardFlipper
          card={mockCard}
          isFlipped={true}
          onFlip={handleFlip}
          onSpeak={handleSpeak}
        />
      );

      // Back translation should be visible
      expect(getByText('TRANSLATION')).toBeTruthy();
      expect(getByText('library')).toBeTruthy();
      // Front term summary should still be present on the back card header
      expect(getAllByText('biblioteca').length).toBeGreaterThanOrEqual(1);
    });

    it('integrates flip state toggle in an interactive parent harness', async () => {
      // Interactive parent container simulating ReviewSession state
      const InteractiveReviewSessionMock = () => {
        const [flipped, setFlipped] = useState(false);
        return (
          <ReviewCardFlipper
            card={mockCard}
            isFlipped={flipped}
            onFlip={() => setFlipped((prev) => !prev)}
            onSpeak={jest.fn()}
          />
        );
      };

      const { getByText } = await render(<InteractiveReviewSessionMock />);

      // Initially unflipped: front tap prompt is visible
      expect(getByText('Tap card to reveal translation')).toBeTruthy();

      // Tap card to flip — await fireEvent.press to flush async act() scope
      await fireEvent.press(getByText('Tap card to reveal translation'));

      // Now flipped: back translation is revealed
      expect(getByText('TRANSLATION')).toBeTruthy();
      expect(getByText('library')).toBeTruthy();

      // Tap again to flip back — await to flush act() scope before next assertion
      await fireEvent.press(getByText('library'));

      // Toggled back to front face
      expect(getByText('Tap card to reveal translation')).toBeTruthy();
    });
  });

  describe('Audio & Pronunciation Triggers on Front Face', () => {
    it('calls onSpeak with front term and language without triggering unintended onFlip', async () => {
      const handleFlip = jest.fn();
      const handleSpeak = jest.fn();

      const { getByTestId } = await render(
        <ReviewCardFlipper
          card={mockCard}
          isFlipped={false}
          onFlip={handleFlip}
          onSpeak={handleSpeak}
        />
      );

      // Use testID query for the TTS button — more reliable than text matching
      // across multiple mounted trees.
      const pronounceButton = getByTestId('pronounce-btn');
      await fireEvent.press(pronounceButton);

      // onSpeak should be called with ('biblioteca', 'es')
      expect(handleSpeak).toHaveBeenCalledTimes(1);
      expect(handleSpeak).toHaveBeenCalledWith('biblioteca', 'es');
      expect(handleFlip).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases & Resiliency', () => {
    it('renders gracefully when part-of-speech is omitted', async () => {
      const cardWithoutPos: CardWithDetails = {
        ...mockCard,
        front_pos: undefined,
        back_pos: undefined,
      };

      const { queryByText, getAllByText } = await render(
        <ReviewCardFlipper
          card={cardWithoutPos}
          isFlipped={false}
          onFlip={jest.fn()}
          onSpeak={jest.fn()}
        />
      );

      expect(getAllByText('biblioteca').length).toBeGreaterThanOrEqual(1);
      expect(queryByText('[noun]')).toBeNull();
    });

    it('renders the hardest (C2) word as Level 6', async () => {
      const c2Card: CardWithDetails = {
        ...mockCard,
        front_cefr: 'C2',
      };

      const { getAllByText } = await render(
        <ReviewCardFlipper card={c2Card} isFlipped={false} onFlip={jest.fn()} onSpeak={jest.fn()} />
      );

      expect(getAllByText('Level 6').length).toBeGreaterThanOrEqual(1);
    });

    it('handles multiple flip state transitions cleanly in interactive session', async () => {
      const MultiFlipHarness = () => {
        const [flipped, setFlipped] = useState(false);
        return (
          <ReviewCardFlipper
            card={mockCard}
            isFlipped={flipped}
            onFlip={() => setFlipped((prev) => !prev)}
            onSpeak={jest.fn()}
          />
        );
      };

      const { getByText } = await render(<MultiFlipHarness />);

      // Flip 1: Front -> Back
      await fireEvent.press(getByText('Tap card to reveal translation'));
      expect(getByText('TRANSLATION')).toBeTruthy();
      expect(getByText('library')).toBeTruthy();

      // Flip 2: Back -> Front
      await fireEvent.press(getByText('library'));
      expect(getByText('Tap card to reveal translation')).toBeTruthy();

      // Flip 3: Front -> Back again
      await fireEvent.press(getByText('Tap card to reveal translation'));
      expect(getByText('TRANSLATION')).toBeTruthy();
      expect(getByText('library')).toBeTruthy();
    });
  });
});
