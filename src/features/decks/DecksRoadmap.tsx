import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import {
  Layers,
  TrendingUp,
  Brain,
  Search,
  Volume2,
  Check,
  Plus,
  AlertCircle,
  Clock,
  Sparkles,
  PlusCircle,
  X,
  Play,
  ChevronRight,
  BookOpen,
  Castle,
  TreePine,
  Coins,
  Swords,
  Sword,
  Shield,
  Crown,
  Users,
  Utensils,
  Wine,
  Footprints,
  CloudLightning,
  Compass,
  Scale,
  Award,
  Scroll,
  Landmark,
  Flame,
  Network,
  CheckCircle2,
} from 'lucide-react-native';
import {
  ThemeGroup,
  DeckWithProgress,
  DeckCardDetail,
  DifficultyWordItem,
  DifficultyStat,
  MasteryWordItem,
  MasterySummary,
  MasteryStage,
  CEFRLevel,
} from '../../types';
import {
  getThemesWithProgressiveDecks,
  getAllDecksOrderedByDifficulty,
  getCardsByDeck,
  garrisonEntireDeck,
  addWordToQueue,
  getWordsByDifficulty,
  getDifficultyStats,
  addWordsByDifficultyToQueue,
  getMasterySummary,
  getMasteryWords,
  addAvailableWordsToQueue,
} from '../../db/vault';
import { DifficultyProgressionMap } from './DifficultyProgressionMap';
import { speakWord } from '../../utils/tts';
import { useTranslation } from 'react-i18next';
import { tokenWallet } from '../../services/tokenWallet';

export interface DecksRoadmapProps {
  onStudyDeck: (deckId: string, deckName: string) => void;
  onStartReview?: () => void;
  targetLang?: string;
  originLang?: string;
  onInsufficientTokens?: (requiredWords: number) => void;
}

type MainTab = 'decks' | 'difficulty' | 'mastery';

function renderDeckIcon(iconName: string, size = 20, color = '#64748B') {
  switch (iconName) {
    case 'castle':
      return <Castle size={size} color={color} />;
    case 'tree':
      return <TreePine size={size} color={color} />;
    case 'coins':
      return <Coins size={size} color={color} />;
    case 'swords':
      return <Swords size={size} color={color} />;
    case 'sword':
      return <Sword size={size} color={color} />;
    case 'shield':
      return <Shield size={size} color={color} />;
    case 'book':
      return <BookOpen size={size} color={color} />;
    case 'crown':
      return <Crown size={size} color={color} />;
    case 'handshake':
      return <Users size={size} color={color} />;
    case 'utensils':
      return <Utensils size={size} color={color} />;
    case 'goblet':
      return <Wine size={size} color={color} />;
    case 'paw':
      return <Footprints size={size} color={color} />;
    case 'cloud-lightning':
      return <CloudLightning size={size} color={color} />;
    case 'compass':
      return <Compass size={size} color={color} />;
    case 'scale':
      return <Scale size={size} color={color} />;
    case 'award':
      return <Award size={size} color={color} />;
    case 'sparkles':
      return <Sparkles size={size} color={color} />;
    case 'scroll':
      return <Scroll size={size} color={color} />;
    case 'brain':
      return <Brain size={size} color={color} />;
    case 'landmark':
      return <Landmark size={size} color={color} />;
    case 'flame':
      return <Flame size={size} color={color} />;
    case 'network':
      return <Network size={size} color={color} />;
    default:
      return <BookOpen size={size} color={color} />;
  }
}

function getCefrBadgeColors(cefr: string) {
  switch (cefr) {
    case 'A1':
      return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
    case 'A2':
      return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
    case 'B1':
      return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
    case 'B2':
      return { bg: '#FFF7ED', text: '#EA580C', border: '#FFEDD5' };
    case 'C1':
      return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' };
    case 'C2':
      return { bg: '#FDF2F8', text: '#DB2777', border: '#FBCFE8' };
    default:
      return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
  }
}
function formatNextReview(dueDateStr?: string, t?: (key: string, options?: any) => string): string {
  if (!dueDateStr) return 'New';
  const due = new Date(dueDateStr);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0 || diffHours <= 0) {
    return 'Due now';
  }
  if (diffHours < 24) {
    return `In ${diffHours}h`;
  }
  if (diffDays === 1) {
    return 'Tomorrow';
  }
  if (diffDays < 30) {
    return `In ${diffDays}d`;
  }
  const months = Math.round(diffDays / 30);
  return `In ${months}mo`;
}

interface MasteryWordCardProps {
  item: MasteryWordItem;
  isQueued: boolean;
  onAddWord: (frontLexemeId: number, backLexemeId: number, conceptId: string) => void;
  onSpeak: (term: string, lang: string) => void;
}

const MasteryWordCard = React.memo<MasteryWordCardProps>(
  ({ item, isQueued, onAddWord, onSpeak }) => {
    const { t } = useTranslation();
    const cefrColors = getCefrBadgeColors(item.front_cefr);

    return (
      <View style={styles.wordItemCard}>
        <View style={styles.wordItemHeader}>
          <View style={styles.wordTermBox}>
            <Text style={styles.wordFrontTerm}>{item.front_term}</Text>
            <TouchableOpacity
              style={styles.speakerBtn}
              onPress={() => onSpeak(item.front_term, item.front_lang)}
            >
              <Volume2 size={16} color="#D97706" />
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.cefrBadge,
              { backgroundColor: cefrColors.bg, borderColor: cefrColors.border },
            ]}
          >
            <Text style={[styles.cefrBadgeText, { color: cefrColors.text }]}>
              {item.front_cefr}
            </Text>
          </View>
        </View>

        <Text style={styles.wordBackTerm}>{item.back_term}</Text>

        {/* SRS Retention Diagnostics */}
        {item.stage !== 'available' && (
          <View style={styles.srsMetricsRow}>
            {item.due_date ? (
              <View style={styles.srsMetricBadge}>
                <Text style={styles.srsMetricLabel}>Next Review:</Text>
                <Text style={styles.srsMetricVal}>
                  {formatNextReview(item.due_date)}
                </Text>
              </View>
            ) : item.stability !== undefined ? (
              <View style={styles.srsMetricBadge}>
                <Text style={styles.srsMetricLabel}>Next Review:</Text>
                <Text style={styles.srsMetricVal}>
                  {item.stability < 1 ? 'Today' : `In ${Math.round(item.stability)}d`}
                </Text>
              </View>
            ) : null}
            {item.reps !== undefined && (
              <View style={styles.srsMetricBadge}>
                <Text style={styles.srsMetricLabel}>Reviews:</Text>
                <Text style={styles.srsMetricVal}>{item.reps}</Text>
              </View>
            )}
            {item.lapses !== undefined && item.lapses > 0 && (
              <View style={[styles.srsMetricBadge, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.srsMetricLabel, { color: '#DC2626' }]}>
                  Lapses:
                </Text>
                <Text style={[styles.srsMetricVal, { color: '#DC2626' }]}>
                  {item.lapses}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.wordItemFooter}>
          <Text style={styles.wordOriginText}>
            {item.theme_name} • {item.deck_name}
          </Text>

          {!isQueued ? (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.addQueueBtn}
              onPress={() =>
                onAddWord(
                  item.front_lexeme_id,
                  item.back_lexeme_id,
                  item.concept_id
                )
              }
            >
              <Plus size={14} color="#FFFFFF" />
              <Text style={styles.addQueueBtnText}>
                {t('explore.add_to_queue')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.inQueueBadge}>
              <Check size={14} color="#2563EB" />
              <Text style={styles.inQueueBadgeText}>{t('explore.in_queue')}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }
);

interface DeckCardDetailItemProps {
  item: DeckCardDetail;
  isQueued: boolean;
  onAddWord: (frontLexemeId: number, backLexemeId: number, conceptId: string) => void;
  onSpeak: (term: string, lang: string) => void;
}

const DeckCardDetailItem = React.memo<DeckCardDetailItemProps>(
  ({ item, isQueued, onAddWord, onSpeak }) => {
    const { t } = useTranslation();
    const cefrColors = getCefrBadgeColors(item.front_cefr);

    return (
      <View style={styles.modalWordCard}>
        <View style={styles.wordItemHeader}>
          <View style={styles.wordTermBox}>
            <Text style={styles.wordFrontTerm}>{item.front_term}</Text>
            <TouchableOpacity
              style={styles.speakerBtn}
              onPress={() => onSpeak(item.front_term, item.front_lang)}
            >
              <Volume2 size={16} color="#D97706" />
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.cefrBadge,
              { backgroundColor: cefrColors.bg, borderColor: cefrColors.border },
            ]}
          >
            <Text style={[styles.cefrBadgeText, { color: cefrColors.text }]}>
              {item.front_cefr}
            </Text>
          </View>
        </View>

        <Text style={styles.wordBackTerm}>{item.back_term}</Text>

        <View style={styles.modalWordCardFooter}>
          {isQueued ? (
            <View style={styles.inQueueBadge}>
              <Check size={14} color="#059669" />
              <Text style={[styles.inQueueBadgeText, { color: '#059669' }]}>
                {t('explore.in_queue')}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.addQueueBtn}
              onPress={() =>
                onAddWord(
                  item.front_lexeme_id,
                  item.back_lexeme_id,
                  item.concept_id
                )
              }
            >
              <Plus size={14} color="#FFFFFF" />
              <Text style={styles.addQueueBtnText}>
                {t('explore.add_to_queue')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
);

interface ThemeDeckCardProps {
  deck: DeckWithProgress;
  onOpenDeck: (deck: DeckWithProgress) => void;
}

const ThemeDeckCard = React.memo<ThemeDeckCardProps>(({ deck, onOpenDeck }) => {
  const { t } = useTranslation();
  const isFullyQueued = deck.card_count > 0 && deck.garrisoned_count >= deck.card_count;
  const queuePercent =
    deck.card_count > 0
      ? Math.min(100, Math.round((deck.garrisoned_count / deck.card_count) * 100))
      : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.deckCard}
      onPress={() => onOpenDeck(deck)}
    >
      <View style={styles.deckCardMain}>
        <View style={styles.deckIconBox}>
          {renderDeckIcon(deck.icon_name, 20, '#B45309')}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.deckTitleRow}>
            <Text style={styles.deckName}>{deck.name}</Text>
            <View style={styles.tierPill}>
              <Text style={styles.tierPillText}>
                Tier {deck.difficulty_level} • {deck.cefr_level}
              </Text>
            </View>
          </View>
        </View>
        <ChevronRight size={18} color="#94A3B8" />
      </View>

      {/* Progress Bar & Word Counts */}
      <View style={styles.deckProgressRow}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${queuePercent}%` },
              isFullyQueued && { backgroundColor: '#10B981' },
            ]}
          />
        </View>
        <Text style={styles.deckProgressText}>
          {deck.garrisoned_count}/{deck.card_count} {t('common.all').toLowerCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

interface ThemeGroupSectionProps {
  theme: ThemeGroup;
  onOpenDeck: (deck: DeckWithProgress) => void;
}

const ThemeGroupSection = React.memo<ThemeGroupSectionProps>(({ theme, onOpenDeck }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.themeGroup}>
      {/* Theme Header */}
      <View style={styles.themeHeader}>
        <View style={styles.themeIconBox}>
          {renderDeckIcon(theme.icon_name, 22, '#92400E')}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.themeTitle}>{theme.name}</Text>
        </View>
      </View>

      {/* Decks under Theme */}
      <View style={styles.decksList}>
        {theme.decks.map((deck) => (
          <ThemeDeckCard
            key={deck.id}
            deck={deck}
            onOpenDeck={onOpenDeck}
          />
        ))}
      </View>
    </View>
  );
});

export const DecksRoadmap: React.FC<DecksRoadmapProps> = ({
  onStudyDeck,
  onStartReview,
  targetLang: propTargetLang,
  originLang: propOriginLang,
  onInsufficientTokens,
}) => {
  const { t, i18n } = useTranslation();
  const targetLang = propTargetLang || 'es';
  const originLang = propOriginLang || i18n.language || 'en';

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<MainTab>('decks');

  // Tab 1: Decks (Themes) State
  const [themes, setThemes] = useState<ThemeGroup[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<DeckWithProgress | null>(null);
  const [deckCards, setDeckCards] = useState<DeckCardDetail[]>([]);
  const [loadingDeckCards, setLoadingDeckCards] = useState(false);
  const [addingAllDeck, setAddingAllDeck] = useState(false);

  // Tab 2: Difficulty (CEFR / Tiers) State
  const [loadingDifficulty, setLoadingDifficulty] = useState(false);
  const [mapDecks, setMapDecks] = useState<DeckWithProgress[]>([]);

  // Tab 3: Mastery (SRS Status) State
  const [masteryStage, setMasteryStage] = useState<MasteryStage>('slipping');
  const [masterySummary, setMasterySummary] = useState<MasterySummary | null>(null);
  const [masteryWords, setMasteryWords] = useState<MasteryWordItem[]>([]);
  const [loadingMastery, setLoadingMastery] = useState(false);
  const [adoptingAvailable, setAdoptingAvailable] = useState(false);

  const [masteryPage, setMasteryPage] = useState(0);
  const [hasMoreMastery, setHasMoreMastery] = useState(true);
  const [loadingMoreMastery, setLoadingMoreMastery] = useState(false);

  // Local word queue state tracking for instantaneous UI response
  const [locallyQueuedWordIds, setLocallyQueuedWordIds] = useState<Set<number>>(new Set());

  // Initial Load
  useEffect(() => {
    loadAllData();
  }, [targetLang, originLang]);

  const loadAllData = async () => {
    await Promise.all([
      loadDecksData(),
      loadDifficultyData(),
      loadMasteryData(masteryStage),
    ]);
  };

  const loadDecksData = async () => {
    try {
      const data = await getThemesWithProgressiveDecks(targetLang);
      setThemes(data);
    } catch (e) {
      console.warn('[Explore] Error loading decks:', e);
    }
  };

  const loadDifficultyData = async () => {
    setLoadingDifficulty(true);
    try {
      const decks = await getAllDecksOrderedByDifficulty(targetLang);
      setMapDecks(decks);
    } catch (e) {
      console.warn('[Explore] Error loading difficulty:', e);
    } finally {
      setLoadingDifficulty(false);
    }
  };

  const loadMasteryData = async (stage: MasteryStage) => {
    setLoadingMastery(true);
    setMasteryPage(0);
    try {
      const [summary, words] = await Promise.all([
        getMasterySummary(targetLang),
        getMasteryWords(stage, targetLang, originLang, 50, 0),
      ]);
      setMasterySummary(summary);
      setMasteryWords(words);
      setHasMoreMastery(words.length === 50);
    } catch (e) {
      console.warn('[Explore] Error loading mastery:', e);
    } finally {
      setLoadingMastery(false);
    }
  };

  const handleLoadMoreMastery = useCallback(async () => {
    if (loadingMoreMastery || !hasMoreMastery || loadingMastery) return;
    setLoadingMoreMastery(true);
    try {
      const nextPage = masteryPage + 1;
      const moreWords = await getMasteryWords(
        masteryStage,
        targetLang,
        originLang,
        50,
        nextPage * 50
      );
      if (moreWords.length > 0) {
        setMasteryWords((prev) => [...prev, ...moreWords]);
        setMasteryPage(nextPage);
      }
      setHasMoreMastery(moreWords.length === 50);
    } catch (e) {
      console.warn('[Explore] Error loading more mastery words:', e);
    } finally {
      setLoadingMoreMastery(false);
    }
  }, [loadingMoreMastery, hasMoreMastery, loadingMastery, masteryPage, masteryStage, targetLang, originLang]);

  // Open Deck Word Inspector
  const handleOpenDeck = useCallback(
    async (deck: DeckWithProgress) => {
      setSelectedDeck(deck);
      setLoadingDeckCards(true);
      try {
        const cards = await getCardsByDeck(deck.id, targetLang, deck.difficulty_slice, originLang);
        setDeckCards(cards);
      } catch (e) {
        console.warn('[Explore] Error loading deck cards:', e);
      } finally {
        setLoadingDeckCards(false);
      }
    },
    [targetLang, originLang]
  );

  // Add single word to queue
  const handleAddWord = useCallback(
    async (
      frontLexemeId: number,
      backLexemeId: number,
      conceptId: string
    ) => {
      const canLearn = await tokenWallet.canLearnWords(1);
      if (!canLearn) {
        onInsufficientTokens?.(1);
        return;
      }
      await tokenWallet.consumeWordAllowance(1);

      // Instant UI update
      setLocallyQueuedWordIds((prev) => new Set(prev).add(frontLexemeId));
      try {
        await addWordToQueue(frontLexemeId, backLexemeId, conceptId, targetLang, originLang);
        // Refresh background stats without blocking
        getMasterySummary(targetLang).then(setMasterySummary);
        getThemesWithProgressiveDecks(targetLang).then(setThemes);
        getAllDecksOrderedByDifficulty(targetLang).then(setMapDecks);
      } catch (e) {
        console.warn('[Explore] Error adding word:', e);
      }
    },
    [targetLang, originLang, onInsufficientTokens]
  );

  // Add all unqueued words in current deck
  const handleAddAllDeck = async () => {
    if (!selectedDeck) return;
    const unqueuedCards = deckCards.filter(
      (c) => !c.is_garrisoned && !locallyQueuedWordIds.has(c.front_lexeme_id)
    ).length;
    if (unqueuedCards === 0) return;

    const canLearn = await tokenWallet.canLearnWords(unqueuedCards);
    if (!canLearn) {
      onInsufficientTokens?.(unqueuedCards);
      return;
    }

    setAddingAllDeck(true);
    try {
      await tokenWallet.consumeWordAllowance(unqueuedCards);
      await garrisonEntireDeck(selectedDeck.id, targetLang, selectedDeck.difficulty_slice, originLang);
      const updatedCards = await getCardsByDeck(selectedDeck.id, targetLang, selectedDeck.difficulty_slice, originLang);
      setDeckCards(updatedCards);
      await loadDecksData();
      await loadDifficultyData();
      await loadMasteryData(masteryStage);
    } catch (e) {
      console.warn('[Explore] Error adding all deck cards:', e);
    } finally {
      setAddingAllDeck(false);
    }
  };

  // Adopt available words from mastery tab
  const handleAdoptAvailable = async (limit = 10) => {
    const canLearn = await tokenWallet.canLearnWords(limit);
    if (!canLearn) {
      onInsufficientTokens?.(limit);
      return;
    }

    setAdoptingAvailable(true);
    try {
      await tokenWallet.consumeWordAllowance(limit);
      await addAvailableWordsToQueue(limit, targetLang);
      await loadMasteryData('available');
      await loadDecksData();
      await loadDifficultyData();
    } catch (e) {
      console.warn('[Explore] Error adopting available:', e);
    } finally {
      setAdoptingAvailable(false);
    }
  };

  const handleSpeak = useCallback((term: string, lang: string) => {
    speakWord(term, lang);
  }, []);

  const renderMasteryWord = useCallback(
    ({ item }: { item: MasteryWordItem }) => {
      const isQueued =
        item.is_queued || locallyQueuedWordIds.has(item.front_lexeme_id);
      return (
        <MasteryWordCard
          item={item}
          isQueued={isQueued}
          onAddWord={handleAddWord}
          onSpeak={handleSpeak}
        />
      );
    },
    [locallyQueuedWordIds, handleAddWord, handleSpeak]
  );

  const masteryKeyExtractor = useCallback(
    (item: MasteryWordItem) => `mastery_${item.front_lexeme_id}`,
    []
  );

  const renderDeckCardDetail = useCallback(
    ({ item }: { item: DeckCardDetail }) => {
      const isQueued =
        item.is_garrisoned || locallyQueuedWordIds.has(item.front_lexeme_id);
      return (
        <DeckCardDetailItem
          item={item}
          isQueued={isQueued}
          onAddWord={handleAddWord}
          onSpeak={handleSpeak}
        />
      );
    },
    [locallyQueuedWordIds, handleAddWord, handleSpeak]
  );

  const deckCardsKeyExtractor = useCallback(
    (item: DeckCardDetail) => `deck_card_${item.front_lexeme_id}`,
    []
  );

  const renderThemeGroup = useCallback(
    ({ item }: { item: ThemeGroup }) => (
      <ThemeGroupSection
        theme={item}
        onOpenDeck={handleOpenDeck}
      />
    ),
    [handleOpenDeck]
  );

  const themeKeyExtractor = useCallback((item: ThemeGroup) => item.id, []);

  return (
    <View style={styles.container}>
      {/* 3-Tab Segmented Switcher */}
      <View style={styles.topTabBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.tabButton, activeTab === 'decks' && styles.tabButtonActive]}
          onPress={() => setActiveTab('decks')}
        >
          <Layers
            size={16}
            color={activeTab === 'decks' ? '#B45309' : '#64748B'}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'decks' && styles.tabButtonTextActive]}
          >
            {t('explore.tab_decks')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.tabButton, activeTab === 'difficulty' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('difficulty');
            loadDifficultyData();
          }}
        >
          <TrendingUp
            size={16}
            color={activeTab === 'difficulty' ? '#B45309' : '#64748B'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'difficulty' && styles.tabButtonTextActive,
            ]}
          >
            {t('explore.tab_difficulty')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.tabButton, activeTab === 'mastery' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('mastery');
            loadMasteryData(masteryStage);
          }}
        >
          <Brain
            size={16}
            color={activeTab === 'mastery' ? '#B45309' : '#64748B'}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'mastery' && styles.tabButtonTextActive]}
          >
            {t('explore.tab_mastery')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Role & Question Header Banner */}
      <View style={styles.headerBanner}>
        {activeTab === 'decks' && (
          <>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{t('explore.tab_decks_role')}</Text>
            </View>
            <Text style={styles.questionTitle}>{t('explore.tab_decks_question')}</Text>
          </>
        )}
        {activeTab === 'mastery' && (
          <>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{t('explore.tab_mastery_role')}</Text>
            </View>
            <Text style={styles.questionTitle}>{t('explore.tab_mastery_question')}</Text>
          </>
        )}
      </View>

      {/* TAB 1: DECKS (THEMES) */}
      {activeTab === 'decks' && (
        <FlatList
          data={themes}
          keyExtractor={themeKeyExtractor}
          renderItem={renderThemeGroup}
          style={styles.tabContent}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          updateCellsBatchingPeriod={50}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}

      {/* TAB 2: DIFFICULTY (CEFR / TIERS) */}
      {activeTab === 'difficulty' && (
        <DifficultyProgressionMap
          decks={mapDecks}
          loading={loadingDifficulty}
          onSelectDeck={(deck) => handleOpenDeck(deck)}
        />
      )}

      {/* TAB 3: MASTERY (SRS STATUS) */}
      {activeTab === 'mastery' && (
        <View style={styles.tabContent}>
          {/* Stage Selector Grid */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stageSelectorScroll}
          >
            {/* Slipping Away */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.stageCard,
                masteryStage === 'slipping' && styles.stageCardActiveSlipping,
              ]}
              onPress={() => {
                setMasteryStage('slipping');
                loadMasteryData('slipping');
              }}
            >
              <View style={styles.stageCardTop}>
                <AlertCircle
                  size={16}
                  color={masteryStage === 'slipping' ? '#DC2626' : '#EF4444'}
                />
                <View style={[styles.stageBadge, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.stageBadgeText, { color: '#B91C1C' }]}>
                    {masterySummary?.slipping_count || 0}
                  </Text>
                </View>
              </View>
              <Text style={styles.stageCardTitle}>{t('explore.stage_slipping')}</Text>
              <Text style={styles.stageCardSubtitle}>{t('explore.stage_slipping_desc')}</Text>
            </TouchableOpacity>

            {/* Learning */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.stageCard,
                masteryStage === 'learning' && styles.stageCardActiveLearning,
              ]}
              onPress={() => {
                setMasteryStage('learning');
                loadMasteryData('learning');
              }}
            >
              <View style={styles.stageCardTop}>
                <Clock
                  size={16}
                  color={masteryStage === 'learning' ? '#2563EB' : '#3B82F6'}
                />
                <View style={[styles.stageBadge, { backgroundColor: '#DBEAFE' }]}>
                  <Text style={[styles.stageBadgeText, { color: '#1D4ED8' }]}>
                    {masterySummary?.learning_count || 0}
                  </Text>
                </View>
              </View>
              <Text style={styles.stageCardTitle}>{t('explore.stage_learning')}</Text>
              <Text style={styles.stageCardSubtitle}>{t('explore.stage_learning_desc')}</Text>
            </TouchableOpacity>

            {/* Mastered */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.stageCard,
                masteryStage === 'mastered' && styles.stageCardActiveMastered,
              ]}
              onPress={() => {
                setMasteryStage('mastered');
                loadMasteryData('mastered');
              }}
            >
              <View style={styles.stageCardTop}>
                <Sparkles
                  size={16}
                  color={masteryStage === 'mastered' ? '#059669' : '#10B981'}
                />
                <View style={[styles.stageBadge, { backgroundColor: '#D1FAE5' }]}>
                  <Text style={[styles.stageBadgeText, { color: '#047857' }]}>
                    {masterySummary?.mastered_count || 0}
                  </Text>
                </View>
              </View>
              <Text style={styles.stageCardTitle}>{t('explore.stage_mastered')}</Text>
              <Text style={styles.stageCardSubtitle}>{t('explore.stage_mastered_desc')}</Text>
            </TouchableOpacity>

            {/* New in Queue */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.stageCard,
                masteryStage === 'new_in_queue' && styles.stageCardActiveNew,
              ]}
              onPress={() => {
                setMasteryStage('new_in_queue');
                loadMasteryData('new_in_queue');
              }}
            >
              <View style={styles.stageCardTop}>
                <Layers
                  size={16}
                  color={masteryStage === 'new_in_queue' ? '#7C3AED' : '#8B5CF6'}
                />
                <View style={[styles.stageBadge, { backgroundColor: '#EDE9FE' }]}>
                  <Text style={[styles.stageBadgeText, { color: '#6D28D9' }]}>
                    {masterySummary?.new_queue_count || 0}
                  </Text>
                </View>
              </View>
              <Text style={styles.stageCardTitle}>{t('explore.stage_new')}</Text>
              <Text style={styles.stageCardSubtitle}>{t('explore.stage_new_desc')}</Text>
            </TouchableOpacity>
          </ScrollView>

          {masteryStage === 'slipping' && (masterySummary?.slipping_count || 0) > 0 && (
            <View style={styles.masteryActionCard}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.reviewSlippingBtn}
                onPress={() => onStartReview && onStartReview()}
              >
                <Play size={16} color="#FFFFFF" />
                <Text style={styles.reviewSlippingBtnText}>
                  Review Slipping Words Now ({masterySummary?.slipping_count})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Word List for Mastery Stage */}
          {loadingMastery ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#D97706" />
            </View>
          ) : (
            <FlatList
              data={masteryWords}
              keyExtractor={masteryKeyExtractor}
              renderItem={renderMasteryWord}
              contentContainerStyle={{ paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={5}
              removeClippedSubviews={true}
              onEndReached={handleLoadMoreMastery}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMoreMastery ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#D97706" />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t('explore.no_words_found')}</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* DECK WORD INSPECTOR MODAL */}
      <Modal
        visible={Boolean(selectedDeck)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedDeck(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalDeckTitle}>{selectedDeck?.name}</Text>
                <Text style={styles.modalDeckSub}>
                  Tier {selectedDeck?.difficulty_level} • {selectedDeck?.cefr_level} •{' '}
                  {deckCards.length} {t('common.all').toLowerCase()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setSelectedDeck(null)}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Card List */}
            {loadingDeckCards ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color="#D97706" />
              </View>
            ) : (
              <FlatList
                data={deckCards}
                keyExtractor={deckCardsKeyExtractor}
                renderItem={renderDeckCardDetail}
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                windowSize={5}
                removeClippedSubviews={true}
              />
            )}

            {/* Modal Bottom Action Bar */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.modalAddAllBtn}
                onPress={handleAddAllDeck}
                disabled={addingAllDeck}
              >
                {addingAllDeck ? (
                  <ActivityIndicator size="small" color="#B45309" />
                ) : (
                  <>
                    <PlusCircle size={16} color="#B45309" />
                    <Text style={styles.modalAddAllText}>
                      {t('explore.add_all_to_queue')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.modalStudyBtn}
                onPress={() => {
                  if (selectedDeck) {
                    onStudyDeck(selectedDeck.id, selectedDeck.name);
                    setSelectedDeck(null);
                  }
                }}
              >
                <Play size={16} color="#FFFFFF" />
                <Text style={styles.modalStudyText}>{t('explore.study_deck')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEFCE8',
  },
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#92400E',
  },
  headerBanner: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  themeGroup: {
    marginBottom: 20,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  themeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#78350F',
  },
  themeDesc: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 2,
  },
  decksList: {
    gap: 10,
  },
  deckCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deckCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deckIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  deckName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
  },
  tierPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  deckDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  deckProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#D97706',
    borderRadius: 3,
  },
  deckProgressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tierSelectorScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    marginBottom: 10,
  },
  tierFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  tierFilterChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  tierFilterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tierFilterChipTextActive: {
    color: '#92400E',
  },
  tierCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  tierSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
  },
  summaryStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  adoptTierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  adoptTierButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },
  wordItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  wordItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  wordTermBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordFrontTerm: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  speakerBtn: {
    padding: 4,
  },
  cefrBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  cefrBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  wordBackTerm: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  wordDescText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 16,
  },
  wordItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  wordOriginText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    flex: 1,
  },
  inQueueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  inQueueBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  masteredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  masteredBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  addQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  addQueueBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stageSelectorScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  stageCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  stageCardActiveSlipping: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  stageCardActiveLearning: {
    borderColor: '#3B82F6',
    backgroundColor: '#F0F7FF',
  },
  stageCardActiveMastered: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  stageCardActiveNew: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  stageCardActiveAvailable: {
    borderColor: '#14B8A6',
    backgroundColor: '#F0FDFA',
  },
  stageCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stageCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  stageCardSubtitle: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 13,
  },
  masteryActionCard: {
    marginBottom: 12,
  },
  adoptAvailableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  adoptAvailableBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reviewSlippingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  reviewSlippingBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  srsMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  srsMetricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  srsMetricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  srsMetricVal: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalDeckTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
  },
  modalDeckSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 6,
  },
  modalWordCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalWordCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modalAddAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  modalAddAllText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  modalStudyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  modalStudyText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
