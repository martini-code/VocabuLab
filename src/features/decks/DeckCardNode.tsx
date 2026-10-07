import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Plus,
  Layers,
} from 'lucide-react-native';
import { DeckWithProgress } from '../../types';
import { DeckIcon } from '../../components/icons/DeckIcon';

import { colors, levelColorsFor, levelLabel } from '../../theme';

interface DeckCardNodeProps {
  deck: DeckWithProgress;
  onPress: () => void;
  index: number;
}

export const DeckCardNode = React.memo<DeckCardNodeProps>(({ deck, onPress, index }) => {
  const levelColors = levelColorsFor(deck.difficulty_level);
  const isMastered = deck.card_count > 0 && deck.mastered_count >= deck.card_count;
  const queuedCount = deck.queued_count ?? 0;
  const isQueued = queuedCount > 0;
  const queuePercent =
    deck.card_count > 0
      ? Math.min(100, Math.round((queuedCount / deck.card_count) * 100))
      : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          transform: [{ translateY: pressed ? 2 : 0 }],
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {/* Underlying 3D Physical Card Stack Layers */}
      <View style={[styles.cardStackBack, isMastered && styles.cardStackBackMastered]} />
      <View style={[styles.cardStackMid, isMastered && styles.cardStackMidMastered]} />

      {/* Main Front Deck Card */}
      <View
        style={[
          styles.cardFront,
          isMastered && styles.cardFrontMastered,
          isQueued && !isMastered && styles.cardFrontActive,
        ]}
      >
        {/* Top Header: Icon, Tier/CEFR Badge, Card Count */}
        <View style={styles.headerRow}>
          <View
            style={[
              styles.iconBox,
              isMastered && { backgroundColor: colors.success[100], borderColor: colors.success[200] },
              isQueued && !isMastered && { backgroundColor: colors.primary[100], borderColor: colors.primary[200] },
            ]}
          >
            <DeckIcon name={deck.icon_name} size={18} color={isMastered ? colors.success[800] : colors.primary[800]} />
          </View>

          <View style={styles.badgeRow}>
            {/* Difficulty level pill */}
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: levelColors.solid, borderColor: levelColors.solidBorder },
              ]}
            >
              <Text style={[styles.tierBadgeText, { color: levelColors.onSolid }]}>
                {levelLabel(deck.difficulty_level)}
              </Text>
            </View>

            {/* Deck Card Count Tag */}
            <View style={styles.cardCountPill}>
              <Layers size={11} color={colors.neutral[500]} />
              <Text style={styles.cardCountText}>{deck.card_count}</Text>
            </View>
          </View>
        </View>

        {/* Deck Title & Theme Subtitle */}
        <View style={styles.bodySection}>
          <Text style={styles.deckName} numberOfLines={2}>
            {deck.name}
          </Text>
          {Boolean(deck.theme_name) && (
            <Text style={styles.themeName} numberOfLines={1}>
              {deck.theme_name}
            </Text>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${isMastered ? 100 : queuePercent}%` },
                isMastered && { backgroundColor: colors.success[500] },
                isQueued && !isMastered && { backgroundColor: colors.primary[500] },
              ]}
            />
          </View>
        </View>

        {/* Bottom Status Row */}
        <View style={styles.footerRow}>
          {isMastered ? (
            <View style={styles.statusBadgeMastered}>
              <CheckCircle2 size={12} color={colors.success[800]} />
              <Text style={styles.statusTextMastered}>MASTERED</Text>
            </View>
          ) : isQueued ? (
            <View style={styles.statusBadgeQueued}>
              <Sparkles size={12} color={colors.primary[800]} />
              <Text style={styles.statusTextQueued}>
                {queuedCount}/{deck.card_count} IN QUEUE
              </Text>
            </View>
          ) : (
            <View style={styles.statusBadgeAvailable}>
              <Plus size={12} color={colors.neutral[600]} />
              <Text style={styles.statusTextAvailable}>READY TO ADOPT</Text>
            </View>
          )}

          <ChevronRight size={15} color={colors.neutral[400]} />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 250,
    minHeight: 140,
    position: 'relative',
    marginVertical: 10,
  },
  // Deepest card layer in stack (offset left & tilted)
  cardStackBack: {
    position: 'absolute',
    top: 6,
    left: -4,
    right: 4,
    bottom: -6,
    backgroundColor: colors.neutral[200],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    transform: [{ rotate: '-3deg' }],
  },
  cardStackBackMastered: {
    backgroundColor: colors.success[100],
    borderColor: colors.success[200],
  },
  // Middle card layer in stack (offset right & tilted)
  cardStackMid: {
    position: 'absolute',
    top: 3,
    left: 4,
    right: -4,
    bottom: -3,
    backgroundColor: colors.neutral[100],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    transform: [{ rotate: '2.5deg' }],
  },
  cardStackMidMastered: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[300],
  },
  // Foreground main card
  cardFront: {
    backgroundColor: colors.neutral[0],
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.neutral[200],
    borderBottomColor: colors.neutral[300],
    padding: 12,
    zIndex: 3,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  cardFrontActive: {
    borderColor: colors.primary[200],
    borderBottomColor: colors.primary[500],
    backgroundColor: colors.neutral[0],
  },
  cardFrontMastered: {
    borderColor: colors.success[200],
    borderBottomColor: colors.success[600],
    backgroundColor: colors.success[50],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierBadge: {
    borderWidth: 1,
    backgroundColor: colors.neutral[500],
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.neutral[0],
    letterSpacing: 0.5,
  },
  cardCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  bodySection: {
    marginVertical: 4,
  },
  deckName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[800],
    lineHeight: 18,
  },
  themeName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[400],
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: colors.neutral[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  statusBadgeMastered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success[100],
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTextMastered: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.success[800],
    letterSpacing: 0.5,
  },
  statusBadgeQueued: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary[100],
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTextQueued: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary[800],
    letterSpacing: 0.5,
  },
  statusBadgeAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTextAvailable: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.neutral[600],
    letterSpacing: 0.5,
  },
});
