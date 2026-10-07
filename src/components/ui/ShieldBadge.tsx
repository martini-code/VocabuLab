import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Shield } from 'lucide-react-native';
import { cefrColors } from '../../theme';

interface ShieldBadgeProps {
  level: string;
  size?: 'sm' | 'md' | 'lg';
}

const CEFR_COLORS: Record<string, { bg: string; border: string; text: string }> = Object.fromEntries(
  Object.entries(cefrColors).map(([level, c]) => [
    level,
    { bg: c.solid, border: c.solidBorder, text: c.onSolid },
  ])
);

export const ShieldBadge: React.FC<ShieldBadgeProps> = ({ level, size = 'md' }) => {
  const normalized = level?.toUpperCase() || 'A1';
  const theme = CEFR_COLORS[normalized] || CEFR_COLORS.A1;

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';
  const iconSize = isSmall ? 10 : isLarge ? 14 : 12;

  return (
    <View
      style={[
        styles.shield,
        {
          backgroundColor: theme.bg,
          borderColor: theme.border,
          paddingHorizontal: isSmall ? 8 : isLarge ? 16 : 12,
          paddingVertical: isSmall ? 2 : isLarge ? 6 : 4,
          borderBottomWidth: isSmall ? 2 : 3,
        },
      ]}
    >
      <Shield size={iconSize} color={theme.text} style={{ marginRight: 4 }} />
      <Text
        style={[
          styles.text,
          {
            color: theme.text,
            fontSize: isSmall ? 10 : isLarge ? 14 : 12,
          },
        ]}
      >
        {normalized}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  shield: {
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
