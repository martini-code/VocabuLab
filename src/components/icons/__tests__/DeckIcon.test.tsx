import React from 'react';
import { render, cleanup } from '@testing-library/react-native/pure';
import {
  DeckIcon,
  renderDeckIcon,
  registerCustomDeckIcon,
  unregisterCustomDeckIcon,
  getCustomDeckIcon,
  hasCustomDeckIcon,
  getAllCustomDeckIconNames,
} from '../DeckIcon';
import { Circle, Path } from 'react-native-svg';

describe('DeckIcon & Custom Icon Drawing Engine', () => {
  afterEach(async () => {
    await cleanup();
    unregisterCustomDeckIcon('test-temp-icon');
    unregisterCustomDeckIcon('test-drawing-fn-icon');
  });

  describe('Lucide Icon Rendering', () => {
    it('renders a Lucide icon by canonical name', async () => {
      const { getByTestId } = await render(
        <DeckIcon name="castle" size={24} color="#B45309" testID="test-castle" />
      );
      expect(getByTestId('test-castle')).toBeTruthy();
    });

    it('renders Lucide icons by category aliases', async () => {
      const { getByTestId: getFamily } = await render(
        <DeckIcon name="family" testID="icon-family" />
      );
      expect(getFamily('icon-family')).toBeTruthy();

      const { getByTestId: getVehicles } = await render(
        <DeckIcon name="vehicles" testID="icon-vehicles" />
      );
      expect(getVehicles('icon-vehicles')).toBeTruthy();

      const { getByTestId: getFood } = await render(
        <DeckIcon name="food" testID="icon-food" />
      );
      expect(getFood('icon-food')).toBeTruthy();
    });

    it('normalizes icon names across kebab, snake, and PascalCase', async () => {
      const { getByTestId: getKebab } = await render(
        <DeckIcon name="cloud-lightning" testID="kebab-lightning" />
      );
      expect(getKebab('kebab-lightning')).toBeTruthy();

      const { getByTestId: getSnake } = await render(
        <DeckIcon name="cloud_lightning" testID="snake-lightning" />
      );
      expect(getSnake('snake-lightning')).toBeTruthy();

      const { getByTestId: getPascal } = await render(
        <DeckIcon name="CloudLightning" testID="pascal-lightning" />
      );
      expect(getPascal('pascal-lightning')).toBeTruthy();
    });

    it('falls back gracefully to BookOpen/Layers when an unknown icon is provided', async () => {
      const { getByTestId } = await render(
        <DeckIcon name="unknown-obscure-glyph-999" />
      );
      expect(getByTestId('deck-icon-fallback')).toBeTruthy();
    });
  });

  describe('Custom Lucide-Style Drawn Icons', () => {
    it('includes built-in custom drawn deck icons', () => {
      expect(hasCustomDeckIcon('custom-potion')).toBe(true);
      expect(hasCustomDeckIcon('custom-quill')).toBe(true);
      expect(hasCustomDeckIcon('custom-scroll')).toBe(true);
      expect(hasCustomDeckIcon('custom-gem')).toBe(true);
      expect(hasCustomDeckIcon('custom-runestone')).toBe(true);
      expect(hasCustomDeckIcon('custom-shield-crest')).toBe(true);
    });

    it('renders built-in custom drawn icons with Lucide SVG styling', async () => {
      const { getByTestId: getPotion } = await render(
        <DeckIcon name="custom-potion" size={22} color="#059669" />
      );
      expect(getPotion('custom-icon-custom-potion')).toBeTruthy();

      const { getByTestId: getQuill } = await render(
        <DeckIcon name="custom-quill" size={20} color="#78350F" />
      );
      expect(getQuill('custom-icon-custom-quill')).toBeTruthy();
    });

    it('allows registering custom icons via SVG path strings array', async () => {
      registerCustomDeckIcon('test-temp-icon', [
        'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      ]);

      expect(hasCustomDeckIcon('test-temp-icon')).toBe(true);
      const def = getCustomDeckIcon('test-temp-icon');
      expect(def?.paths).toHaveLength(1);

      const { getByTestId } = await render(
        <DeckIcon name="test-temp-icon" size={24} color="#D97706" />
      );
      expect(getByTestId('custom-icon-test-temp-icon')).toBeTruthy();
    });

    it('allows drawing custom icons using a render function with vector primitives', async () => {
      registerCustomDeckIcon('test-drawing-fn-icon', {
        name: 'test-drawing-fn-icon',
        render: ({ color, strokeWidth }) => (
          <>
            <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} testID="custom-drawn-circle" />
            <Path d="M12 7v5l3 3" stroke={color} strokeWidth={strokeWidth} testID="custom-drawn-hand" />
          </>
        ),
      });

      const { getByTestId } = await render(
        <DeckIcon name="test-drawing-fn-icon" size={28} color="#2563EB" strokeWidth={2.5} />
      );

      expect(getByTestId('custom-icon-test-drawing-fn-icon')).toBeTruthy();
      expect(getByTestId('custom-drawn-circle')).toBeTruthy();
      expect(getByTestId('custom-drawn-hand')).toBeTruthy();
    });

    it('unregisters custom icons correctly', () => {
      registerCustomDeckIcon('test-temp-icon', ['M0 0']);
      expect(hasCustomDeckIcon('test-temp-icon')).toBe(true);

      const removed = unregisterCustomDeckIcon('test-temp-icon');
      expect(removed).toBe(true);
      expect(hasCustomDeckIcon('test-temp-icon')).toBe(false);
    });

    it('lists all registered custom icon names', () => {
      const names = getAllCustomDeckIconNames();
      expect(names).toContain('custom-potion');
      expect(names).toContain('custom-quill');
      expect(names).toContain('custom-gem');
    });
  });

  describe('renderDeckIcon imperative helper', () => {
    it('returns a valid element for Lucide and custom icons', async () => {
      const element = renderDeckIcon('custom-scroll', 20, '#B45309');
      const { getByTestId } = await render(element);
      expect(getByTestId('custom-icon-custom-scroll')).toBeTruthy();
    });
  });
});
