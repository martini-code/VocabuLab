import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
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
  Dices,
  X,
  Play,
  ChevronRight,
  BookOpen,
  TreePine,
  Coins,
  Users,
  Utensils,
  Wine,
  Footprints,
  CloudLightning,
  Compass,
  Scale,
  Award,
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
  addEntireDeckToQueue,
  addWordToQueue,
  getWordsByDifficulty,
  getDifficultyStats,
  addWordsByDifficultyToQueue,
  getMasterySummary,
  getMasteryWords,
  addAvailableWordsToQueue,
  DeckTitleLanguageMode,
  searchLexemesFTS,
} from '../../db/vault';
import { DifficultyProgressionMap } from './DifficultyProgressionMap';
import { DeckIcon } from '../../components/icons/DeckIcon';
import { speakWord } from '../../utils/tts';
import { useTranslation } from 'react-i18next';
import { tokenWallet } from '../../services/tokenWallet';
import { RandomDiscoveryView } from '../../components/discovery/RandomDiscoveryView';
import { SearchResultCard } from '../search/FastSearch';

export interface DecksRoadmapProps {
  onStudyDeck: (deckId: string, deckName: string) => void;
  onStartReview?: () => void;
  targetLang?: string;
  originLang?: string;
  deckTitleLanguage?: DeckTitleLanguageMode;
  onInsufficientTokens?: (requiredWords: number) => void;
}

type MainTab = 'decks' | 'difficulty' | 'mastery';

function renderDeckIcon(iconName: string, size = 20, color = '#64748B') {
  return <DeckIcon name={iconName} size={size} color={color} />;
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
            <Pressable
              style={({ pressed }) => [
                styles.addQueueBtn,
                {
                  transform: [{ translateY: pressed ? 1 : 0 }],
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
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
            </Pressable>
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
            <Pressable
              style={({ pressed }) => [
                styles.addQueueBtn,
                {
                  transform: [{ translateY: pressed ? 1 : 0 }],
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
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
            </Pressable>
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
  const queuedCount = deck.queued_count ?? 0;
  const isFullyQueued = deck.card_count > 0 && queuedCount >= deck.card_count;
  const queuePercent =
    deck.card_count > 0
      ? Math.min(100, Math.round((queuedCount / deck.card_count) * 100))
      : 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.deckCard,
        {
          transform: [{ translateY: pressed ? 2 : 0 }],
          opacity: pressed ? 0.9 : 1,
        },
      ]}
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
          {queuedCount}/{deck.card_count} {t('common.all').toLowerCase()}
        </Text>
      </View>
    </Pressable>
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
  deckTitleLanguage,
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
  const [randomDiscoveryActive, setRandomDiscoveryActive] = useState(false);

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

  // Search State in Decks Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(
    async (text: string) => {
      setSearchQuery(text);
      if (!text.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const res = await searchLexemesFTS(text, targetLang);
        setSearchResults(res);
      } catch (err) {
        console.warn('[DecksRoadmap] Error searching lexemes:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [targetLang]
  );

  // Initial Load
  useEffect(() => {
    loadAllData();
  }, [targetLang, originLang, deckTitleLanguage]);

  const loadAllData = async () => {
    await Promise.all([
      loadDecksData(),
      loadDifficultyData(),
      loadMasteryData(masteryStage),
    ]);
  };

  const loadDecksData = async () => {
    try {
      const data = await getThemesWithProgressiveDecks(targetLang, originLang, deckTitleLanguage);
      setThemes(data);
    } catch (e) {
      console.warn('[Explore] Error loading decks:', e);
    }
  };

  const loadDifficultyData = async () => {
    setLoadingDifficulty(true);
    try {
      const decks = await getAllDecksOrderedByDifficulty(targetLang, originLang, deckTitleLanguage);
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
        getMasteryWords(stage, targetLang, originLang, 50, 0, deckTitleLanguage),
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
        nextPage * 50,
        deckTitleLanguage
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
  }, [loadingMoreMastery, hasMoreMastery, loadingMastery, masteryPage, masteryStage, targetLang, originLang, deckTitleLanguage]);

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
        getThemesWithProgressiveDecks(targetLang, originLang, deckTitleLanguage).then(setThemes);
        getAllDecksOrderedByDifficulty(targetLang, originLang, deckTitleLanguage).then(setMapDecks);
      } catch (e) {
        console.warn('[Explore] Error adding word:', e);
      }
    },
    [targetLang, originLang, deckTitleLanguage, onInsufficientTokens]
  );

  // Add all unqueued words in current deck
  const handleAddAllDeck = async () => {
    if (!selectedDeck) return;
    const unqueuedCards = deckCards.filter(
      (c) => !c.is_queued && !locallyQueuedWordIds.has(c.front_lexeme_id)
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
      await addEntireDeckToQueue(selectedDeck.id, targetLang, selectedDeck.difficulty_slice, originLang);
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
        item.is_queued || locallyQueuedWordIds.has(item.front_lexeme_id);
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
      {/* Top Header Row with Screen Title and Refactored 10 Random Words Action Pill */}
      <View style={styles.topHeaderRow}>
        <View style={styles.topHeaderLeft}>
          <Text style={styles.topHeaderTitle}>LAB LIBRARY</Text>
          <Text style={styles.topHeaderSubtitle}>Curated decks & vocabulary roadmap</Text>
        </View>
        <TouchableOpacity
          style={styles.randomDiscoveryPill}
          onPress={() => setRandomDiscoveryActive(true)}
          activeOpacity={0.8}
          testID="open-random-discovery-btn"
        >
          <Dices size={15} color="#78350F" style={{ marginRight: 5 }} />
          <Text style={styles.randomDiscoveryPillText}>
            {t('random_discovery.btn_discover', { defaultValue: '10 Random Words' })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3-Tab Segmented Switcher */}
      <View style={styles.topTabBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.tabButton,
            activeTab === 'decks' && !randomDiscoveryActive && styles.tabButtonActive,
          ]}
          onPress={() => {
            setActiveTab('decks');
            setRandomDiscoveryActive(false);
          }}
        >
          <Layers
            size={16}
            color={activeTab === 'decks' && !randomDiscoveryActive ? '#B45309' : '#64748B'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'decks' && !randomDiscoveryActive && styles.tabButtonTextActive,
            ]}
          >
            {t('explore.tab_decks')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.tabButton,
            activeTab === 'difficulty' && !randomDiscoveryActive && styles.tabButtonActive,
          ]}
          onPress={() => {
            setActiveTab('difficulty');
            setRandomDiscoveryActive(false);
            loadDifficultyData();
          }}
        >
          <TrendingUp
            size={16}
            color={activeTab === 'difficulty' && !randomDiscoveryActive ? '#B45309' : '#64748B'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'difficulty' && !randomDiscoveryActive && styles.tabButtonTextActive,
            ]}
          >
            {t('explore.tab_difficulty')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.tabButton,
            activeTab === 'mastery' && !randomDiscoveryActive && styles.tabButtonActive,
          ]}
          onPress={() => {
            setActiveTab('mastery');
            setRandomDiscoveryActive(false);
            loadMasteryData(masteryStage);
          }}
        >
          <Brain
            size={16}
            color={activeTab === 'mastery' && !randomDiscoveryActive ? '#B45309' : '#64748B'}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'mastery' && !randomDiscoveryActive && styles.tabButtonTextActive,
            ]}
          >
            {t('explore.tab_mastery')}
          </Text>
        </TouchableOpacity>
      </View>

      {randomDiscoveryActive ? (
        <RandomDiscoveryView
          onExit={() => setRandomDiscoveryActive(false)}
          targetLang={targetLang}
          originLang={originLang}
          onInsufficientTokens={onInsufficientTokens}
          onWordLearned={(lexemeId) => {
            setLocallyQueuedWordIds((prev) => new Set(prev).add(lexemeId));
            getMasterySummary(targetLang).then(setMasterySummary);
            getThemesWithProgressiveDecks(targetLang, originLang, deckTitleLanguage).then(setThemes);
            getAllDecksOrderedByDifficulty(targetLang, originLang, deckTitleLanguage).then(setMapDecks);
          }}
        />
      ) : (
        <>
          {/* Search Bar in lieu of the old exploration card on Decks tab */}
          {activeTab === 'decks' && (
            <View style={styles.searchBarWrapper}>
              <View style={styles.searchBarContainer}>
                <Search size={18} color="#78350F" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('search.placeholder', { defaultValue: 'Search lab vocabulary, keywords, or meanings...' })}
                  placeholderTextColor="#78350F88"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="decks-search-input"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => handleSearch('')}
                    style={styles.clearSearchBtn}
                    testID="clear-decks-search-btn"
                  >
                    <X size={16} color="#78350F" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {activeTab === 'mastery' && (
            <View style={styles.headerBanner}>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{t('explore.tab_mastery_role')}</Text>
              </View>
              <Text style={styles.questionTitle}>{t('explore.tab_mastery_question')}</Text>
            </View>
          )}

          {/* TAB 1: DECKS (THEMES) OR SEARCH RESULTS */}
          {activeTab === 'decks' && (
            searchQuery.trim().length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => `search_${item.id}`}
                renderItem={({ item }) => (
                  <SearchResultCard
                    item={item}
                    isQueued={locallyQueuedWordIds.has(item.id)}
                    onLearn={() => handleAddWord(item.id, item.id, item.concept_id || `c_${item.id}`)}
                    onSpeak={(term, lang) => speakWord(term, lang)}
                  />
                )}
                style={styles.tabContent}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.searchEmptyContainer}>
                    <Sparkles size={40} color="#D97706" style={{ marginBottom: 10 }} />
                    <Text style={styles.searchEmptyTitle}>
                      {isSearching ? 'Searching lab cards...' : 'No matching cards found'}
                    </Text>
                    <Text style={styles.searchEmptySubtitle}>
                      {isSearching
                        ? 'Querying the dictionary database...'
                        : 'Try querying with another word stem or CEFR level.'}
                    </Text>
                  </View>
                }
              />
            ) : (
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
            )
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
    </>
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
              <Pressable
                style={({ pressed }) => [
                  styles.modalAddAllBtn,
                  {
                    transform: [{ translateY: pressed ? 1 : 0 }],
                    opacity: addingAllDeck ? 0.6 : pressed ? 0.85 : 1,
                  },
                ]}
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
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalStudyBtn,
                  {
                    transform: [{ translateY: pressed ? 1 : 0 }],
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => {
                  if (selectedDeck) {
                    onStudyDeck(selectedDeck.id, selectedDeck.name);
                    setSelectedDeck(null);
                  }
                }}
              >
                <Play size={16} color="#FFFFFF" />
                <Text style={styles.modalStudyText}>{t('explore.study_deck')}</Text>
              </Pressable>
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
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  randomDiscoveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D97706',
  },
  randomDiscoveryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#78350F',
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
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  topHeaderLeft: {
    flex: 1,
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  topHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  randomDiscoveryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 5,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  randomDiscoveryPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#78350F',
  },
  searchBarWrapper: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#78350F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#451A03',
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  searchEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  searchEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#78350F',
    marginBottom: 6,
    textAlign: 'center',
  },
  searchEmptySubtitle: {
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 18,
  },
});

