import React from 'react';
import { Pressable, Text, StyleSheet, View, ViewStyle, TextStyle } from 'react-native';
import { colors, withAlpha } from '../../theme';

/**
 * primary   – brand blue, the main call to action
 * secondary – blue mist with brand text, for alternate actions
 * ink       – Lex's suit black, for bold secondary actions
 * success / warning / danger – feedback & grading (Good / Hard / Again)
 */
export type ButtonColor = 'primary' | 'secondary' | 'ink' | 'success' | 'warning' | 'danger';

interface ChunkyButtonProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  color?: ButtonColor;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  testID?: string;
}

const COLOR_MAP: Record<
  ButtonColor,
  { bg: string; border: string; text: string; subtext: string }
> = {
  primary: {
    bg: colors.primary[500],
    border: colors.primary[700],
    text: colors.neutral[0],
    subtext: colors.primary[100],
  },
  secondary: {
    bg: colors.primary[100],
    border: colors.primary[300],
    text: colors.primary[800],
    subtext: colors.primary[700],
  },
  ink: {
    bg: colors.neutral[800],
    border: colors.neutral[900],
    text: colors.neutral[0],
    subtext: colors.primary[300],
  },
  success: {
    bg: colors.success[500],
    border: colors.success[700],
    text: colors.neutral[0],
    subtext: colors.success[100],
  },
  warning: {
    bg: colors.warning[500],
    border: colors.warning[700],
    text: colors.neutral[0],
    subtext: colors.warning[100],
  },
  danger: {
    bg: colors.danger[500],
    border: colors.danger[700],
    text: colors.neutral[0],
    subtext: colors.danger[100],
  },
};

export const ChunkyButton: React.FC<ChunkyButtonProps> = ({
  title,
  subtitle,
  onPress,
  color = 'primary',
  disabled = false,
  style,
  textStyle,
  icon,
  testID,
}) => {
  const palette = COLOR_MAP[color];

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderBottomColor: palette.border,
          transform: [{ translateY: pressed ? 2 : 0 }],
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
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
    borderBottomWidth: 4,
    borderColor: withAlpha(colors.neutral[900], 0.08),
    shadowColor: colors.shadow,
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
