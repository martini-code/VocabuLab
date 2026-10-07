import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme';

interface ParchmentCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'light' | 'aged';
}

export const ParchmentCard: React.FC<ParchmentCardProps> = ({
  children,
  style,
  variant = 'light',
}) => {
  const isAged = variant === 'aged';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isAged ? colors.primary[50] : colors.neutral[0],
          borderColor: isAged ? colors.primary[200] : colors.neutral[200],
          borderBottomColor: isAged ? colors.primary[500] : colors.neutral[300],
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
