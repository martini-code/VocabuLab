import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import {
  getCustomDeckIcon,
  normalizeIconName,
  CustomLucideIcon,
  IconRendererProps,
} from './customDeckIcons';

import { colors } from '../../theme';

export interface DeckIconProps extends IconRendererProps {
  name?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kebab/Alias to Lucide Icon Mapping
// ─────────────────────────────────────────────────────────────────────────────

const LUCIDE_NAME_MAP: Record<string, keyof typeof LucideIcons> = {
  // Vocabulary categories & subcategories
  handshake: 'Handshake',
  family: 'Users',
  users: 'Users',
  user: 'User',
  numbers: 'Coins',
  coins: 'Coins',
  binary: 'Binary',
  hash: 'Hash',
  paw: 'PawPrint',
  'paw-print': 'PawPrint',
  animals: 'PawPrint',
  dog: 'Dog',
  cat: 'Cat',
  bug: 'Bug',
  insects: 'Bug',
  vehicles: 'Car',
  car: 'Car',
  plane: 'Plane',
  airplane: 'Plane',
  ship: 'Ship',
  boat: 'Ship',
  math: 'Calculator',
  calculator: 'Calculator',
  scale: 'Scale',
  divide: 'Divide',
  percent: 'Percent',
  electronics: 'Cpu',
  cpu: 'Cpu',
  tv: 'Tv',
  gadgets: 'Cpu',
  biology: 'Dna',
  dna: 'Dna',
  microscope: 'Microscope',
  cell: 'Dna',
  home: 'Home',
  house: 'Home',
  furniture: 'Armchair',
  armchair: 'Armchair',
  construction: 'Hammer',
  hammer: 'Hammer',
  tools: 'Wrench',
  wrench: 'Wrench',
  food: 'Apple',
  apple: 'Apple',
  utensils: 'Utensils',
  dining: 'Utensils',
  goblet: 'Wine',
  wine: 'Wine',
  coffee: 'Coffee',
  pizza: 'Pizza',
  fruits: 'Apple',
  groceries: 'ShoppingBag',
  sports: 'Trophy',
  trophy: 'Trophy',
  medal: 'Medal',
  activity: 'Activity',
  basics: 'MessageCircle',
  greetings: 'Handshake',
  'message-circle': 'MessageCircle',
  'message-square': 'MessageSquare',
  tree: 'TreePine',
  'tree-pine': 'TreePine',
  nature: 'TreePine',
  castle: 'Castle',
  swords: 'Swords',
  sword: 'Sword',
  shield: 'Shield',
  book: 'BookOpen',
  'book-open': 'BookOpen',
  library: 'Library',
  crown: 'Crown',
  'cloud-lightning': 'CloudLightning',
  weather: 'CloudLightning',
  compass: 'Compass',
  award: 'Award',
  sparkles: 'Sparkles',
  scroll: 'Scroll',
  brain: 'Brain',
  landmark: 'Landmark',
  flame: 'Flame',
  fire: 'Flame',
  network: 'Network',
  layers: 'Layers',
  globe: 'Globe',
  search: 'Search',
  heart: 'Heart',
  star: 'Star',
  sun: 'Sun',
  moon: 'Moon',
  bell: 'Bell',
  camera: 'Camera',
  music: 'Music',
  shirt: 'Shirt',
  luggage: 'Luggage',
  travel: 'Luggage',
  stethoscope: 'Stethoscope',
  health: 'Stethoscope',
  palette: 'Palette',
  art: 'Palette',
  footprints: 'Footprints',
};

/**
 * Converts any string like "book-open" or "book_open" to PascalCase "BookOpen".
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Resolves an icon component from Lucide by name.
 */
function resolveLucideComponent(name: string): React.ComponentType<any> | null {
  const normalized = normalizeIconName(name);

  // 1. Check alias dictionary
  const mappedName = LUCIDE_NAME_MAP[normalized];
  if (mappedName && (LucideIcons as any)[mappedName]) {
    return (LucideIcons as any)[mappedName];
  }

  // 2. Check PascalCase name directly from Lucide (e.g., 'BookOpen', 'ShieldCheck')
  const pascalName = toPascalCase(name);
  if ((LucideIcons as any)[pascalName]) {
    return (LucideIcons as any)[pascalName];
  }

  // 3. Direct exact match in Lucide
  if ((LucideIcons as any)[name]) {
    return (LucideIcons as any)[name];
  }

  return null;
}

/**
 * DeckIcon component:
 * Renders either a custom drawn Lucide-style icon (if registered) or an official Lucide icon.
 */
export const DeckIcon: React.FC<DeckIconProps> = React.memo(
  ({ name = 'book-open', size = 20, color = colors.neutral[500], strokeWidth = 2, style, testID }) => {
    const rawName = name || 'book-open';
    const normalized = normalizeIconName(rawName);

    // 1. Check if a custom drawn icon is registered under this name
    const customDef = getCustomDeckIcon(normalized);
    if (customDef) {
      return (
        <CustomLucideIcon
          definition={customDef}
          size={size}
          color={color}
          strokeWidth={strokeWidth}
          style={style}
          testID={testID}
        />
      );
    }

    // 2. Check if an official Lucide icon exists
    const LucideComponent = resolveLucideComponent(rawName);
    if (LucideComponent) {
      return (
        <LucideComponent
          size={size}
          color={color}
          strokeWidth={strokeWidth}
          style={style}
          testID={testID || `deck-icon-${normalized}`}
        />
      );
    }

    // 3. Graceful fallback (BookOpen)
    const FallbackIcon = LucideIcons.BookOpen || LucideIcons.Layers;
    if (FallbackIcon) {
      return (
        <FallbackIcon
          size={size}
          color={color}
          strokeWidth={strokeWidth}
          style={style}
          testID={testID || 'deck-icon-fallback'}
        />
      );
    }

    return null;
  }
);

/**
 * Convenience render helper for backward compatibility and imperative usage.
 */
export function renderDeckIcon(
  iconName: string,
  size = 20,
  color = colors.neutral[500],
  strokeWidth = 2
): React.ReactElement {
  return <DeckIcon name={iconName} size={size} color={color} strokeWidth={strokeWidth} />;
}

export {
  registerCustomDeckIcon,
  unregisterCustomDeckIcon,
  getCustomDeckIcon,
  hasCustomDeckIcon,
  getAllCustomDeckIconNames,
} from './customDeckIcons';
