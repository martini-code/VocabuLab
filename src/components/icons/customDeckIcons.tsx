import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon, G } from 'react-native-svg';

export interface IconRendererProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: any;
  testID?: string;
}

export type CustomIconDrawingFunction = (props: {
  size: number;
  color: string;
  strokeWidth: number;
}) => React.ReactNode;

export interface CustomIconDefinition {
  name: string;
  paths?: string[];
  render?: CustomIconDrawingFunction;
  viewBox?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Icon Registry
// ─────────────────────────────────────────────────────────────────────────────

const customIconRegistry = new Map<string, CustomIconDefinition>();

/**
 * Normalizes an icon name for consistent key lookup (kebab-case, lowercase).
 */
export function normalizeIconName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

/**
 * Registers a custom deck icon that renders in the signature Lucide aesthetic:
 * - 24x24 viewBox coordinate space
 * - Monoline stroke (default 2px)
 * - strokeLinecap="round" and strokeLinejoin="round"
 * - fill="none"
 *
 * Can be registered with:
 * 1. An array of SVG path `d` strings:
 *    registerCustomDeckIcon('quill', ['M19 3a4 4 0 0 0-4 4...'])
 * 2. A CustomIconDefinition with paths or custom render function:
 *    registerCustomDeckIcon('potion', {
 *      render: ({ color, strokeWidth }) => <Path d="..." />
 *    })
 * 3. A custom drawing function directly.
 */
export function registerCustomDeckIcon(
  name: string,
  definitionOrPathsOrFn: CustomIconDefinition | string[] | CustomIconDrawingFunction
): void {
  const normalizedKey = normalizeIconName(name);

  if (Array.isArray(definitionOrPathsOrFn)) {
    customIconRegistry.set(normalizedKey, {
      name,
      paths: definitionOrPathsOrFn,
    });
  } else if (typeof definitionOrPathsOrFn === 'function') {
    customIconRegistry.set(normalizedKey, {
      name,
      render: definitionOrPathsOrFn,
    });
  } else {
    customIconRegistry.set(normalizedKey, {
      ...definitionOrPathsOrFn,
      name,
    });
  }
}

export function unregisterCustomDeckIcon(name: string): boolean {
  return customIconRegistry.delete(normalizeIconName(name));
}

export function getCustomDeckIcon(name: string): CustomIconDefinition | undefined {
  return customIconRegistry.get(normalizeIconName(name));
}

export function hasCustomDeckIcon(name: string): boolean {
  return customIconRegistry.has(normalizeIconName(name));
}

export function getAllCustomDeckIconNames(): string[] {
  return Array.from(customIconRegistry.keys());
}

// ─────────────────────────────────────────────────────────────────────────────
// Lucide-Style Custom Icon Component
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomLucideIconProps extends IconRendererProps {
  definition: CustomIconDefinition;
}

export const CustomLucideIcon: React.FC<CustomLucideIconProps> = ({
  definition,
  size = 20,
  color = '#64748B',
  strokeWidth = 2,
  style,
  testID,
}) => {
  const viewBox = definition.viewBox || '0 0 24 24';
  const effectiveTestId = testID || `custom-icon-${normalizeIconName(definition.name)}`;

  return (
    <Svg
      testID={effectiveTestId}
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {definition.paths &&
        definition.paths.map((d, index) => (
          <Path key={`path-${index}`} d={d} stroke={color} strokeWidth={strokeWidth} fill="none" />
        ))}
      {definition.render && definition.render({ size, color, strokeWidth })}
    </Svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-Registered Built-In Custom Deck Icons (Crafted in Lucide Style)
// ─────────────────────────────────────────────────────────────────────────────

// 1. Potion Bottle: alchemical glass flask with neck, stopper, and liquid wave
registerCustomDeckIcon('custom-potion', {
  name: 'custom-potion',
  render: ({ color, strokeWidth }) => (
    <G stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M9 2h6" />
      <Path d="M10 2v3" />
      <Path d="M14 2v3" />
      <Path d="M14 5l3.5 6A6 6 0 1 1 6.5 11L10 5h4z" />
      <Path d="M7 14c1.5 1 3.5-1 5 0s3.5-1 5 0" />
      <Circle cx="12" cy="10" r="0.75" />
    </G>
  ),
});

// 2. Quill Pen: vintage writing feather with nib and ink slit
registerCustomDeckIcon('custom-quill', {
  name: 'custom-quill',
  render: ({ color, strokeWidth }) => (
    <G stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M19 3a4 4 0 0 0-4 4v2L4 20l-1 1 2-1 11-11h2a4 4 0 0 0 4-4c0-1-1-2-3-2z" />
      <Path d="M10 13l3-3" />
      <Path d="M3 21l2.5-1" />
    </G>
  ),
});

// 3. Ancient Scroll: rolled parchment scroll with seal ribbon
registerCustomDeckIcon('custom-scroll', {
  name: 'custom-scroll',
  render: ({ color, strokeWidth }) => (
    <G stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M19 17V5a2 2 0 0 0-2-2H4" />
      <Path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" />
      <Path d="M9 8h6" />
      <Path d="M9 12h4" />
    </G>
  ),
});

// 4. Faceted Gem: cut gemstone with table and facet vertices
registerCustomDeckIcon('custom-gem', {
  name: 'custom-gem',
  render: ({ color, strokeWidth }) => (
    <G stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M6 3h12l4 6-10 12L2 9z" />
      <Path d="M2 9h20" />
      <Path d="M12 21L8 9l4-6 4 6-4 12" />
    </G>
  ),
});

// 5. Runestone: ancient engraved monolith with carved runes
registerCustomDeckIcon('custom-runestone', {
  name: 'custom-runestone',
  render: ({ color, strokeWidth }) => (
    <G stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M7 21l2-16a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2l2 16H7z" />
      <Path d="M12 7v10" />
      <Path d="M12 9l3-2" />
      <Path d="M12 13l3-2" />
      <Line x1="5" y1="21" x2="19" y2="21" />
    </G>
  ),
});

// 6. Shield Crest: heraldic four-quadrant coat-of-arms
registerCustomDeckIcon('custom-shield-crest', {
  name: 'custom-shield-crest',
  render: ({ color, strokeWidth }) => (
    <G stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="M12 2v20" />
      <Path d="M4 11h16" />
    </G>
  ),
});
