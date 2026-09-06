import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

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
          backgroundColor: isAged ? '#FEF3C7' : '#FFFDF7',
          borderColor: isAged ? '#D97706' : '#E2E8F0',
          borderBottomColor: isAged ? '#B45309' : '#CBD5E1',
        },
        style,
      ]}
    >
      {/* Ornate corner rivets */}
      <View style={[styles.rivet, styles.rivetTopLeft]} />
      <View style={[styles.rivet, styles.rivetTopRight]} />
      <View style={[styles.rivet, styles.rivetBottomLeft]} />
      <View style={[styles.rivet, styles.rivetBottomRight]} />

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
  rivet: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
    opacity: 0.6,
  },
  rivetTopLeft: { top: 8, left: 8 },
  rivetTopRight: { top: 8, right: 8 },
  rivetBottomLeft: { bottom: 8, left: 8 },
  rivetBottomRight: { bottom: 8, right: 8 },
});
