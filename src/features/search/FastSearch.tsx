import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Search, Sparkles, Volume2, Check, Plus, X } from 'lucide-react-native';
import { searchLexemesFTS, addCardToQueue } from '../../db/vault';
import { speakWord } from '../../utils/tts';
import { ProfessorOwlMascot } from '../../components/mascot/Mascots';
import { LevelBadge } from '../../components/ui/LevelBadge';
import { LabCard } from '../../components/ui/LabCard';
import { tokenWallet } from '../../services/tokenWallet';
import { formatLanguageCode } from '../../locales/languages';

interface FastSearchProps {
  onInsufficientTokens?: (requiredWords: number) => void;
}

export interface SearchResultCardProps {
  item: any;
  isQueued: boolean;
  onLearn: (item: any) => void;
  onSpeak: (term: string, lang: string) => void;
}

export const SearchResultCard = React.memo<SearchResultCardProps>(
  ({ item, isQueued, onLearn, onSpeak }) => {
    return (
      <LabCard style={styles.resultCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.term}>{item.term}</Text>
            <Text style={styles.langAndPos}>
              {formatLanguageCode(item.language)} • {item.pos || 'noun'}
            </Text>
          </View>
          <LevelBadge level={item.cefr_level} size="sm" />
        </View>

        <View style={styles.cardFooter}>
          <Pressable
            style={({ pressed }) => [
              styles.audioBtn,
              {
                transform: [{ translateY: pressed ? 1 : 0 }],
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => onSpeak(item.term, item.language)}
          >
            <Volume2 size={16} color="#78350F" style={{ marginRight: 6 }} />
            <Text style={styles.audioText}>Hear Sound</Text>
          </Pressable>

          <Pressable
            disabled={isQueued}
            style={({ pressed }) => [
              styles.learnBtn,
              isQueued && styles.learnBtnDone,
              {
                transform: [{ translateY: pressed ? 2 : 0 }],
                opacity: isQueued ? 0.6 : pressed ? 0.88 : 1,
              },
            ]}
            onPress={() => onLearn(item)}
          >
            {isQueued ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Check size={14} color="#166534" style={{ marginRight: 4 }} />
                <Text style={styles.learnBtnText}>Learned</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Plus size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.learnBtnText}>Learn Word</Text>
              </View>
            )}
          </Pressable>
        </View>
      </LabCard>
    );
  }
);
SearchResultCard.displayName = 'SearchResultCard';

export const FastSearch: React.FC<FastSearchProps> = ({ onInsufficientTokens }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [queuedSet, setQueuedSet] = useState<Set<number>>(new Set());

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    const res = await searchLexemesFTS(text);
    setResults(res);
  };

  const handleLearn = React.useCallback(
    async (item: any) => {
      const canLearn = await tokenWallet.canLearnWords(1);
      if (!canLearn) {
        onInsufficientTokens?.(1);
        return;
      }
      await tokenWallet.consumeWordAllowance(1);
      await addCardToQueue(item.id, item.id);
      setQueuedSet((prev) => new Set(prev).add(item.id));
    },
    [onInsufficientTokens]
  );

  const handleSpeak = React.useCallback((term: string, lang: string) => {
    speakWord(term, lang);
  }, []);

  const renderResultItem = React.useCallback(
    ({ item }: { item: any }) => (
      <SearchResultCard
        item={item}
        isQueued={queuedSet.has(item.id)}
        onLearn={handleLearn}
        onSpeak={handleSpeak}
      />
    ),
    [queuedSet, handleLearn, handleSpeak]
  );

  const keyExtractor = React.useCallback((item: any) => item.id.toString(), []);

  return (
    <View style={styles.container}>
      {/* Research Library Header with Professor Barnaby */}
      <View style={styles.headerBox}>
        <ProfessorOwlMascot size={75} />
        <View style={styles.headerTextBox}>
          <Text style={styles.title}>THE PROFESSOR&apos;S RESEARCH LIBRARY</Text>
          <Text style={styles.subtitle}>
            FTS5 Full-Text Search across lab cards
          </Text>
        </View>
      </View>

      {/* Lab Input Field */}
      <View style={styles.searchBarContainer}>
        <Search size={18} color="#78350F" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          placeholder="Search cards by prefix or keyword..."
          placeholderTextColor="#78350F88"
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearBtn}>
            <X size={16} color="#78350F" />
          </TouchableOpacity>
        )}
      </View>

      {/* Results List */}
      <FlatList
        data={results}
        keyExtractor={keyExtractor}
        renderItem={renderResultItem}
        contentContainerStyle={styles.resultsList}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Sparkles size={44} color="#D97706" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>
              {query ? 'No matching results found' : 'The research library awaits your query'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {query
                ? 'Try inquiring with another word stem or CEFR term.'
                : 'Search any word across supported languages.'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTextBox: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderBottomWidth: 4,
    borderBottomColor: '#94A3B8',
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  clearBtn: {
    padding: 6,
  },
  clearText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94A3B8',
  },
  resultsList: {
    padding: 16,
    paddingBottom: 40,
  },
  resultCard: {
    marginBottom: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  term: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  langAndPos: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 10,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  audioEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  audioText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  learnBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderBottomWidth: 3,
    borderBottomColor: '#1D4ED8',
  },
  learnBtnDone: {
    backgroundColor: '#94A3B8',
    borderBottomColor: '#64748B',
  },
  learnBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#475569',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
