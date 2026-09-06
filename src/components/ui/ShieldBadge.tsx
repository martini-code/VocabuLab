import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ShieldBadgeProps {
  level: string;
  size?: 'sm' | 'md' | 'lg';
}

const CEFR_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  A1: { bg: '#86EFAC', border: '#15803D', text: '#14532D' }, // Novice Green
  A2: { bg: '#93C5FD', border: '#1D4ED8', text: '#1E3A8A' }, // Apprentice Blue
  B1: { bg: '#FDE047', border: '#A16207', text: '#713F12' }, // Adept Gold
  B2: { bg: '#FDBA74', border: '#C2410C', text: '#7C2D12' }, // Veteran Amber
  C1: { bg: '#F472B6', border: '#BE185D', text: '#831843' }, // Master Rose
  C2: { bg: '#C084FC', border: '#7E22CE', text: '#581C87' }, // Grandmaster Arcana
};

export const ShieldBadge: React.FC<ShieldBadgeProps> = ({ level, size = 'md' }) => {
  const normalized = level?.toUpperCase() || 'A1';
  const theme = CEFR_COLORS[normalized] || CEFR_COLORS.A1;

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

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
      <Text
        style={[
          styles.text,
          {
            color: theme.text,
            fontSize: isSmall ? 10 : isLarge ? 14 : 12,
          },
        ]}
      >
        🛡️ {normalized}
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
