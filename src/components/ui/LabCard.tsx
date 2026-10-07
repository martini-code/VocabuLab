import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

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
          backgroundColor: isTinted ? '#FEF3C7' : '#FFFDF7',
          borderColor: isTinted ? '#D97706' : '#E2E8F0',
          borderBottomColor: isTinted ? '#B45309' : '#CBD5E1',
        },
        style,
      ]}
    >
      {/* Corner bolts (lab-equipment panel look) */}
      <View style={[styles.bolt, styles.boltTopLeft]} />
      <View style={[styles.bolt, styles.boltTopRight]} />
      <View style={[styles.bolt, styles.boltBottomLeft]} />
      <View style={[styles.bolt, styles.boltBottomRight]} />

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  bolt: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
    opacity: 0.6,
  },
  boltTopLeft: { top: 8, left: 8 },
  boltTopRight: { top: 8, right: 8 },
  boltBottomLeft: { bottom: 8, left: 8 },
  boltBottomRight: { bottom: 8, right: 8 },
});
