import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  runOnUI,
} from 'react-native-reanimated';
import { Volume2 } from 'lucide-react-native';
import { CardWithDetails } from '../../types';
import { LevelBadge } from '../../components/ui/LevelBadge';
import { LabCard } from '../../components/ui/LabCard';
import { formatLanguageCode } from '../../locales/languages';

import { colors } from '../../theme';

interface ReviewCardFlipperProps {
  card: CardWithDetails;
  isFlipped: boolean;
  onFlip: () => void;
  onSpeak: (term: string, lang: string) => void;
}

export const ReviewCardFlipper: React.FC<ReviewCardFlipperProps> = ({
  card,
  isFlipped,
  onFlip,
  onSpeak,
}) => {
  // Shared value 0 = Front, 1 = Back
  const flipRotation = useSharedValue(isFlipped ? 1 : 0);

  // Sync prop changes with UI thread animation
  useEffect(() => {
    runOnUI(() => {
      'worklet';
      flipRotation.value = withTiming(isFlipped ? 1 : 0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
    })();
  }, [isFlipped, flipRotation]);

  // Animated style for Front Side (rotates from 0deg to 180deg)
  const frontAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const rotateValue = interpolate(flipRotation.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateValue}deg` }],
      opacity: interpolate(flipRotation.value, [0, 0.45, 0.5, 1], [1, 0.8, 0, 0]),
      zIndex: flipRotation.value < 0.5 ? 2 : 1,
    };
  });

  // Animated style for Back Side (rotates from -180deg to 0deg)
  const backAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const rotateValue = interpolate(flipRotation.value, [0, 1], [-180, 0]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateValue}deg` }],
      opacity: interpolate(flipRotation.value, [0, 0.5, 0.55, 1], [0, 0, 0.8, 1]),
      zIndex: flipRotation.value >= 0.5 ? 2 : 1,
    };
  });

  return (
    <Pressable
      onPress={onFlip}
      style={({ pressed }) => [
        styles.flipperContainer,
        {
          transform: [{ translateY: pressed ? 2 : 0 }],
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      {/* Front Face */}
      <Animated.View
        style={[styles.cardFace, frontAnimatedStyle]}
        pointerEvents={isFlipped ? 'none' : 'auto'}
      >
        <LabCard variant="light" style={styles.cardContent}>
          {/* Card Header */}
          <View style={styles.cardHeaderRow}>
            <LevelBadge level={card.front_cefr} size="md" />
            <Text style={styles.langTag}>
              {formatLanguageCode(card.front_lang)} ➔ {formatLanguageCode(card.back_lang)}
            </Text>
          </View>

          {/* Front Word & Pronounce */}
          <View style={styles.termBox}>
            <Text style={styles.termText}>{card.front_term}</Text>
            {card.front_pos && <Text style={styles.posText}>[{card.front_pos}]</Text>}

            <TouchableOpacity
              style={styles.ttsButton}
              testID="pronounce-btn"
              accessibilityLabel="Pronounce"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={(e) => {
                e.stopPropagation?.();
                onSpeak(card.front_term, card.front_lang);
              }}
            >
              <Volume2 size={18} color={colors.primary[900]} />
            </TouchableOpacity>
          </View>

          {/* Prompt */}
          <View style={styles.tapToRevealBox}>
            <Text style={styles.tapToRevealText}>Tap card to reveal translation</Text>
          </View>
        </LabCard>
      </Animated.View>

      {/* Back Face */}
      <Animated.View
        style={[styles.cardFace, styles.cardFaceBack, backAnimatedStyle]}
        pointerEvents={isFlipped ? 'auto' : 'none'}
      >
        <LabCard variant="tinted" style={styles.cardContent}>
          {/* Card Header */}
          <View style={styles.cardHeaderRow}>
            <LevelBadge level={card.front_cefr} size="md" />
            <Text style={styles.langTag}>
              {formatLanguageCode(card.front_lang)} ➔ {formatLanguageCode(card.back_lang)}
            </Text>
          </View>

          {/* Front Word (summary) */}
          <View style={styles.termBoxSmall}>
            <Text style={styles.termTextSmall}>{card.front_term}</Text>
            {card.front_pos && <Text style={styles.posText}>[{card.front_pos}]</Text>}
          </View>

          {/* Translation */}
          <View style={styles.backContainer}>
            <View style={styles.divider} />
            <Text style={styles.backTranslationLabel}>TRANSLATION</Text>
            <Text style={styles.backTermText}>{card.back_term}</Text>
          </View>
        </LabCard>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  flipperContainer: {
    width: '100%',
    minHeight: 270,
    position: 'relative',
  },
  cardFace: {
    width: '100%',
    backfaceVisibility: 'hidden',
  },
  cardFaceBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardContent: {
    width: '100%',
    minHeight: 270,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  langTag: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.neutral[400],
    letterSpacing: 1,
  },
  termBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  termBoxSmall: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  termText: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.neutral[800],
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  termTextSmall: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.neutral[500],
    textAlign: 'center',
  },
  posText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.neutral[500],
    marginTop: 4,
    fontWeight: '600',
  },
  ttsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[100],
    width: 38,
    height: 38,
    borderRadius: 19,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },
  divider: {
    height: 1.5,
    backgroundColor: colors.neutral[200],
    marginVertical: 12,
    width: '80%',
    alignSelf: 'center',
  },
  backContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  backTranslationLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary[700],
    letterSpacing: 1,
    marginBottom: 4,
  },
  backTermText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.neutral[900],
    marginBottom: 4,
    textAlign: 'center',
  },
  tapToRevealBox: {
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: colors.neutral[100],
    alignItems: 'center',
  },
  tapToRevealText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[400],
  },
});
