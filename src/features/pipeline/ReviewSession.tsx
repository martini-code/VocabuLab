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
import { CardWithDetails, MascotMood } from '../../types';
import { getDueCards, getDeckCardsForReview, updateCardFSRS, logReviewEvent } from '../../db/vault';
import { getReviewOptions, gradeCardFSRS } from '../../services/fsrsService';
import { speakWord } from '../../utils/tts';
import { SquireMascot } from '../../components/mascot/Mascots';
import { ChunkyButton } from '../../components/ui/ChunkyButton';
import { ShieldBadge } from '../../components/ui/ShieldBadge';
import { ParchmentCard } from '../../components/ui/ParchmentCard';
import { Volume2, Layers, X, Zap } from 'lucide-react-native';
import { srsManager } from '../../srs';
import { AlgorithmSelectorModal } from '../../components/modals/AlgorithmSelectorModal';

interface ReviewSessionProps {
  onSessionComplete?: () => void;
  onExploreArchives?: () => void;
  deckFilter?: { id: string; name: string } | null;
  onClearDeckFilter?: () => void;
  onCardReviewed?: () => void;
}

export const ReviewSession: React.FC<ReviewSessionProps> = ({
  onSessionComplete,
  onExploreArchives,
  deckFilter,
  onClearDeckFilter,
  onCardReviewed,
}) => {
  const [cards, setCards] = useState<CardWithDetails[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mascotMood, setMascotMood] = useState<MascotMood>('idle');
  const [mascotQuote, setMascotQuote] = useState("Train hard, Squire! The realm counts on your memory.");
  const [sessionXP, setSessionXP] = useState(0);
  const [algoModalOpen, setAlgoModalOpen] = useState(false);
  const [algoVersion, setAlgoVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = srsManager.subscribe(() => {
      setAlgoVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  const activeAlgorithm = srsManager.getActiveAlgorithm();

  useEffect(() => {
    loadCards();
  }, [deckFilter?.id]);

  const loadCards = async () => {
    setLoading(true);
    let due: CardWithDetails[] = [];
    if (deckFilter) {
      due = await getDueCards(deckFilter.id);
      if (due.length === 0) {
        due = await getDeckCardsForReview(deckFilter.id);
      }
    } else {
      due = await getDueCards();
    }
    setCards(due);
    setCurrentIndex(0);
    setIsFlipped(false);
    setLoading(false);
  };

  const currentCard = cards[currentIndex];

  const handleFlip = () => {
    if (!isFlipped) {
      setIsFlipped(true);
      setMascotMood('thinking');
      setMascotQuote("Inspect the ancient meaning and grade thy memory!");
    }
  };

  const handleGrade = async (rating: Grade) => {
    if (!currentCard) return;

    // React with Mascot
    if (rating === Rating.Again) {
      setMascotMood('confused');
      setMascotQuote("A minor stumble! We shall reinforce this scroll soon.");
    } else if (rating === Rating.Hard) {
      setMascotMood('idle');
      setMascotQuote("Grit and steel! It is holding in memory.");
    } else if (rating === Rating.Good) {
      setMascotMood('happy');
      setMascotQuote("Well struck, brave knight! +15 XP");
      setSessionXP((prev) => prev + 15);
    } else if (rating === Rating.Easy) {
      setMascotMood('cheering');
      setMascotQuote("Huzzah! Pure mastery! +25 XP");
      setSessionXP((prev) => prev + 25);
    }

    const updatePayload = gradeCardFSRS(currentCard, rating);
    await updateCardFSRS(currentCard.id, updatePayload);
    await logReviewEvent(currentCard.id, rating);
    if (onCardReviewed) onCardReviewed();

    // Advance to next card
    setTimeout(() => {
      if (currentIndex + 1 < cards.length) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      } else {
        // Finished deck!
        setCurrentIndex(cards.length);
        setMascotMood('victorious');
        setMascotQuote("All garrisoned scrolls defended! Victory belongs to the Keep!");
        if (onSessionComplete) onSessionComplete();
      }
    }, 380);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Gathering fortress scrolls...</Text>
      </View>
    );
  }

  // Session Victory / Empty Queue State
  if (!currentCard || currentIndex >= cards.length) {
    return (
      <ScrollView contentContainerStyle={styles.victoryContainer}>
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

          <View style={styles.xpBox}>
            <Text style={styles.xpNumber}>+{sessionXP > 0 ? sessionXP : 80} XP</Text>
            <Text style={styles.xpLabel}>VALOR GAINED TODAY</Text>
          </View>

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
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

      {/* Top Training Arena Header & Mascot */}
      <View style={styles.mascotSpeechRow}>
        <SquireMascot mood={mascotMood} size={90} />
        <View style={styles.speechBubble}>
          <Text style={styles.speechText}>{mascotQuote}</Text>
          <View style={styles.speechTail} />
        </View>
      </View>

      {/* Progress Indicator & Algorithm Selector Badge */}
      <View style={styles.progressRow}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((currentIndex + 1) / cards.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {cards.length}
        </Text>
        <TouchableOpacity
          style={styles.algorithmChip}
          onPress={() => setAlgoModalOpen(true)}
          activeOpacity={0.7}
        >
          <Zap size={12} color="#D97706" />
          <Text style={styles.algorithmChipText}>{activeAlgorithm.meta.shortName}</Text>
        </TouchableOpacity>
      </View>

      {/* Spaced Repetition Card */}
      <TouchableOpacity activeOpacity={0.92} onPress={handleFlip} style={{ width: '100%' }}>
        <ParchmentCard variant={isFlipped ? 'aged' : 'light'} style={styles.cardContainer}>
          {/* Top Card Badges */}
          <View style={styles.cardHeaderRow}>
            <ShieldBadge level={currentCard.front_cefr} size="md" />
            <Text style={styles.langTag}>
              {currentCard.front_lang.toUpperCase()} ➔ {currentCard.back_lang.toUpperCase()}
            </Text>
          </View>

          {/* Front Term & Audio */}
          <View style={styles.termBox}>
            <Text style={styles.termText}>{currentCard.front_term}</Text>
            {currentCard.front_pos && (
              <Text style={styles.posText}>[{currentCard.front_pos}]</Text>
            )}

            {/* Offline TTS Horn Button */}
            <TouchableOpacity
              style={styles.ttsButton}
              onPress={() => speakWord(currentCard.front_term, currentCard.front_lang)}
            >
              <Volume2 size={16} color="#78350F" />
              <Text style={styles.ttsLabel}>Pronounce</Text>
            </TouchableOpacity>
          </View>

          {/* Back Side: Concept Description & Translation */}
          {isFlipped ? (
            <View style={styles.backContainer}>
              <View style={styles.divider} />
              <Text style={styles.backTranslationLabel}>TRANSLATION</Text>
              <Text style={styles.backTermText}>{currentCard.back_term}</Text>
              <Text style={styles.conceptLabel}>CILI CONCEPT / LORE</Text>
              <Text style={styles.conceptDesc}>"{currentCard.concept_desc}"</Text>
            </View>
          ) : (
            <View style={styles.tapToRevealBox}>
              <Text style={styles.tapToRevealText}>Tap scroll to reveal translation</Text>
            </View>
          )}
        </ParchmentCard>
      </TouchableOpacity>

      {/* FSRS Grading Actions Bar */}
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
        <ChunkyButton
          title="REVEAL SCROLL"
          color="amber"
          onPress={handleFlip}
          style={{ width: '100%', marginTop: 15 }}
        />
      )}

      {/* Spaced Repetition Algorithm Selector Modal */}
      <AlgorithmSelectorModal
        visible={algoModalOpen}
        onClose={() => setAlgoModalOpen(false)}
        onAlgorithmChanged={() => setAlgoVersion((v) => v + 1)}
      />
    </ScrollView>
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
    marginBottom: 10,
    textAlign: 'center',
  },
  conceptLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 4,
  },
  conceptDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
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
  xpBox: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 2,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 18,
    alignItems: 'center',
  },
  xpNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#B45309',
  },
  xpLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    marginTop: 2,
    letterSpacing: 0.5,
  },
});
