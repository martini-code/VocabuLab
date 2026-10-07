import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {
  ArrowLeft,
  Dices,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Check,
  Plus,
  Layers,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { LabCard } from '../ui/LabCard';
import { LevelBadge } from '../ui/LevelBadge';
import { ChunkyButton } from '../ui/ChunkyButton';
import { speakWord } from '../../utils/tts';
import { getRandomUnlearnedWords, addWordToQueue } from '../../db/vault';
import { tokenWallet } from '../../services/tokenWallet';
import { MasteryWordItem } from '../../types';

import { colors } from '../../theme';

const SCREEN_WIDTH = typeof Dimensions?.get === 'function' ? Dimensions.get('window')?.width || 375 : 375;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 380);

export interface RandomDiscoveryViewProps {
  onExit: () => void;
  targetLang?: string;
  originLang?: string;
  onInsufficientTokens?: (requiredWords: number) => void;
  onWordLearned?: (lexemeId: number) => void;
}

export const RandomDiscoveryView: React.FC<RandomDiscoveryViewProps> = ({
  onExit,
  targetLang = 'es',
  originLang = 'en',
  onInsufficientTokens,
  onWordLearned,
}) => {
  const { t } = useTranslation();
  const [cards, setCards] = useState<MasteryWordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queuedCardIds, setQueuedCardIds] = useState<Set<number>>(new Set());
  const flatListRef = useRef<FlatList<MasteryWordItem>>(null);

  // Fetch 10 random unlearned words on mount
  useEffect(() => {
    let isMounted = true;

    const fetchWords = async () => {
      setLoading(true);
      try {
        const words = await getRandomUnlearnedWords(10, targetLang, originLang);
        if (isMounted) {
          setCards(words);
          setCurrentIndex(0);
          setQueuedCardIds(new Set());
        }
      } catch (err) {
        console.warn('[RandomDiscoveryView] Error loading random words:', err);
        if (isMounted) setCards([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWords();

    // Clean up: Forget list completely when component unmounts
    return () => {
      isMounted = false;
      setCards([]);
      setCurrentIndex(0);
      setQueuedCardIds(new Set());
    };
  }, [targetLang, originLang]);

  const handleExit = () => {
    // Forget list immediately on exit
    setCards([]);
    setCurrentIndex(0);
    setQueuedCardIds(new Set());
    onExit();
  };

  const handleLearnCard = async (card: MasteryWordItem) => {
    if (queuedCardIds.has(card.front_lexeme_id)) return;

    const canLearn = await tokenWallet.canLearnWords(1);
    if (!canLearn) {
      onInsufficientTokens?.(1);
      return;
    }

    try {
      await tokenWallet.consumeWordAllowance(1);
      await addWordToQueue(
        card.front_lexeme_id,
        card.back_lexeme_id,
        card.concept_id,
        targetLang,
        originLang
      );
      setQueuedCardIds((prev) => new Set(prev).add(card.front_lexeme_id));
      onWordLearned?.(card.front_lexeme_id);
    } catch (e) {
      console.warn('[RandomDiscoveryView] Failed to learn card:', e);
    }
  };

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const contentOffset = e.nativeEvent.contentOffset.x;
      const index = Math.round(contentOffset / (CARD_WIDTH + 16));
      if (index >= 0 && index < cards.length) {
        setCurrentIndex(index);
      }
    },
    [cards.length]
  );

  const navigateTo = (index: number) => {
    if (index >= 0 && index < cards.length) {
      setCurrentIndex(index);
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  };

  const renderCardItem = ({ item }: { item: MasteryWordItem }) => {
    const isLearned = queuedCardIds.has(item.front_lexeme_id);

    return (
      <View style={[styles.cardWrapper, { width: CARD_WIDTH }]}>
        <LabCard variant="tinted" style={styles.cardContent}>
          {/* Deck Info & CEFR */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.deckInfoPill}>
              <Layers size={13} color={colors.primary[800]} style={{ marginRight: 4 }} />
              <Text style={styles.deckInfoText} numberOfLines={1}>
                {item.theme_name} • {item.deck_name}
              </Text>
            </View>
            <LevelBadge level={item.front_cefr} size="sm" />
          </View>

          {/* Target Word & Pronounce (strictly icon only) */}
          <View style={styles.termBox}>
            <Text style={styles.termText}>{item.front_term}</Text>
            {item.front_pos && (
              <Text style={styles.posText}>[{item.front_pos}]</Text>
            )}

            <TouchableOpacity
              style={styles.ttsButton}
              testID={`pronounce-btn-${item.front_lexeme_id}`}
              accessibilityLabel="Pronounce"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={(e) => {
                e.stopPropagation?.();
                speakWord(item.front_term, item.front_lang);
              }}
            >
              <Volume2 size={18} color={colors.primary[900]} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Translation Section */}
          <View style={styles.translationContainer}>
            <Text style={styles.translationLabel}>
              {t('random_discovery.translation', { defaultValue: 'TRANSLATION' })}
            </Text>
            <Text style={styles.backTermText}>{item.back_term}</Text>
            {item.concept_desc ? (
              <Text style={styles.conceptDescText} numberOfLines={2}>
                {item.concept_desc}
              </Text>
            ) : null}
          </View>

          {/* Learn Opt-In Button */}
          <View style={styles.actionContainer}>
            <ChunkyButton
              title={
                isLearned
                  ? t('random_discovery.learned', { defaultValue: 'Learned' })
                  : t('random_discovery.learn_word', { defaultValue: 'Learn Word' })
              }
              subtitle={isLearned ? undefined : '+1 Token'}
              icon={
                isLearned ? (
                  <Check size={18} color={colors.neutral[0]} />
                ) : (
                  <Plus size={18} color={colors.neutral[0]} />
                )
              }
              color={isLearned ? 'success' : 'primary'}
              disabled={isLearned}
              onPress={() => handleLearnCard(item)}
              style={styles.learnBtn}
            />
          </View>
        </LabCard>
      </View>
    );
  };

  return (
    <View style={styles.container} testID="random-discovery-view">
      {/* In-Page Navigation & Header Banner */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.exitBtn}
          onPress={handleExit}
          testID="exit-random-discovery-btn"
          accessibilityLabel="Exit Discovery"
        >
          <ArrowLeft size={16} color={colors.primary[900]} style={{ marginRight: 4 }} />
          <Text style={styles.exitBtnText}>Exit Discovery</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleGroup}>
          <View style={styles.titleWithIcon}>
            <Dices size={18} color={colors.primary[700]} style={{ marginRight: 6 }} />
            <Text style={styles.viewTitle}>
              {t('random_discovery.title', { defaultValue: 'Random Discovery' })}
            </Text>
          </View>
          <Text style={styles.viewSubtitle}>
            {t('random_discovery.subtitle', {
              defaultValue: '10 unlearned words from across the library',
            })}
          </Text>
        </View>

        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>
            {cards.length > 0 ? `${currentIndex + 1} / ${cards.length}` : '0 / 0'}
          </Text>
        </View>
      </View>

      {/* Ephemeral Notice Banner */}
      <View style={styles.ephemeralBanner}>
        <Text style={styles.ephemeralText}>
          ⚡ Ephemeral scout: this list is forgotten once you leave this screen.
        </Text>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary[700]} />
          <Text style={styles.loadingText}>
            {t('random_discovery.loading', {
              defaultValue: 'Sampling random words from the library...',
            })}
          </Text>
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>
            {t('random_discovery.empty_title', {
              defaultValue: 'All Words Conquered',
            })}
          </Text>
          <Text style={styles.emptyDesc}>
            {t('random_discovery.empty_desc', {
              defaultValue:
                'You have learned all available vocabulary in the library!',
            })}
          </Text>
          <ChunkyButton
            title="Back to Decks"
            color="secondary"
            onPress={handleExit}
            style={{ marginTop: 20, width: 180 }}
          />
        </View>
      ) : (
        <View style={styles.carouselSection}>
          {/* Horizontal Scroll Carousel */}
          <FlatList
            ref={flatListRef}
            data={cards}
            keyExtractor={(item) => `random_view_${item.front_lexeme_id}`}
            renderItem={renderCardItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            contentContainerStyle={styles.flatListContent}
            snapToInterval={CARD_WIDTH + 16}
            snapToAlignment="center"
            decelerationRate="fast"
            getItemLayout={(_, index) => ({
              length: CARD_WIDTH + 16,
              offset: (CARD_WIDTH + 16) * index,
              index,
            })}
          />

          {/* Quick Navigation Steppers */}
          <View style={styles.navigationRow}>
            <TouchableOpacity
              style={[
                styles.navBtn,
                currentIndex === 0 && styles.navBtnDisabled,
              ]}
              disabled={currentIndex === 0}
              onPress={() => navigateTo(currentIndex - 1)}
              testID="prev-card-btn"
              accessibilityLabel="Previous Word"
            >
              <ChevronLeft
                size={18}
                color={currentIndex === 0 ? colors.neutral[300] : colors.primary[900]}
              />
              <Text
                style={[
                  styles.navBtnText,
                  currentIndex === 0 && styles.navBtnTextDisabled,
                ]}
              >
                Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navBtn,
                currentIndex === cards.length - 1 && styles.navBtnDisabled,
              ]}
              disabled={currentIndex === cards.length - 1}
              onPress={() => navigateTo(currentIndex + 1)}
              testID="next-card-btn"
              accessibilityLabel="Next Word"
            >
              <Text
                style={[
                  styles.navBtnText,
                  currentIndex === cards.length - 1 && styles.navBtnTextDisabled,
                ]}
              >
                Next
              </Text>
              <ChevronRight
                size={18}
                color={
                  currentIndex === cards.length - 1 ? colors.neutral[300] : colors.primary[900]
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[50],
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[0],
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    marginBottom: 8,
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[100],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary[600],
  },
  exitBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary[900],
  },
  headerTitleGroup: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.primary[900],
    letterSpacing: -0.3,
  },
  viewSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary[800],
    marginTop: 1,
  },
  counterBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  counterText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary[700],
  },
  ephemeralBanner: {
    backgroundColor: colors.primary[50],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  ephemeralText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[700],
    textAlign: 'center',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[900],
    marginTop: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary[900],
  },
  emptyDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  carouselSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  flatListContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  cardWrapper: {
    marginHorizontal: 8,
  },
  cardContent: {
    width: '100%',
    padding: 16,
    minHeight: 330,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deckInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[200],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: '78%',
  },
  deckInfoText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[900],
  },
  termBox: {
    alignItems: 'center',
    marginVertical: 10,
  },
  termText: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.neutral[900],
    textAlign: 'center',
  },
  posText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.neutral[500],
    marginTop: 2,
    fontWeight: '600',
  },
  ttsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[100],
    width: 38,
    height: 38,
    borderRadius: 19,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },
  divider: {
    height: 1.5,
    backgroundColor: colors.neutral[200],
    marginVertical: 10,
    width: '85%',
    alignSelf: 'center',
  },
  translationContainer: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  translationLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary[700],
    letterSpacing: 1,
    marginBottom: 4,
  },
  backTermText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.neutral[800],
    textAlign: 'center',
  },
  conceptDescText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  actionContainer: {
    marginTop: 14,
    alignItems: 'center',
  },
  learnBtn: {
    width: '100%',
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 12,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[100],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary[600],
  },
  navBtnDisabled: {
    opacity: 0.4,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[100],
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary[900],
    marginHorizontal: 4,
  },
  navBtnTextDisabled: {
    color: colors.neutral[400],
  },
});
