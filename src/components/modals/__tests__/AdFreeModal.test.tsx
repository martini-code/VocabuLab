import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import { AdFreeModal } from '../AdFreeModal';
import en from '../../../locales/en/common.json';

const mockEn = en;

const mockPurchase = jest.fn();

jest.mock('../../../services/iapService', () => ({
  IAP_SKUS: { AD_FREE_MONTHLY: 'lab_pass_monthly' },
  DEFAULT_PRODUCTS: [],
  iapService: {
    getProducts: jest.fn(async () => []),
    purchase: (sku: string) => mockPurchase(sku),
    restore: jest.fn(async () => ({ restored: false })),
    setSimulatedAdFree: jest.fn(async () => {}),
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const value = key.split('.').reduce<any>((node, part) => node?.[part], mockEn);
      return typeof value === 'string' ? value : key;
    },
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
  const TouchableOpacity = React.forwardRef(({ children, onPress, ...props }: any, ref: any) =>
    React.createElement('View', { ref, onPress, onClick: onPress, ...props }, children)
  );
  return {
    View: el('View'),
    Text: el('Text'),
    ScrollView: el('ScrollView'),
    TouchableOpacity,
    ActivityIndicator: el('ActivityIndicator'),
    Modal: ({ visible, children }: any) =>
      visible ? React.createElement('View', {}, children) : null,
    StyleSheet: { create: (s: any) => s, flatten: (s: any) => s },
  };
});

describe('AdFreeModal', () => {
  afterEach(async () => {
    await cleanup();
    mockPurchase.mockReset();
  });

  it('sells unlimited words without ads and the lab perks', async () => {
    const { getByText, queryByText } = await render(
      <AdFreeModal visible onClose={() => {}} isAdFree={false} />
    );
    await act(async () => {});

    expect(getByText(en.ad_free.benefit_unlimited)).toBeTruthy();
    expect(getByText(en.ad_free.benefit_no_ads)).toBeTruthy();
    expect(getByText(en.ad_free.perk_sparks)).toBeTruthy();
    expect(getByText(en.ad_free.price_monthly)).toBeTruthy();
    expect(queryByText(/sponsor/i)).toBeNull();
  });

  it('subscribes from the plan card', async () => {
    mockPurchase.mockResolvedValue({ success: true });
    const onStatusChanged = jest.fn();
    const { getByText } = await render(
      <AdFreeModal visible onClose={() => {}} isAdFree={false} onStatusChanged={onStatusChanged} />
    );
    await act(async () => {
      fireEvent.press(getByText(en.ad_free.subscribe_cta));
    });

    expect(mockPurchase).toHaveBeenCalledWith('lab_pass_monthly');
    expect(onStatusChanged).toHaveBeenCalledWith(true);
    expect(getByText(en.ad_free.purchase_success)).toBeTruthy();
  });

  it('shows what is active instead of the plan for pass holders', async () => {
    const { getByText, queryByText } = await render(
      <AdFreeModal visible onClose={() => {}} isAdFree />
    );
    await act(async () => {});

    expect(getByText(en.ad_free.purchased_badge)).toBeTruthy();
    expect(getByText(en.ad_free.perk_sparks)).toBeTruthy();
    expect(queryByText(en.ad_free.subscribe_cta)).toBeNull();
  });
});
