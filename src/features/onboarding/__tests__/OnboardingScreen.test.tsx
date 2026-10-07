import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native/pure';

jest.mock('react-native', () => {
  const React = require('react');
  const createEl = (name: string) =>
    React.forwardRef(({ children, ...props }: any, ref: any) => React.createElement(name, { ref, ...props }, children));
  const Pressable = React.forwardRef(({ children, onPress, disabled, style, ...props }: any, ref: any) =>
    React.createElement(
      'View',
      { ref, onPress: disabled ? undefined : onPress, accessibilityState: { disabled }, ...props },
      typeof children === 'function' ? children({ pressed: false }) : children
    )
  );
  return {
    View: createEl('View'),
    Text: createEl('Text'),
    ScrollView: createEl('ScrollView'),
    Pressable,
    TextInput: createEl('TextInput'),
    ActivityIndicator: createEl('ActivityIndicator'),
    FlatList: ({ data, renderItem, ListEmptyComponent }: any) =>
      React.createElement(
        'View',
        null,
        data.length === 0
          ? ListEmptyComponent
          : data.map((item: any, index: number) =>
              React.createElement(React.Fragment, { key: index }, renderItem({ item, index }))
            )
      ),
    StyleSheet: {
      create: (s: any) => s,
      flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s) : s || {}),
    },
  };
});

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = () => () => React.createElement('View');
  return { Check: icon(), Search: icon(), X: icon() };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      const text = opts?.defaultValue ?? key;
      return text.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''));
    },
  }),
}));

jest.mock('../../../components/mascot/Mascots', () => {
  const React = require('react');
  return { LexMascot: ({ mood }: any) => React.createElement('View', { testID: `lex-${mood}` }) };
});

const mockComplete = jest.fn();
const mockIsDownloaded = jest.fn();
jest.mock('../../../db/vault', () => ({
  completeOnboarding: (...args: any[]) => mockComplete(...args),
  isLanguageDownloaded: (...args: any[]) => mockIsDownloaded(...args),
}));

const mockDownload = jest.fn();
jest.mock('../../../db/downloader', () => ({
  downloadLanguagePack: (...args: any[]) => mockDownload(...args),
}));

import { OnboardingScreen } from '../OnboardingScreen';

describe('OnboardingScreen', () => {
  beforeEach(() => {
    mockComplete.mockReset().mockImplementation(async (sel: any) => ({
      origin_lang: sel.origin_lang,
      destination_lang: sel.targets[0].destination_lang,
    }));
    mockIsDownloaded.mockReset().mockImplementation(async (code: string) => code === 'en');
    mockDownload.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('walks through language, pairs, levels and grading, then saves every choice', async () => {
    const onComplete = jest.fn();
    const screen = await render(<OnboardingScreen initialOrigin="en" onComplete={onComplete} />);

    // Step 1: the device language is preselected as the native language
    expect(screen.getByTestId('onboarding-origin-en').props.accessibilityState).toEqual({ checked: true });
    await fireEvent.press(screen.getByTestId('onboarding-next'));

    // Step 2: native language is not offered; nothing picked yet blocks Continue
    expect(screen.queryByTestId('onboarding-target-en')).toBeNull();
    expect(screen.getByText('Pick at least one language')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-target-es'));
    await fireEvent.press(screen.getByTestId('onboarding-target-ja'));
    await fireEvent.press(screen.getByTestId('onboarding-next'));

    // Step 3: one level row per language, A1 by default
    expect(screen.getAllByText('Level 1 · Beginner')).toHaveLength(2);
    expect(screen.queryByText('B1')).toBeNull();
    await fireEvent.press(screen.getByTestId('onboarding-level-es-B1'));
    expect(screen.getByText('Level 3 · Intermediate')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-next'));

    // Step 4: grading guide explains all four buttons
    expect(screen.getByText('How to grade yourself')).toBeTruthy();
    for (const label of ['Again', 'Hard', 'Good', 'Easy']) expect(screen.getByText(label)).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByTestId('onboarding-next'));
    });

    expect(mockDownload.mock.calls.map((c) => c[0])).toEqual(['es', 'ja']);
    expect(mockComplete).toHaveBeenCalledWith({
      origin_lang: 'en',
      targets: [
        { destination_lang: 'es', level: 'B1' },
        { destination_lang: 'ja', level: 'A1' },
      ],
    });
    expect(onComplete).toHaveBeenCalledWith({ origin_lang: 'en', destination_lang: 'es' });
  });

  it('drops a learning language that becomes the native language', async () => {
    const screen = await render(<OnboardingScreen initialOrigin="en" onComplete={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    await fireEvent.press(screen.getByTestId('onboarding-target-es'));
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    await fireEvent.press(screen.getByTestId('onboarding-origin-es'));
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(screen.getByText('Pick at least one language')).toBeTruthy();
  });

  it('shows an error and lets the learner retry when setup fails', async () => {
    mockDownload.mockRejectedValueOnce(new Error('disk full'));
    const onComplete = jest.fn();
    const screen = await render(<OnboardingScreen initialOrigin="en" onComplete={onComplete} />);
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    await fireEvent.press(screen.getByTestId('onboarding-target-fr'));
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    await act(async () => {
      await fireEvent.press(screen.getByTestId('onboarding-next'));
    });
    expect(screen.getByText(/couldn't set up your languages/)).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      await fireEvent.press(screen.getByTestId('onboarding-next'));
    });
    expect(onComplete).toHaveBeenCalled();
  });
});
