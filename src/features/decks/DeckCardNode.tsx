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

interface DeckCardNodeProps {
  deck: DeckWithProgress;
  onPress: () => void;
  index: number;
}

export const DeckCardNode = React.memo<DeckCardNodeProps>(({ deck, onPress, index }) => {
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
              isMastered && { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' },
              isQueued && !isMastered && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
            ]}
          >
            <DeckIcon name={deck.icon_name} size={18} color={isMastered ? '#065F46' : '#92400E'} />
          </View>

          <View style={styles.badgeRow}>
            {/* CEFR Tier Pill */}
            <View
              style={[
                styles.tierBadge,
                isMastered && { backgroundColor: '#059669' },
                isQueued && !isMastered && { backgroundColor: '#D97706' },
              ]}
            >
              <Text style={styles.tierBadgeText}>{deck.cefr_level}</Text>
            </View>

            {/* Deck Card Count Tag */}
            <View style={styles.cardCountPill}>
              <Layers size={11} color="#64748B" />
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
                isMastered && { backgroundColor: '#10B981' },
                isQueued && !isMastered && { backgroundColor: '#F59E0B' },
              ]}
            />
          </View>
        </View>

        {/* Bottom Status Row */}
        <View style={styles.footerRow}>
          {isMastered ? (
            <View style={styles.statusBadgeMastered}>
              <CheckCircle2 size={12} color="#065F46" />
              <Text style={styles.statusTextMastered}>MASTERED</Text>
            </View>
          ) : isQueued ? (
            <View style={styles.statusBadgeQueued}>
              <Sparkles size={12} color="#92400E" />
              <Text style={styles.statusTextQueued}>
                {queuedCount}/{deck.card_count} IN QUEUE
              </Text>
            </View>
          ) : (
            <View style={styles.statusBadgeAvailable}>
              <Plus size={12} color="#475569" />
              <Text style={styles.statusTextAvailable}>READY TO ADOPT</Text>
            </View>
          )}

          <ChevronRight size={15} color="#94A3B8" />
        </View>
      </View>
    </Pressable>
  );
});
DeckCardNode.displayName = 'DeckCardNode';

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
    backgroundColor: '#E2E8F0',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    transform: [{ rotate: '-3deg' }],
  },
  cardStackBackMastered: {
    backgroundColor: '#D1FAE5',
    borderColor: '#A7F3D0',
  },
  // Middle card layer in stack (offset right & tilted)
  cardStackMid: {
    position: 'absolute',
    top: 3,
    left: 4,
    right: -4,
    bottom: -3,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    transform: [{ rotate: '2.5deg' }],
  },
  cardStackMidMastered: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  // Foreground main card
  cardFront: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#E2E8F0',
    borderBottomColor: '#CBD5E1',
    padding: 12,
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  cardFrontActive: {
    borderColor: '#FDE68A',
    borderBottomColor: '#F59E0B',
    backgroundColor: '#FFFDF5',
  },
  cardFrontMastered: {
    borderColor: '#A7F3D0',
    borderBottomColor: '#059669',
    backgroundColor: '#F0FDF4',
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierBadge: {
    backgroundColor: '#64748B',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  bodySection: {
    marginVertical: 4,
  },
  deckName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    lineHeight: 18,
  },
  themeName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
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
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusBadgeMastered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTextMastered: {
    fontSize: 10,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  statusBadgeQueued: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTextQueued: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  statusBadgeAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTextAvailable: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
});
