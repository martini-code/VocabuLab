import React from 'react';
import { Pressable, Text, StyleSheet, View, ViewStyle, TextStyle } from 'react-native';

export type ButtonColor = 'green' | 'blue' | 'crimson' | 'amber' | 'wood' | 'slate';

interface ChunkyButtonProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  color?: ButtonColor;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

const COLOR_MAP: Record<
  ButtonColor,
  { bg: string; border: string; text: string; subtext: string }
> = {
  green: {
    bg: '#10B981', // Emerald Forest
    border: '#047857',
    text: '#FFFFFF',
    subtext: '#D1FAE5',
  },
  blue: {
    bg: '#3B82F6', // Royal Knight Blue
    border: '#1D4ED8',
    text: '#FFFFFF',
    subtext: '#DBEAFE',
  },
  crimson: {
    bg: '#EF4444', // Red Shield / Again
    border: '#B91C1C',
    text: '#FFFFFF',
    subtext: '#FEE2E2',
  },
  amber: {
    bg: '#F59E0B', // Royal Gold / Hard
    border: '#B45309',
    text: '#FFFFFF',
    subtext: '#FEF3C7',
  },
  wood: {
    bg: '#78350F', // Fortress Timber
    border: '#451A03',
    text: '#FDE68A',
    subtext: '#D97706',
  },
  slate: {
    bg: '#334155', // Castle Stone
    border: '#1E293B',
    text: '#F1F5F9',
    subtext: '#94A3B8',
  },
};

export const ChunkyButton: React.FC<ChunkyButtonProps> = ({
  title,
  subtitle,
  onPress,
  color = 'green',
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const palette = COLOR_MAP[color];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderBottomColor: palette.border,
          borderBottomWidth: pressed ? 2 : 5,
          transform: [{ translateY: pressed ? 3 : 0 }],
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={styles.contentRow} pointerEvents="none">
        {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
        <View style={styles.textColumn}>
          <Text style={[styles.title, { color: palette.text }, textStyle]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: palette.subtext }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00000015',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  textColumn: {
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
