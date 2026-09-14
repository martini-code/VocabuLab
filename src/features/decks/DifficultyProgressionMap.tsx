import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Shield,
  Compass,
  Swords,
  Award,
  BookOpen,
  Crown,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowDown,
  Filter,
} from 'lucide-react-native';
import { DeckWithProgress, CEFRLevel } from '../../types';
import { DeckCardNode } from './DeckCardNode';
import { useTranslation } from 'react-i18next';

interface DifficultyProgressionMapProps {
  decks: DeckWithProgress[];
  loading: boolean;
  onSelectDeck: (deck: DeckWithProgress) => void;
}

type NodeAlignment = 'left' | 'center' | 'right';

const TIER_CONFIG: Record<
  number,
  { title: string; subtitle: string; color: string; bgColor: string; borderColor: string }
> = {
  1: {
    title: 'Tier 1: Novice Gateway',
    subtitle: 'CEFR A1 • Everyday Foundations & Courtesies',
    color: '#0D9488',
    bgColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  2: {
    title: 'Tier 2: Apprentice Trail',
    subtitle: 'CEFR A2 • Wayfaring, Dining, Menagerie & Coinage',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  3: {
    title: 'Tier 3: Adept Realm',
    subtitle: 'CEFR B1 • Guild Bargains, Steel Armaments & Epistemology',
    color: '#7C3AED',
    bgColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  4: {
    title: 'Tier 4: Expert Expedition',
    subtitle: 'CEFR B2 • Badlands, Martial Valor & Hypotheses',
    color: '#D97706',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  5: {
    title: 'Tier 5: Master Scriptorium',
    subtitle: 'CEFR C1 • First Principles, Axioms & High Statecraft',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  6: {
    title: 'Tier 6: Grandmaster Citadel',
    subtitle: 'CEFR C2 • Labyrinthine Riddles & Ancient Metaphysics',
    color: '#B45309',
    bgColor: '#FEFCE8',
    borderColor: '#FDE047',
  },
};

function renderTierIcon(tier: number, size = 18, color = '#78350F') {
  switch (tier) {
    case 1:
      return <Shield size={size} color={color} />;
    case 2:
      return <Compass size={size} color={color} />;
    case 3:
      return <Swords size={size} color={color} />;
    case 4:
      return <Award size={size} color={color} />;
    case 5:
      return <BookOpen size={size} color={color} />;
    case 6:
      return <Crown size={size} color={color} />;
    default:
      return <Shield size={size} color={color} />;
  }
}

/**
 * Renders stepping stone connector path dots between deck card nodes.
 */
const PathConnector: React.FC<{
  fromAlign: NodeAlignment;
  toAlign: NodeAlignment;
  isCompleted: boolean;
}> = ({ fromAlign, toAlign, isCompleted }) => {
  // Determine dot horizontal offsets to create a smooth winding curve
  const getOffsets = () => {
    if (fromAlign === 'left' && toAlign === 'center') return [-35, -15, 0];
    if (fromAlign === 'center' && toAlign === 'right') return [0, 18, 38];
    if (fromAlign === 'right' && toAlign === 'center') return [35, 15, 0];
    if (fromAlign === 'center' && toAlign === 'left') return [0, -18, -38];
    return [0, 0, 0];
  };

  const offsets = getOffsets();
  const dotColor = isCompleted ? '#10B981' : '#CBD5E1';
  const dotBorder = isCompleted ? '#059669' : '#94A3B8';

  return (
    <View style={styles.pathConnectorContainer}>
      {offsets.map((offset, idx) => (
        <View
          key={idx}
          style={[
            styles.pathSteppingStone,
            {
              transform: [{ translateX: offset }],
              backgroundColor: dotColor,
              borderColor: dotBorder,
            },
          ]}
        >
          {idx === 1 && (
            <ArrowDown size={10} color={isCompleted ? '#065F46' : '#64748B'} />
          )}
        </View>
      ))}
    </View>
  );
};

export const DifficultyProgressionMap: React.FC<DifficultyProgressionMapProps> = ({
  decks,
  loading,
  onSelectDeck,
}) => {
  const { t } = useTranslation();
  const [selectedCefrFilter, setSelectedCefrFilter] = useState<'ALL' | CEFRLevel>('ALL');

  // Alignments sequence for a meandering natural map trail
  const alignmentPattern: NodeAlignment[] = ['left', 'center', 'right', 'center'];

  // Filtered decks based on CEFR selector
  const filteredDecks = useMemo(() => {
    if (selectedCefrFilter === 'ALL') return decks;
    return decks.filter((d) => d.cefr_level === selectedCefrFilter);
  }, [decks, selectedCefrFilter]);

  // Overall map summary stats
  const stats = useMemo(() => {
    const total = decks.length;
    let mastered = 0;
    let inProgress = 0;
    let totalCards = 0;
    let masteredCards = 0;

    for (const d of decks) {
      totalCards += d.card_count;
      masteredCards += d.mastered_count;
      if (d.card_count > 0 && d.mastered_count >= d.card_count) {
        mastered++;
      } else if (d.garrisoned_count > 0) {
        inProgress++;
      }
    }

    return { total, mastered, inProgress, totalCards, masteredCards };
  }, [decks]);

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#D97706" />
        <Text style={styles.loadingText}>Unfurling difficulty progression map...</Text>
      </View>
    );
  }

  // Group decks by difficulty tier for checkpoint headers
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Map Overview & Legend */}
      <View style={styles.mapOverviewCard}>
        <View style={styles.mapHeaderRow}>
          <View style={styles.mapIconCircle}>
            <Compass size={22} color="#B45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapTitle}>PROGRESSION ROADMAP</Text>
            <Text style={styles.mapSubtitle}>
              Progressive difficulty decks sequenced from A1 Novice to C2 Grandmaster
            </Text>
          </View>
        </View>

        {/* Milestone Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Decks</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#D97706' }]}>{stats.inProgress}</Text>
            <Text style={styles.statLabel}>In Queue</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#059669' }]}>{stats.mastered}</Text>
            <Text style={styles.statLabel}>Mastered</Text>
          </View>
        </View>

        {/* CEFR Tier Quick-Filter Chips */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {(['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => {
              const isActive = selectedCefrFilter === lvl;
              return (
                <TouchableOpacity
                  key={lvl}
                  activeOpacity={0.8}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setSelectedCefrFilter(lvl)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {lvl === 'ALL' ? 'Full Map' : lvl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Main Map Trail */}
      <View style={styles.mapTrailContainer}>
        {filteredDecks.map((deck, index) => {
          const tier = deck.difficulty_level || 1;
          const prevDeck = index > 0 ? filteredDecks[index - 1] : null;
          const isNewTier = !prevDeck || prevDeck.difficulty_level !== tier;
          const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG[1];

          // Compute alignment for this node and the next node
          const align = alignmentPattern[index % alignmentPattern.length];
          const nextIndex = index + 1;
          const nextAlign =
            nextIndex < filteredDecks.length
              ? alignmentPattern[nextIndex % alignmentPattern.length]
              : 'center';

          const isDeckCompleted =
            deck.card_count > 0 && deck.mastered_count >= deck.card_count;

          return (
            <View key={deck.id} style={styles.nodeWrapper}>
              {/* Tier Checkpoint Milestone Banner */}
              {isNewTier && (
                <View
                  style={[
                    styles.tierBanner,
                    {
                      backgroundColor: tierCfg.bgColor,
                      borderColor: tierCfg.borderColor,
                    },
                  ]}
                >
                  <View style={[styles.tierBannerIconBox, { backgroundColor: tierCfg.color }]}>
                    {renderTierIcon(tier, 18, '#FFFFFF')}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tierBannerTitle, { color: tierCfg.color }]}>
                      {tierCfg.title.toUpperCase()}
                    </Text>
                    <Text style={styles.tierBannerSub}>{tierCfg.subtitle}</Text>
                  </View>
                </View>
              )}

              {/* Physical Deck of Cards UI Node */}
              <View
                style={[
                  styles.nodePositioner,
                  align === 'left' && styles.nodeAlignLeft,
                  align === 'center' && styles.nodeAlignCenter,
                  align === 'right' && styles.nodeAlignRight,
                ]}
              >
                <DeckCardNode
                  deck={deck}
                  index={index}
                  onPress={() => onSelectDeck(deck)}
                />
              </View>

              {/* Winding Trail Stepping Stones to Next Deck */}
              {index < filteredDecks.length - 1 && (
                <PathConnector
                  fromAlign={align}
                  toAlign={nextAlign}
                  isCompleted={isDeckCompleted}
                />
              )}
            </View>
          );
        })}

        {filteredDecks.length === 0 && (
          <View style={styles.emptyContainer}>
            <Compass size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Decks Found for {selectedCefrFilter}</Text>
            <TouchableOpacity
              style={styles.resetFilterBtn}
              onPress={() => setSelectedCefrFilter('ALL')}
            >
              <Text style={styles.resetFilterText}>View Full Progression Map</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  centerLoading: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '700',
    color: '#78350F',
  },
  mapOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#E2E8F0',
    borderBottomColor: '#CBD5E1',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  mapIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: 0.5,
  },
  mapSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  filterSection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  filterScroll: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#B45309',
    borderColor: '#92400E',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  mapTrailContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  nodeWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  tierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 24,
    marginBottom: 14,
  },
  tierBannerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tierBannerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  nodePositioner: {
    width: '100%',
    alignItems: 'center',
  },
  nodeAlignLeft: {
    alignItems: 'flex-start',
    paddingLeft: 12,
  },
  nodeAlignCenter: {
    alignItems: 'center',
  },
  nodeAlignRight: {
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  pathConnectorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 4,
    height: 60,
  },
  pathSteppingStone: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 12,
  },
  resetFilterBtn: {
    marginTop: 14,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
});
