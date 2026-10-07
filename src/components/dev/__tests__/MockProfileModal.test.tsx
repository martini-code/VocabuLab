import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native/pure';
import { MockProfileModal } from '../MockProfileModal';
import * as mockProfilesModule from '../../../db/mockProfiles';

// ─── react-native mock ────────────────────────────────────────────────────────
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
    Modal: ({ visible, children }: any) =>
      visible ? React.createElement('View', { testID: 'modal-container' }, children) : null,
    ActivityIndicator: ({ testID }: any) =>
      React.createElement('View', { testID: testID || 'activity-indicator' }),
  };
});

// ─── lucide-react-native mock ─────────────────────────────────────────────────
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const icon = (name: string) => (props: any) =>
    React.createElement('View', { testID: `icon-${name}`, ...props });
  return {
    X: icon('X'),
    Check: icon('Check'),
    Shield: icon('Shield'),
    Zap: icon('Zap'),
    Sparkles: icon('Sparkles'),
    RefreshCw: icon('RefreshCw'),
    Layers: icon('Layers'),
  };
});

describe('MockProfileModal UI', () => {
  afterEach(async () => {
    await cleanup();
    jest.clearAllMocks();
  });

  it('renders nothing when visible is false', async () => {
    const { queryByTestId } = await render(
      <MockProfileModal visible={false} onClose={jest.fn()} />
    );
    expect(queryByTestId('modal-container')).toBeNull();
  });

  it('renders Testing Profiles title when visible is true', async () => {
    const { getByText } = await render(<MockProfileModal visible={true} onClose={jest.fn()} />);
    expect(getByText('Testing Profiles')).toBeTruthy();
    expect(getByText('Select a mock user profile to seed realistic test data')).toBeTruthy();
  });

  it('renders all four profile cards with clean professional naming', async () => {
    const { getByText } = await render(<MockProfileModal visible={true} onClose={jest.fn()} />);
    expect(getByText('Beginner Profile')).toBeTruthy();
    expect(getByText('Intermediate Profile')).toBeTruthy();
    expect(getByText('Advanced Profile')).toBeTruthy();
    expect(getByText('Clean Slate')).toBeTruthy();

    // Verify badge labels
    expect(getByText('Level 1')).toBeTruthy();
    expect(getByText('Level 2')).toBeTruthy();
    expect(getByText('Level 3')).toBeTruthy();
    expect(getByText('Reset')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', async () => {
    const onClose = jest.fn();
    const { getByTestId } = await render(<MockProfileModal visible={true} onClose={onClose} />);

    const closeBtn = getByTestId('modal-close-btn');
    await fireEvent.press(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('seeds profile and invokes onProfileApplied when a profile is selected', async () => {
    const seedSpy = jest
      .spyOn(mockProfilesModule, 'seedMockUserProfile')
      .mockResolvedValue(mockProfilesModule.USER_PROFILES.intermediate);
    const onProfileApplied = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = await render(
      <MockProfileModal
        visible={true}
        onClose={onClose}
        onProfileApplied={onProfileApplied}
        targetLang="es"
        originLang="en"
      />
    );

    const intermediateCard = getByTestId('profile-card-intermediate');
    await fireEvent.press(intermediateCard);

    expect(seedSpy).toHaveBeenCalledWith('intermediate', undefined, {
      targetLang: 'es',
      originLang: 'en',
    });
    expect(onProfileApplied).toHaveBeenCalledWith('intermediate');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('seeds clean slate profile correctly', async () => {
    const seedSpy = jest
      .spyOn(mockProfilesModule, 'seedMockUserProfile')
      .mockResolvedValue(mockProfilesModule.USER_PROFILES.clean);
    const onProfileApplied = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = await render(
      <MockProfileModal visible={true} onClose={onClose} onProfileApplied={onProfileApplied} />
    );

    const cleanCard = getByTestId('profile-card-clean');
    await fireEvent.press(cleanCard);

    expect(seedSpy).toHaveBeenCalledWith('clean', undefined, {
      targetLang: 'es',
      originLang: 'en',
    });
    expect(onProfileApplied).toHaveBeenCalledWith('clean');
    expect(onClose).toHaveBeenCalled();
  });
});
