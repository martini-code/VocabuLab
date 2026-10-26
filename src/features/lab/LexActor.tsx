import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LexMascot } from '../../components/mascot/Mascots';
import { MascotMood } from '../../types';
import { colors } from '../../theme';
import { LexAction, LexPose } from './catalog';

interface LexActorProps {
  /** Centre of Lex's feet, in room coordinates. */
  x: number;
  bottom: number;
  size: number;
  pose: LexPose;
  action: LexAction;
  mood: MascotMood;
  asleep?: boolean;
  zIndex: number;
  accessibilityLabel: string;
  onPress: () => void;
}

/** Small prop drawn by Lex's hands, so one Lex drawing covers every action. */
const ActionProp: React.FC<{ action: LexAction; size: number }> = ({ action, size }) => {
  const s = size * 0.3;
  switch (action) {
    case 'read':
      return (
        <Svg width={s} height={s * 0.7} viewBox="0 0 40 28">
          <Path
            d="M20 26 C14 22 6 22 1 24 V4 C6 2 14 2 20 6 Z"
            fill={colors.neutral[0]}
            stroke={colors.primary[700]}
            strokeWidth={2}
          />
          <Path
            d="M20 26 C26 22 34 22 39 24 V4 C34 2 26 2 20 6 Z"
            fill={colors.neutral[0]}
            stroke={colors.primary[700]}
            strokeWidth={2}
          />
          <Path
            d="M6 9 H15 M6 13 H15 M25 9 H34 M25 13 H34"
            stroke={colors.primary[300]}
            strokeWidth={1.5}
          />
        </Svg>
      );
    case 'write':
    case 'doodle':
      return (
        <Svg width={s * 0.8} height={s * 0.8} viewBox="0 0 24 24">
          <Path
            d="M4 20 L6 14 L16 4 L20 8 L10 18 Z"
            fill={colors.warning[400]}
            stroke={colors.neutral[800]}
            strokeWidth={1.5}
          />
          <Path d="M4 20 L6 14 L10 18 Z" fill={colors.cream[300]} />
        </Svg>
      );
    case 'pour':
      return (
        <Svg width={s * 0.8} height={s} viewBox="0 0 24 30">
          <Path
            d="M9 2 H15 V10 L22 25 A3 3 0 0 1 19 28 H5 A3 3 0 0 1 2 25 L9 10 Z"
            fill={colors.neutral[0]}
            stroke={colors.neutral[600]}
            strokeWidth={1.5}
          />
          <Path
            d="M5 19 H19 L21.5 24.5 A2 2 0 0 1 19.5 27 H4.5 A2 2 0 0 1 2.5 24.5 Z"
            fill={colors.success[300]}
          />
        </Svg>
      );
    case 'peer':
      return (
        <Svg width={s * 0.8} height={s * 0.8} viewBox="0 0 24 24">
          <Circle
            cx={10}
            cy={10}
            r={6}
            fill={colors.primary[100]}
            stroke={colors.neutral[800]}
            strokeWidth={2}
          />
          <Path
            d="M15 15 L21 21"
            stroke={colors.neutral[800]}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'sip':
      return (
        <Svg width={s * 0.7} height={s * 0.7} viewBox="0 0 24 24">
          <Path
            d="M17 8 h2 a3 3 0 0 1 0 6 h-2"
            fill="none"
            stroke={colors.neutral[800]}
            strokeWidth={1.8}
          />
          <Path
            d="M4 5 H17 V16 A4 4 0 0 1 13 20 H8 A4 4 0 0 1 4 16 Z"
            fill={colors.neutral[0]}
            stroke={colors.neutral[800]}
            strokeWidth={1.8}
          />
          <Rect x={4.8} y={9} width={11.4} height={3} fill={colors.primary[500]} />
        </Svg>
      );
    case 'water':
      return (
        <Svg width={s} height={s * 0.7} viewBox="0 0 32 22">
          <Path d="M6 6 H20 V18 A2 2 0 0 1 18 20 H8 A2 2 0 0 1 6 18 Z" fill={colors.success[500]} />
          <Path
            d="M20 10 L30 4"
            stroke={colors.success[600]}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Path d="M9 6 C9 1 17 1 17 6" fill="none" stroke={colors.success[600]} strokeWidth={2} />
        </Svg>
      );
    default:
      return null;
  }
};

const poseOffset = (pose: LexPose, size: number) => {
  if (pose === 'sit_floor' || pose === 'lie') return { scale: 0.88, dy: size * 0.06 };
  if (pose === 'sit_chair') return { scale: 0.94, dy: size * 0.02 };
  return { scale: 1, dy: 0 };
};

export const LexActor: React.FC<LexActorProps> = ({
  x,
  bottom,
  size,
  pose,
  action,
  mood,
  asleep = false,
  zIndex,
  accessibilityLabel,
  onPress,
}) => {
  const [pos] = useState(() => new Animated.ValueXY({ x: x - size / 2, y: bottom - size }));
  const [bob] = useState(() => new Animated.Value(0));
  const first = useRef(true);

  // Walk to a new spot instead of jumping there.
  useEffect(() => {
    const target = { x: x - size / 2, y: bottom - size };
    if (first.current) {
      first.current = false;
      pos.setValue(target);
      return;
    }
    Animated.timing(pos, {
      toValue: target,
      duration: 900,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [x, bottom, size, pos]);

  // Idle loop: a gentle bob, slower and deeper while asleep.
  useEffect(() => {
    const period = asleep ? 2400 : 1400;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: period,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: period,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [asleep, bob]);

  const { scale, dy } = poseOffset(pose, size);
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, asleep ? 3 : -4] });

  return (
    <Animated.View
      style={[
        styles.actor,
        { width: size, height: size, zIndex, transform: [...pos.getTranslateTransform()] },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.fill}
      >
        <Animated.View style={{ transform: [{ translateY: dy }, { translateY: bobY }, { scale }] }}>
          <LexMascot mood={mood} size={size} />
          <View style={[styles.prop, { right: size * 0.08, bottom: size * 0.3 }]}>
            <ActionProp action={asleep ? 'nap' : action} size={size} />
          </View>
          {asleep && <Text style={[styles.zz, { right: size * 0.12, top: size * 0.04 }]}>z z</Text>}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  actor: { position: 'absolute', left: 0, top: 0 },
  fill: { flex: 1 },
  prop: { position: 'absolute' },
  zz: { position: 'absolute', fontSize: 18, fontWeight: '900', color: colors.primary[900] },
});
