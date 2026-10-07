import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react-native/pure';
import { ReviewSessionSummary, ReviewSessionWordSummary } from '../ReviewSessionSummary';
import { Rating } from 'ts-fsrs';

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) =>
    React.createElement('View', { testID: `icon-${name}`, ...props });
  return {
    Sparkles: icon('Sparkles'),
    TrendingUp: icon('TrendingUp'),
    Brain: icon('Brain'),
    CheckCircle2: icon('CheckCircle2'),
    Clock: icon('Clock'),
    Layers: icon('Layers'),
    ArrowRight: icon('ArrowRight'),
    RotateCcw: icon('RotateCcw'),
    Zap: icon('Zap'),
  };
});

describe('ReviewSessionSummary Integration Tests', () => {
  afterEach(async () => {
    await cleanup();
  });

  const mockItems: ReviewSessionWordSummary[] = [
    {
      cardId: 'c1',
      frontTerm: 'casa',
      frontLang: 'es',
      backTerm: 'house',
      backLang: 'en',
      frontCefr: 'A1',
      pos: 'noun',
      rating: Rating.Good,
      prevStability: 2.5,
      newStability: 6.8,
      prevDifficulty: 5.0,
      newDifficulty: 4.8,
      scheduledDays: 7,
      state: 2,
    },
    {
      cardId: 'c2',
      frontTerm: 'perro',
      frontLang: 'es',
      backTerm: 'dog',
      backLang: 'en',
      frontCefr: 'A1',
      pos: 'noun',
      rating: Rating.Easy,
      prevStability: 5.0,
      newStability: 14.2,
      prevDifficulty: 4.0,
      newDifficulty: 3.2,
      scheduledDays: 14,
      state: 2,
    },
    {
      cardId: 'c3',
      frontTerm: 'manzana',
      frontLang: 'es',
      backTerm: 'apple',
      backLang: 'en',
      frontCefr: 'A2',
      pos: 'noun',
      rating: Rating.Again,
      prevStability: 3.0,
      newStability: 0.8,
      prevDifficulty: 5.5,
      newDifficulty: 7.1,
      scheduledDays: 0,
      state: 3,
    },
  ];

  it('renders congratulatory header, deck name, and word count', async () => {
    const handleDone = jest.fn();
    const { getByText, getAllByText } = await render(
      <ReviewSessionSummary items={mockItems} deckName="Spanish Basics" onDone={handleDone} />
    );

    expect(getByText('SESSION COMPLETE!')).toBeTruthy();
    expect(getByText(/Spanish Basics/)).toBeTruthy();
    expect(getAllByText(/3 words/).length).toBeGreaterThanOrEqual(1);
  });

  it('calculates and displays overall retention rate', async () => {
    const handleDone = jest.fn();
    // 2 out of 3 were Good or Easy = 67%
    const { getByText } = await render(
      <ReviewSessionSummary items={mockItems} onDone={handleDone} />
    );

    expect(getByText('Session Retention Rate')).toBeTruthy();
    expect(getByText('67%')).toBeTruthy();
    expect(getByText('2 of 3 words successfully recalled')).toBeTruthy();
  });

  it('displays response breakdown counts for Again, Hard, Good, Easy', async () => {
    const handleDone = jest.fn();
    const { getByText } = await render(
      <ReviewSessionSummary items={mockItems} onDone={handleDone} />
    );

    expect(getByText('Response Breakdown')).toBeTruthy();
    expect(getByText('Again: 1')).toBeTruthy();
    expect(getByText('Hard: 0')).toBeTruthy();
    expect(getByText('Good: 1')).toBeTruthy();
    expect(getByText('Easy: 1')).toBeTruthy();
  });

  it('displays session high-level stats grid (Avg Stability, Mastered, Algorithm)', async () => {
    const handleDone = jest.fn();
    const { getByText } = await render(
      <ReviewSessionSummary items={mockItems} onDone={handleDone} />
    );

    expect(getByText('Avg Stability Gain')).toBeTruthy();
    expect(getByText('Mastered (S ≥ 10d)')).toBeTruthy();
    expect(getByText('FSRS v5')).toBeTruthy();
    expect(getByText('SRS Algorithm')).toBeTruthy();
  });

  it('renders word-by-word list with FSRS stability and difficulty metrics', async () => {
    const handleDone = jest.fn();
    const { getByText, getAllByText } = await render(
      <ReviewSessionSummary items={mockItems} onDone={handleDone} />
    );

    // Front & Back terms
    expect(getByText('casa')).toBeTruthy();
    expect(getByText('house')).toBeTruthy();
    expect(getByText('perro')).toBeTruthy();
    expect(getByText('dog')).toBeTruthy();
    expect(getByText('manzana')).toBeTruthy();
    expect(getByText('apple')).toBeTruthy();

    // Rating badges
    expect(getByText('GOOD')).toBeTruthy();
    expect(getByText('EASY')).toBeTruthy();
    expect(getByText('AGAIN')).toBeTruthy();

    // FSRS Stability and Difficulty labels
    expect(getAllByText('Memory Stability').length).toBe(3);
    expect(getAllByText('FSRS Difficulty').length).toBe(3);

    // Specific stability values and gains
    expect(getByText('6.8d')).toBeTruthy();
    expect(getByText('(+4.3d)')).toBeTruthy();
    expect(getByText('14.2d')).toBeTruthy();
    expect(getByText('(+9.2d)')).toBeTruthy();
    expect(getByText('0.8d')).toBeTruthy();
    expect(getByText('(-2.2d)')).toBeTruthy();

    // Specific difficulty values
    expect(getByText('4.8 / 10')).toBeTruthy();
    expect(getByText('3.2 / 10')).toBeTruthy();
    expect(getByText('7.1 / 10')).toBeTruthy();

    // Scheduled review interval
    expect(getByText(/7d/)).toBeTruthy();
    expect(getByText(/14d/)).toBeTruthy();
    expect(getByText(/Today/)).toBeTruthy();
  });

  it('triggers onDone when CONTINUE button is pressed', async () => {
    const handleDone = jest.fn();
    const { getByText } = await render(
      <ReviewSessionSummary items={mockItems} onDone={handleDone} />
    );

    await fireEvent.press(getByText('CONTINUE'));
    expect(handleDone).toHaveBeenCalledTimes(1);
  });

  it('triggers onExploreArchives and onTrainAgain when clicked', async () => {
    const handleDone = jest.fn();
    const handleExplore = jest.fn();
    const handleTrainAgain = jest.fn();

    const { getByText } = await render(
      <ReviewSessionSummary
        items={mockItems}
        onDone={handleDone}
        onExploreArchives={handleExplore}
        onTrainAgain={handleTrainAgain}
      />
    );

    await fireEvent.press(getByText('EXPLORE MORE DECKS'));
    expect(handleExplore).toHaveBeenCalledTimes(1);

    await fireEvent.press(getByText('REFRESH QUEUE'));
    expect(handleTrainAgain).toHaveBeenCalledTimes(1);
  });

  it('handles single item with 100% recall gracefully', async () => {
    const singleItem: ReviewSessionWordSummary[] = [
      {
        cardId: 'c1',
        frontTerm: 'hola',
        frontLang: 'es',
        backTerm: 'hello',
        backLang: 'en',
        rating: Rating.Good,
        prevStability: 1.0,
        newStability: 4.0,
        prevDifficulty: 5.0,
        newDifficulty: 5.0,
        scheduledDays: 4,
        state: 2,
      },
    ];

    const { getByText, getAllByText } = await render(
      <ReviewSessionSummary items={singleItem} onDone={jest.fn()} />
    );

    expect(getByText('100%')).toBeTruthy();
    expect(getAllByText(/1 word/).length).toBeGreaterThanOrEqual(1);
    expect(getByText('1 of 1 words successfully recalled')).toBeTruthy();
  });
});
