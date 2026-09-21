import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Rating, Grade } from 'ts-fsrs';
import { CardWithDetails, MascotMood, EnrolledLanguagePair } from '../../types';
import { getDueCards, getDeckCardsForReview, recordCardReview, getEnrolledLanguagePairs } from '../../db/vault';
import { getReviewOptions, gradeCardFSRS } from '../../services/fsrsService';
import { speakWord } from '../../utils/tts';
import { SquireMascot } from '../../components/mascot/Mascots';
import { ChunkyButton } from '../../components/ui/ChunkyButton';
import { ShieldBadge } from '../../components/ui/ShieldBadge';
import { ParchmentCard } from '../../components/ui/ParchmentCard';
import { Volume2, Layers, X, Zap, Globe } from 'lucide-react-native';
import { srsManager } from '../../srs';
import { ReviewCardFlipper } from './ReviewCardFlipper';
import { ReviewSessionSummary, ReviewSessionWordSummary } from './ReviewSessionSummary';
import { RandomDiscoveryView } from '../../components/discovery/RandomDiscoveryView';
import { getLanguageFlag, formatLanguageCode } from '../../locales/languages';

interface ReviewSessionProps {
  onSessionComplete?: () => void;
  onExploreArchives?: () => void;
  deckFilter?: { id: string; name: string } | null;
  onClearDeckFilter?: () => void;
  targetLang?: string;
  originLang?: string;
  onInsufficientTokens?: (requiredWords: number) => void;
  onReviewActiveChange?: (active: boolean) => void;
}

export const ReviewSession: React.FC<ReviewSessionProps> = ({
  onSessionComplete,
  onExploreArchives,
  deckFilter,
  onClearDeckFilter,
  targetLang,
  originLang,
  onInsufficientTokens,
  onReviewActiveChange,
}) => {
  const [cards, setCards] = useState<CardWithDetails[]>([]);
  const [enrolledPairs, setEnrolledPairs] = useState<EnrolledLanguagePair[]>([]);
  const [reviewScope, setReviewScope] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isReviewActive, setIsReviewActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [randomDiscoveryActive, setRandomDiscoveryActive] = useState(false);
  const [mascotMood, setMascotMood] = useState<MascotMood>('idle');
  const [mascotQuote, setMascotQuote] = useState("Train hard, Squire! The realm counts on your memory.");
  const [sessionHistory, setSessionHistory] = useState<ReviewSessionWordSummary[]>([]);

  const activeAlgorithm = srsManager.getActiveAlgorithm();

  const setReviewActiveState = (active: boolean) => {
    setIsReviewActive(active);
    if (onReviewActiveChange) {
      onReviewActiveChange(active);
    }
  };

  useEffect(() => {
    setSessionHistory([]);
    setReviewActiveState(false);
    loadCards(reviewScope);
  }, [deckFilter?.id, targetLang, originLang, reviewScope]);

  const loadCards = async (scope: string = reviewScope) => {
    setLoading(true);
    try {
      const pairs = await getEnrolledLanguagePairs();
      setEnrolledPairs(pairs);

      let due: CardWithDetails[] = [];
      if (deckFilter) {
        due = await getDueCards(deckFilter.id, targetLang, originLang);
        if (due.length === 0) {
          due = await getDeckCardsForReview(deckFilter.id, targetLang, originLang);
        }
      } else {
        const langToQuery = scope === 'all' ? 'all' : scope;
        due = await getDueCards(undefined, langToQuery, originLang);
      }
      setCards(due);
    } catch (err) {
      console.warn('[ReviewSession] Error loading cards:', err);
      setCards([]);
    } finally {
      setCurrentIndex(0);
      setIsFlipped(false);
      setLoading(false);
    }
  };

  const currentCard = cards[currentIndex];

  const handleFlip = () => {
    setIsFlipped((prev) => {
      const next = !prev;
      if (next) {
        setMascotMood('thinking');
        setMascotQuote("Inspect the ancient meaning and grade thy memory!");
      }
      return next;
    });
  };

  const handleGrade = (rating: Grade) => {
    if (!currentCard) return;

    // 1. Immediate visual mascot reaction
    if (rating === Rating.Again) {
      setMascotMood('confused');
      setMascotQuote("A minor stumble! We shall reinforce this scroll soon.");
    } else if (rating === Rating.Hard) {
      setMascotMood('idle');
      setMascotQuote("Grit and steel! It is holding in memory.");
    } else if (rating === Rating.Good) {
      setMascotMood('happy');
      setMascotQuote("Well struck, brave knight!");
    } else if (rating === Rating.Easy) {
      setMascotMood('cheering');
      setMascotQuote("Huzzah! Pure mastery!");
    }

    // 2. Persist FSRS state & review logs asynchronously in SQLite within a single transaction
    const cardId = currentCard.id;
    let updatePayload: any = null;
    try {
      updatePayload = gradeCardFSRS(currentCard, rating);
      recordCardReview(cardId, updatePayload, rating).catch((err) => {
        console.warn('[ReviewSession] Notice recording card review in SQLite:', err);
      });
    } catch (err) {
      console.warn('[ReviewSession] Notice calculating FSRS grade payload:', err);
    }

    // 3. Accumulate review result into session history
    if (updatePayload) {
      setSessionHistory((prev) => [
        ...prev,
        {
          cardId: currentCard.id,
          frontTerm: currentCard.front_term,
          frontLang: currentCard.front_lang,
          backTerm: currentCard.back_term,
          backLang: currentCard.back_lang,
          frontCefr: currentCard.front_cefr,
          pos: currentCard.front_pos,
          rating,
          prevStability: currentCard.stability || 0,
          newStability: updatePayload.stability,
          prevDifficulty: currentCard.difficulty || 0,
          newDifficulty: updatePayload.difficulty,
          scheduledDays: updatePayload.scheduled_days,
          state: updatePayload.state,
        },
      ]);
    }

    // 4. Immediately advance to next card and flip back to front
    setIsFlipped(false);
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= cards.length) {
        setMascotMood('victorious');
        setMascotQuote("All cards in review completed! Well done!");
      }
      return next;
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Gathering fortress scrolls...</Text>
      </View>
    );
  }

  // Session Summary (Rendered after completing reviews in this session)
  if (sessionHistory.length > 0 && (!currentCard || currentIndex >= cards.length)) {
    return (
      <ReviewSessionSummary
        items={sessionHistory}
        deckName={deckFilter?.name}
        onDone={() => {
          setSessionHistory([]);
          setReviewActiveState(false);
          if (onSessionComplete) onSessionComplete();
          loadCards();
        }}
        onExploreArchives={() => {
          setReviewActiveState(false);
          if (onExploreArchives) onExploreArchives();
        }}
        onTrainAgain={() => {
          setSessionHistory([]);
          setReviewActiveState(false);
          loadCards();
        }}
      />
    );
  }

  // Session Victory / Empty Queue State (When no cards were due to begin with)
  if (!currentCard || currentIndex >= cards.length) {
    if (randomDiscoveryActive) {
      return (
        <RandomDiscoveryView
          onExit={() => {
            setRandomDiscoveryActive(false);
            loadCards();
          }}
          targetLang={targetLang}
          originLang={originLang}
          onInsufficientTokens={onInsufficientTokens}
          onWordLearned={() => {
            loadCards();
          }}
        />
      );
    }

    const allDueTotal = enrolledPairs.reduce((sum, p) => sum + (p.progress.dueCards || 0), 0);

    return (
      <ScrollView contentContainerStyle={styles.victoryContainer}>
        {/* Multi-Language Scope Filter Pills */}
        {!deckFilter && enrolledPairs.length >= 2 && (
          <View style={styles.scopeSelectorContainer} testID="review-scope-selector-empty">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scopeScroll}
            >
              <TouchableOpacity
                testID="scope-pill-all-empty"
                style={[
                  styles.scopePill,
                  reviewScope === 'all' && styles.scopePillActive,
                ]}
                onPress={() => setReviewScope('all')}
              >
                <Globe size={13} color={reviewScope === 'all' ? '#FFFFFF' : '#78350F'} />
                <Text
                  style={[
                    styles.scopePillText,
                    reviewScope === 'all' && styles.scopePillTextActive,
                  ]}
                >
                  All Languages ({allDueTotal})
                </Text>
              </TouchableOpacity>

              {enrolledPairs.map((p) => {
                const isSelected = reviewScope === p.destination_lang;
                return (
                  <TouchableOpacity
                    key={p.id}
                    testID={`scope-pill-${p.destination_lang}-empty`}
                    style={[
                      styles.scopePill,
                      isSelected && styles.scopePillActive,
                    ]}
                    onPress={() => setReviewScope(p.destination_lang)}
                  >
                    <Text
                      style={[
                        styles.scopePillText,
                        isSelected && styles.scopePillTextActive,
                      ]}
                    >
                      {getLanguageFlag(p.destination_lang)} {formatLanguageCode(p.destination_lang)} ({p.progress.dueCards})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.victoryCard}>
          <SquireMascot mood="victorious" size={130} />
          <Text style={styles.victoryTitle}>
            {deckFilter ? 'DECK COMPLETED!' : 'QUEST COMPLETED!'}
          </Text>
          <Text style={styles.victorySubtitle}>
            {deckFilter
              ? `Thou hast reviewed all scrolls in "${deckFilter.name}". The fortress gates remain steadfast!`
              : 'Thou hast reviewed all scheduled scrolls for today. The fortress gates remain steadfast!'}
          </Text>

          {deckFilter && onClearDeckFilter && (
            <ChunkyButton
              title="TRAIN ALL KINGDOM DECKS"
              subtitle="Return to general training queue"
              color="wood"
              onPress={onClearDeckFilter}
              style={{ width: '100%', marginTop: 20 }}
            />
          )}

          <ChunkyButton
            title="EXPLORE THE ARCHIVES"
            subtitle="Browse progressive difficulty decks"
            color="green"
            onPress={onExploreArchives || loadCards}
            style={{ width: '100%', marginTop: deckFilter ? 12 : 20 }}
          />

          <ChunkyButton
            title="DISCOVER 10 RANDOM WORDS"
            subtitle="Scout unlearned vocabulary across random decks"
            color="amber"
            onPress={() => setRandomDiscoveryActive(true)}
            style={{ width: '100%', marginTop: 12 }}
          />

          <ChunkyButton
            title="REFRESH TRAINING QUEUE"
            color="wood"
            onPress={loadCards}
            style={{ width: '100%', marginTop: 12 }}
          />
        </View>
      </ScrollView>
    );
  }

  const reviewOptions = getReviewOptions(currentCard);
  const allDueTotal = enrolledPairs.reduce((sum, p) => sum + (p.progress.dueCards || 0), 0);

  // ─── Review Staging Screen ──────────────────────────────────────────────────
  if (!isReviewActive) {
    let displayFlag = '🌐';
    let displayLangText = 'All Languages';

    if (deckFilter) {
      displayFlag = getLanguageFlag(targetLang || 'es');
      displayLangText = formatLanguageCode(targetLang || 'es');
    } else if (reviewScope !== 'all') {
      displayFlag = getLanguageFlag(reviewScope);
      displayLangText = formatLanguageCode(reviewScope);
    }

    return (
      <ScrollView contentContainerStyle={styles.stagingContainer} showsVerticalScrollIndicator={false}>
        {/* Deck Focus Banner if filtered */}
        {deckFilter && (
          <View style={styles.deckFilterBanner}>
            <View style={styles.deckFilterLeft}>
              <Layers size={16} color="#78350F" />
              <Text style={styles.deckFilterText} numberOfLines={1}>
                Deck Focus: {deckFilter.name}
              </Text>
            </View>
            {onClearDeckFilter && (
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={onClearDeckFilter}
              >
                <X size={14} color="#78350F" />
                <Text style={styles.clearFilterText}>All Decks</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Multi-Language Scope Filter Pills */}
        {!deckFilter && enrolledPairs.length >= 2 && (
          <View style={styles.scopeSelectorContainer} testID="review-scope-selector">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scopeScroll}
            >
              <TouchableOpacity
                testID="scope-pill-all"
                style={[
                  styles.scopePill,
                  reviewScope === 'all' && styles.scopePillActive,
                ]}
                onPress={() => setReviewScope('all')}
              >
                <Globe size={13} color={reviewScope === 'all' ? '#FFFFFF' : '#78350F'} />
                <Text
                  style={[
                    styles.scopePillText,
                    reviewScope === 'all' && styles.scopePillTextActive,
                  ]}
                >
                  All Languages ({allDueTotal})
                </Text>
              </TouchableOpacity>

              {enrolledPairs.map((p) => {
                const isSelected = reviewScope === p.destination_lang;
                return (
                  <TouchableOpacity
                    key={p.id}
                    testID={`scope-pill-${p.destination_lang}`}
                    style={[
                      styles.scopePill,
                      isSelected && styles.scopePillActive,
                    ]}
                    onPress={() => setReviewScope(p.destination_lang)}
                  >
                    <Text
                      style={[
                        styles.scopePillText,
                        isSelected && styles.scopePillTextActive,
                      ]}
                    >
                      {getLanguageFlag(p.destination_lang)} {formatLanguageCode(p.destination_lang)} ({p.progress.dueCards})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Staging Information Card */}
        <View style={styles.stagingCard}>
          <SquireMascot mood={mascotMood} size={105} />
          <Text style={styles.stagingTitle}>
            {deckFilter ? 'DECK REVIEW' : 'DAILY REVIEW'}
          </Text>
          <Text style={styles.stagingSubtitle}>
            {deckFilter
              ? `Prepare thy memory to master cards in "${deckFilter.name}".`
              : 'Sharpen thy vocabulary scrolls with spaced repetition.'}
          </Text>

          {/* Staging Data Summary Box */}
          <View style={styles.stagingDataBox}>
            <View style={styles.stagingDataRow}>
              <Text style={styles.stagingDataLabel}>Language</Text>
              <View style={styles.stagingDataBadge}>
                <Text style={styles.stagingDataBadgeText}>
                  {displayFlag} {displayLangText}
                </Text>
              </View>
            </View>

            <View style={styles.stagingDataRow}>
              <Text style={styles.stagingDataLabel}>Cards Due</Text>
              <View style={styles.stagingDataBadge}>
                <Text style={styles.stagingDataBadgeText}>
                  {cards.length} {cards.length === 1 ? 'card' : 'cards'}
                </Text>
              </View>
            </View>

            <View style={styles.stagingDataRow}>
              <Text style={styles.stagingDataLabel}>Algorithm</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Zap size={14} color="#D97706" />
                <Text style={styles.stagingDataEngineText}>{activeAlgorithm.meta.shortName}</Text>
              </View>
            </View>
          </View>

          {/* Begin Review Button */}
          <ChunkyButton
            title="BEGIN REVIEW"
            subtitle={`${cards.length} ${cards.length === 1 ? 'card' : 'cards'} ready to review`}
            color="green"
            onPress={() => setReviewActiveState(true)}
            testID="begin-review-button"
            style={{ width: '100%', marginTop: 14 }}
          />

          {deckFilter && onClearDeckFilter && (
            <ChunkyButton
              title="TRAIN ALL KINGDOM DECKS"
              subtitle="Return to general training queue"
              color="wood"
              onPress={onClearDeckFilter}
              style={{ width: '100%', marginTop: 12 }}
            />
          )}

          <ChunkyButton
            title="DISCOVER 10 RANDOM WORDS"
            subtitle="Scout unlearned vocabulary across random decks"
            color="amber"
            onPress={() => setRandomDiscoveryActive(true)}
            style={{ width: '100%', marginTop: 12 }}
          />

          {onExploreArchives && (
            <ChunkyButton
              title="EXPLORE THE ARCHIVES"
              subtitle="Browse progressive difficulty decks"
              color="wood"
              onPress={onExploreArchives}
              style={{ width: '100%', marginTop: 12 }}
            />
          )}
        </View>
      </ScrollView>
    );
  }

  // ─── Active Fullscreen Review Page ──────────────────────────────────────────
  return (
    <View style={styles.activeContainer}>
      {/* Top Header Row: Progress Bar on Left, 'X' Exit Button on Right */}
      <View style={styles.activeReviewTopBar}>
        <View style={styles.topProgressContainer}>
          <View style={styles.topProgressBarTrack}>
            <View
              style={[
                styles.topProgressBarFill,
                { width: `${((currentIndex + 1) / cards.length) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.topProgressText}>
            {currentIndex + 1} / {cards.length}
          </Text>
        </View>

        <TouchableOpacity
          testID="close-review-button"
          accessibilityLabel="Exit review"
          onPress={() => {
            setReviewActiveState(false);
            loadCards();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeReviewButton}
        >
          <X size={20} color="#78350F" />
        </TouchableOpacity>
      </View>

      {/* Centralized Review Cards Area */}
      <ScrollView
        contentContainerStyle={styles.activeCenterContent}
        showsVerticalScrollIndicator={false}
      >
        <ReviewCardFlipper
          card={currentCard}
          isFlipped={isFlipped}
          onFlip={handleFlip}
          onSpeak={speakWord}
        />

        {/* Actions directly below the centered card */}
        {isFlipped ? (
          <View style={styles.gradingSection}>
            <Text style={styles.gradeSectionTitle}>HOW WELL DID THOU RECALL?</Text>
            <View style={styles.gradingButtonsGrid}>
              {/* Again (Crimson) */}
              <ChunkyButton
                title="AGAIN"
                subtitle={reviewOptions[0]?.intervalText || '10m'}
                color="crimson"
                onPress={() => handleGrade(Rating.Again)}
                style={styles.gradeButton}
              />

              {/* Hard (Amber) */}
              <ChunkyButton
                title="HARD"
                subtitle={reviewOptions[1]?.intervalText || '1d'}
                color="amber"
                onPress={() => handleGrade(Rating.Hard)}
                style={styles.gradeButton}
              />

              {/* Good (Green) */}
              <ChunkyButton
                title="GOOD"
                subtitle={reviewOptions[2]?.intervalText || '4d'}
                color="green"
                onPress={() => handleGrade(Rating.Good)}
                style={styles.gradeButton}
              />

              {/* Easy (Royal Blue) */}
              <ChunkyButton
                title="EASY"
                subtitle={reviewOptions[3]?.intervalText || '12d'}
                color="blue"
                onPress={() => handleGrade(Rating.Easy)}
                style={styles.gradeButton}
              />
            </View>
          </View>
        ) : (
          <View style={styles.activeActionContainer}>
            <ChunkyButton
              title="REVEAL SCROLL"
              subtitle="Tap card or button to reveal"
              color="wood"
              onPress={handleFlip}
              style={{ width: '100%', maxWidth: 360 }}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  deckFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  deckFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  deckFilterText: {
    fontFamily: 'serif',
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#B45309',
  },
  clearFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350F',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: '#78350F',
  },
  mascotSpeechRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  speechBubble: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    marginLeft: 8,
    position: 'relative',
  },
  speechText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 19,
  },
  speechTail: {
    position: 'absolute',
    left: -8,
    top: 24,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: 'transparent',
    borderBottomWidth: 8,
    borderBottomColor: 'transparent',
    borderRightWidth: 8,
    borderRightColor: '#CBD5E1',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    gap: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 7,
  },
  progressText: {
    fontWeight: '800',
    color: '#64748B',
    fontSize: 13,
  },
  algorithmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  algorithmChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  cardContainer: {
    width: '100%',
    minHeight: 250,
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
    color: '#94A3B8',
    letterSpacing: 1,
  },
  termBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  termText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  posText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  ttsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  ttsIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  ttsLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  divider: {
    height: 1.5,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  backContainer: {
    alignItems: 'center',
  },
  backTranslationLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#A16207',
    letterSpacing: 1,
    marginBottom: 4,
  },
  backTermText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  tapToRevealBox: {
    marginTop: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
  },
  tapToRevealText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  gradingSection: {
    width: '100%',
    marginTop: 18,
    alignItems: 'center',
  },
  gradeSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 12,
  },
  gradingButtonsGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 8,
  },
  gradeButton: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  victoryContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  victoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 6,
    borderBottomColor: '#CBD5E1',
    padding: 26,
    alignItems: 'center',
    width: '100%',
  },
  victoryTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 14,
    letterSpacing: 0.5,
  },
  victorySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  scopeSelectorContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    marginBottom: 8,
  },
  scopeScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  scopePillActive: {
    backgroundColor: '#B45309',
    borderColor: '#78350F',
    shadowColor: '#78350F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  scopePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350F',
  },
  scopePillTextActive: {
    color: '#FFFFFF',
  },
  stagingContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 36,
    alignItems: 'center',
  },
  stagingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 6,
    borderBottomColor: '#CBD5E1',
    padding: 22,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    marginTop: 8,
  },
  stagingTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 10,
    letterSpacing: 0.5,
  },
  stagingSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  stagingDataBox: {
    width: '100%',
    backgroundColor: '#FAF5ED',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5D5BC',
    padding: 14,
    marginVertical: 10,
    gap: 10,
  },
  stagingDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stagingDataLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350F',
  },
  stagingDataBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  stagingDataBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
  },
  stagingDataEngineText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  activeContainer: {
    flex: 1,
    backgroundColor: '#FAF5ED',
    width: '100%',
  },
  activeReviewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    width: '100%',
  },
  topProgressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
    gap: 10,
  },
  topProgressBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#E5D5BC',
    borderRadius: 5,
    overflow: 'hidden',
  },
  topProgressBarFill: {
    height: '100%',
    backgroundColor: '#D97706',
    borderRadius: 5,
  },
  topProgressText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
    minWidth: 44,
    textAlign: 'right',
  },
  closeReviewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCenterContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    width: '100%',
  },
  activeActionContainer: {
    width: '100%',
    maxWidth: 360,
    marginTop: 20,
    alignItems: 'center',
  },
});
