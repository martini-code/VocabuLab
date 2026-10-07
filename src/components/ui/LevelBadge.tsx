import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlaskConical } from 'lucide-react-native';
import { levelColorsFor, levelLabel } from '../../theme';

interface LevelBadgeProps {
  /** The CEFR code stored in the database (A1–C2) or a difficulty number (1–6). */
  level: string | number;
  size?: 'sm' | 'md' | 'lg';
}

/** Shows a word's or deck's difficulty as "Level 1"–"Level 6" on the easy-to-hard color ramp. */
export const LevelBadge: React.FC<LevelBadgeProps> = ({ level, size = 'md' }) => {
  const c = levelColorsFor(level);
  const theme = { bg: c.solid, border: c.solidBorder, text: c.onSolid };

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';
  const iconSize = isSmall ? 10 : isLarge ? 14 : 12;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: theme.bg,
          borderColor: theme.border,
          paddingHorizontal: isSmall ? 8 : isLarge ? 16 : 12,
          paddingVertical: isSmall ? 2 : isLarge ? 6 : 4,
          borderBottomWidth: isSmall ? 2 : 3,
        },
      ]}
    >
      <FlaskConical size={iconSize} color={theme.text} style={{ marginRight: 4 }} />
      <Text
        style={[
          styles.text,
          {
            color: theme.text,
            fontSize: isSmall ? 10 : isLarge ? 14 : 12,
          },
        ]}
      >
        {levelLabel(level)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
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
