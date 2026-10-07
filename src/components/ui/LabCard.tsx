import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme';

interface LabCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'light' | 'tinted';
}

export const LabCard: React.FC<LabCardProps> = ({
  children,
  style,
  variant = 'light',
}) => {
  const isTinted = variant === 'tinted';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isTinted ? colors.primary[50] : colors.neutral[0],
          borderColor: isTinted ? colors.primary[200] : colors.neutral[200],
          borderBottomColor: isTinted ? colors.primary[500] : colors.neutral[300],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 6,
    padding: 20,
    position: 'relative',
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
});
