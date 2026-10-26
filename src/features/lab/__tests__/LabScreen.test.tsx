import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import { LabScreen } from '../LabScreen';
import * as vault from '../../../db/vault';

jest.mock('../../../db/vault', () => ({
  getSetting: jest.fn(async () => null),
  setSetting: jest.fn(async () => {}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts: Record<string, unknown> = {}) =>
      String(opts.defaultValue ?? _key).replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k])),
  }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const Icon = () => React.createElement('Icon');
  return new Proxy({}, { get: () => Icon });
});

jest.mock('react-native', () => {
  const React = require('react');
  const el = (name: string) =>
    React.forwardRef(({ children, ...props }: any, ref: any) =>
      React.createElement(name, { ref, ...props }, children)
    );
  const Pressable = React.forwardRef(({ children, onPress, ...props }: any, ref: any) =>
    React.createElement('View', { ref, onPress, onClick: onPress, ...props }, children)
  );
  class Value {
    v: number;
    constructor(initial: number) {
      this.v = initial;
    }
    setValue(next: number) {
      this.v = next;
    }
    interpolate() {
      return 0;
    }
  }
  class ValueXY {
    v: { x: number; y: number };
    constructor(initial: { x: number; y: number }) {
      this.v = initial;
    }
    setValue(next: { x: number; y: number }) {
      this.v = next;
    }
    getTranslateTransform() {
      return [{ translateX: this.v.x }, { translateY: this.v.y }];
    }
  }
  const anim = () => ({ start: () => {}, stop: () => {} });
  return {
    View: el('View'),
    Text: el('Text'),
    ScrollView: el('ScrollView'),
    Pressable,
    StyleSheet: {
      create: (s: any) => s,
      absoluteFill: {},
      flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s) : s || {}),
    },
    Animated: {
      View: el('AnimatedView'),
      Value,
      ValueXY,
      timing: anim,
      loop: anim,
      sequence: anim,
    },
    Easing: { inOut: () => () => 0, quad: () => 0, sin: () => 0 },
    PanResponder: { create: () => ({ panHandlers: {} }) },
  };
});

const flush = () => act(async () => {});

describe('LabScreen', () => {
  afterEach(cleanup);

  const renderLab = async (dueCards: number) => {
    const onStartReview = jest.fn();
    const utils = await render(
      <LabScreen
        dueCards={dueCards}
        streakDays={0}
        learnedCards={0}
        masteredCards={0}
        onStartReview={onStartReview}
      />
    );
    await flush();
    await act(async () => {
      fireEvent(utils.getByTestId('lab-room'), 'layout', {
        nativeEvent: { layout: { width: 390, height: 600 } },
      });
    });
    return { ...utils, onStartReview };
  };

  it('shows Lex asking for a review when cards are due and opens it from the bubble', async () => {
    const { getByText, getAllByText, onStartReview } = await renderLab(12);
    expect(getByText('12 words due. Help me review?')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getAllByText('Review')[0]);
    });
    expect(onStartReview).toHaveBeenCalled();
  });

  it('tapping Lex starts the review when cards are due', async () => {
    const { getByLabelText, onStartReview } = await renderLab(3);
    await act(async () => {
      fireEvent.press(getByLabelText('Lex. Tap to start reviewing.'));
    });
    expect(onStartReview).toHaveBeenCalled();
  });

  it('relaxes when nothing is due and reacts to a tap', async () => {
    const { getByText, getByLabelText } = await renderLab(0);
    expect(getByText('All caught up! Tap something and I will use it.')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByLabelText('Lex. Tap to say hi.'));
    });
    expect(getByText('Hi there! We are all caught up.')).toBeTruthy();
  });

  it('sends Lex to a tapped item and nudges back to studying', async () => {
    const { getByText, getByLabelText } = await renderLab(12);
    await act(async () => {
      fireEvent.press(
        getByLabelText('Window. Tap to send Lex here, long press to make it his favorite spot.')
      );
    });
    expect(getByText('Just for a bit… we still have 12 cards!')).toBeTruthy();
  });

  it('long-pressing an item makes it the favorite spot and saves it', async () => {
    const { getByText, getByLabelText } = await renderLab(0);
    await act(async () => {
      fireEvent(
        getByLabelText('Round rug. Tap to send Lex here, long press to make it his favorite spot.'),
        'longPress'
      );
    });
    expect(getByText('The round rug is my favorite spot now!')).toBeTruthy();
    expect(vault.setSetting).toHaveBeenCalledWith(
      'lab_state_v1',
      expect.stringContaining('"favorite":"rug"')
    );
  });

  it('opens arrange mode and the shop', async () => {
    const { getByTestId, getByText } = await renderLab(0);
    await act(async () => {
      fireEvent.press(getByTestId('lab-decorate'));
    });
    expect(getByText('Storage')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText('Get more'));
    });
    expect(getByText('Lab shop')).toBeTruthy();
  });
});
