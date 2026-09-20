import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import {
  X,
  Dices,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Check,
  Plus,
  Layers,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ParchmentCard } from '../ui/ParchmentCard';
import { ShieldBadge } from '../ui/ShieldBadge';
import { ChunkyButton } from '../ui/ChunkyButton';
import { speakWord } from '../../utils/tts';
import { getRandomUnlearnedWords, addWordToQueue } from '../../db/vault';
import { tokenWallet } from '../../services/tokenWallet';
import { MasteryWordItem } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);

interface RandomDiscoveryModalProps {
  visible: boolean;
  onClose: () => void;
  targetLang?: string;
  originLang?: string;
  onInsufficientTokens?: (requiredWords: number) => void;
  onWordLearned?: (lexemeId: number) => void;
}

export const RandomDiscoveryModal: React.FC<RandomDiscoveryModalProps> = ({
  visible,
  onClose,
  targetLang = 'es',
  originLang = 'en',
  onInsufficientTokens,
  onWordLearned,
}) => {
  const { t } = useTranslation();
  const [cards, setCards] = useState<MasteryWordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queuedCardIds, setQueuedCardIds] = useState<Set<number>>(new Set());
  const flatListRef = useRef<FlatList<MasteryWordItem>>(null);

  // Fetch 10 random unlearned words when opened; reset when closed (ephemeral guarantee)
  useEffect(() => {
    if (visible) {
      loadRandomWords();
    } else {
      // Forget the list completely when the user leaves
      setCards([]);
      setCurrentIndex(0);
      setQueuedCardIds(new Set());
    }
  }, [visible, targetLang, originLang]);

  const loadRandomWords = async () => {
    setLoading(true);
    try {
      const words = await getRandomUnlearnedWords(10, targetLang, originLang);
      setCards(words);
      setCurrentIndex(0);
      setQueuedCardIds(new Set());
    } catch (err) {
      console.warn('[RandomDiscoveryModal] Error loading random words:', err);
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Forget list on close
    setCards([]);
    setCurrentIndex(0);
    setQueuedCardIds(new Set());
    onClose();
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
      console.warn('[RandomDiscoveryModal] Failed to learn card:', e);
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
        <ParchmentCard variant="aged" style={styles.cardContent}>
          {/* Deck Info & CEFR */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.deckInfoPill}>
              <Layers size={13} color="#92400E" style={{ marginRight: 4 }} />
              <Text style={styles.deckInfoText} numberOfLines={1}>
                {item.theme_name} • {item.deck_name}
              </Text>
            </View>
            <ShieldBadge level={item.front_cefr} size="sm" />
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
              <Volume2 size={18} color="#78350F" />
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
                  <Check size={18} color="#FFFFFF" />
                ) : (
                  <Plus size={18} color="#FFFFFF" />
                )
              }
              color={isLearned ? 'green' : 'amber'}
              disabled={isLearned}
              onPress={() => handleLearnCard(item)}
              style={styles.learnBtn}
            />
          </View>
        </ParchmentCard>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Dices size={22} color="#B45309" style={{ marginRight: 8 }} />
              <View>
                <Text style={styles.modalTitle}>
                  {t('random_discovery.title', { defaultValue: 'Random Discovery' })}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {t('random_discovery.subtitle', {
                    defaultValue: '10 unlearned words from across the realm',
                  })}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              testID="close-random-modal"
              accessibilityLabel="Close"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#78350F" />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#B45309" />
              <Text style={styles.loadingText}>
                {t('random_discovery.loading', {
                  defaultValue: 'Scouting random words across the realm...',
                })}
              </Text>
            </View>
          ) : cards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {t('random_discovery.empty_title', {
                  defaultValue: 'All Words Conquered',
                })}
              </Text>
              <Text style={styles.emptyDesc}>
                {t('random_discovery.empty_desc', {
                  defaultValue:
                    'You have learned all available vocabulary in the kingdom!',
                })}
              </Text>
              <ChunkyButton
                title="Close"
                color="wood"
                onPress={handleClose}
                style={{ marginTop: 16, width: 160 }}
              />
            </View>
          ) : (
            <View style={styles.carouselContainer}>
              {/* Counter Badge */}
              <View style={styles.counterRow}>
                <View style={styles.counterBadge}>
                  <Text style={styles.counterText}>
                    {t('random_discovery.counter', {
                      current: currentIndex + 1,
                      total: cards.length,
                      defaultValue: `Card ${currentIndex + 1} of ${cards.length}`,
                    })}
                  </Text>
                </View>
              </View>

              {/* Horizontal Scroll Carousel */}
              <FlatList
                ref={flatListRef}
                data={cards}
                keyExtractor={(item) => `random_${item.front_lexeme_id}`}
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

              {/* Navigation Arrows */}
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
                    size={20}
                    color={currentIndex === 0 ? '#CBD5E1' : '#78350F'}
                  />
                  <Text
                    style={[
                      styles.navBtnText,
                      currentIndex === 0 && styles.navBtnTextDisabled,
                    ]}
                  >
                    Prev
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
                    size={20}
                    color={
                      currentIndex === cards.length - 1 ? '#CBD5E1' : '#78350F'
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FEFCE8',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#D97706',
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#FDE68A',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#FDE68A',
    marginLeft: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350F',
    marginTop: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#78350F',
  },
  emptyDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  carouselContainer: {
    alignItems: 'center',
    paddingTop: 12,
  },
  counterRow: {
    marginBottom: 10,
  },
  counterBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  counterText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  flatListContent: {
    paddingHorizontal: 8,
  },
  cardWrapper: {
    marginHorizontal: 8,
  },
  cardContent: {
    width: '100%',
    padding: 16,
    minHeight: 320,
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
    backgroundColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: '78%',
  },
  deckInfoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350F',
  },
  termBox: {
    alignItems: 'center',
    marginVertical: 10,
  },
  termText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  posText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  ttsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    width: 38,
    height: 38,
    borderRadius: 19,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  divider: {
    height: 1.5,
    backgroundColor: '#E2E8F0',
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
    color: '#A16207',
    letterSpacing: 1,
    marginBottom: 4,
  },
  backTermText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  conceptDescText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
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
    marginTop: 14,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D97706',
  },
  navBtnDisabled: {
    opacity: 0.4,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
    marginHorizontal: 4,
  },
  navBtnTextDisabled: {
    color: '#94A3B8',
  },
});
