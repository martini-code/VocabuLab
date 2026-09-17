import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Castle, Scroll, Volume2, Check, Plus, Shield, TreePine, Swords, Coins, Key } from 'lucide-react-native';
import { Domain, Lexeme, CEFRLevel } from '../../types';
import { getDomainsHierarchy, getLexemesByDomain, addCardToQueue } from '../../db/vault';
import { speakWord } from '../../utils/tts';
import { ShieldBadge } from '../../components/ui/ShieldBadge';
import { ChunkyButton } from '../../components/ui/ChunkyButton';
import { ParchmentCard } from '../../components/ui/ParchmentCard';
import { tokenWallet } from '../../services/tokenWallet';

const CEFR_LEVELS: (CEFRLevel | 'ALL')[] = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

interface DomainBrowserProps {
  onStartTraining: () => void;
  onInsufficientTokens?: (requiredWords: number) => void;
}

export const DomainBrowser: React.FC<DomainBrowserProps> = ({
  onStartTraining,
  onInsufficientTokens,
}) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedCefr, setSelectedCefr] = useState<CEFRLevel | 'ALL'>('ALL');
  const [lexemes, setLexemes] = useState<Lexeme[]>([]);
  const [loading, setLoading] = useState(true);
  const [queuedIds, setQueuedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadDomains();
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      loadDomainLexemes(selectedDomain.id, selectedCefr);
    }
  }, [selectedDomain, selectedCefr]);

  const loadDomains = async () => {
    setLoading(true);
    const tree = await getDomainsHierarchy();
    setDomains(tree);
    if (tree.length > 0) {
      setSelectedDomain(tree[0]);
    }
    setLoading(false);
  };

  const loadDomainLexemes = async (domainId: string, cefr: string) => {
    const list = await getLexemesByDomain(domainId, cefr);
    setLexemes(list);
  };

  const handleSelectDomain = (domain: Domain) => {
    setSelectedDomain(domain);
  };

  const handleQueueWord = useCallback(async (lexemeId: number) => {
    const canLearn = await tokenWallet.canLearnWords(1);
    if (!canLearn) {
      onInsufficientTokens?.(1);
      return;
    }
    await tokenWallet.consumeWordAllowance(1);
    // Pair with English counterpart (mock/demo pair for immediate deck addition)
    await addCardToQueue(lexemeId, 1);
    setQueuedIds((prev) => new Set(prev).add(lexemeId));
  }, [onInsufficientTokens]);

  const handleSpeak = useCallback((term: string, language: string) => {
    speakWord(term, language);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Unrolling kingdom map...</Text>
      </View>
    );
  }

  const renderLexemeItem = useCallback(
    ({ item }: { item: Lexeme }) => {
      const isQueued = queuedIds.has(item.id);
      return (
        <DomainLexemeCard
          item={item}
          isQueued={isQueued}
          onQueueWord={handleQueueWord}
          onSpeak={handleSpeak}
        />
      );
    },
    [queuedIds, handleQueueWord, handleSpeak]
  );

  const lexemeKeyExtractor = useCallback((item: Lexeme) => item.id.toString(), []);

  return (
    <View style={styles.container}>
      {/* Top Realm Selector Tabs */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Castle size={20} color="#78350F" style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>KINGDOM ARCHIVES</Text>
        </View>
        <Text style={styles.headerSubtitle}>Select a territory to explore its ancient tongue</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.domainsScroll}
      >
        {domains.map((d) => {
          const isSelected = selectedDomain?.id === d.id;

          const renderTabIcon = () => {
            const iconColor = isSelected ? '#78350F' : '#94A3B8';
            if (d.id.includes('castle')) return <Castle size={18} color={iconColor} />;
            if (d.id.includes('academy')) return <Scroll size={18} color={iconColor} />;
            if (d.id.includes('wilderness')) return <TreePine size={18} color={iconColor} />;
            if (d.id.includes('armory')) return <Swords size={18} color={iconColor} />;
            if (d.id.includes('market')) return <Coins size={18} color={iconColor} />;
            return <Key size={18} color={iconColor} />;
          };

          return (
            <TouchableOpacity
              key={d.id}
              activeOpacity={0.8}
              onPress={() => handleSelectDomain(d)}
              style={[
                styles.domainTab,
                isSelected && styles.domainTabSelected,
              ]}
            >
              <View style={{ marginBottom: 4 }}>
                {renderTabIcon()}
              </View>
              <Text
                style={[
                  styles.domainName,
                  isSelected && styles.domainNameSelected,
                ]}
                numberOfLines={1}
              >
                {d.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* CEFR Level Shield Filter Bar */}
      <View style={styles.cefrFilterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cefrScroll}>
          {CEFR_LEVELS.map((level) => {
            const isSelected = selectedCefr === level;
            return (
              <TouchableOpacity
                key={level}
                onPress={() => setSelectedCefr(level)}
                style={[styles.cefrChip, isSelected && styles.cefrChipSelected]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {level === 'ALL' && <Shield size={12} color={isSelected ? '#78350F' : '#64748B'} style={{ marginRight: 4 }} />}
                  <Text style={[styles.cefrChipText, isSelected && styles.cefrChipTextSelected]}>
                    {level === 'ALL' ? 'ALL' : `${level}`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Lexemes List for selected Domain */}
      <FlatList
        data={lexemes}
        keyExtractor={lexemeKeyExtractor}
        contentContainerStyle={styles.listContainer}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Scroll size={40} color="#D97706" style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>No scrolls inscribed yet</Text>
            <Text style={styles.emptySubtitle}>Try selecting a different CEFR shield rank above.</Text>
          </View>
        }
        renderItem={renderLexemeItem}
      />

      {/* Bottom Embark on Quest Bar */}
      <View style={styles.bottomBar}>
        <ChunkyButton
          title="EMBARK ON REVIEW QUEST"
          subtitle={`${lexemes.length} words in this province`}
          color="green"
          onPress={onStartTraining}
          style={{ width: '100%' }}
        />
      </View>
    </View>
  );
};

interface DomainLexemeCardProps {
  item: Lexeme;
  isQueued: boolean;
  onQueueWord: (lexemeId: number) => void;
  onSpeak: (term: string, language: string) => void;
}

const DomainLexemeCard = React.memo<DomainLexemeCardProps>(({
  item,
  isQueued,
  onQueueWord,
  onSpeak,
}) => {
  return (
    <ParchmentCard style={styles.lexemeCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.wordInfo}>
          <Text style={styles.wordTerm}>{item.term}</Text>
          <Text style={styles.wordPos}>
            {item.language.toUpperCase()} • {item.pos || 'noun'}
          </Text>
        </View>
        <ShieldBadge level={item.cefr_level} size="sm" />
      </View>

      <View style={styles.cardActionsRow}>
        {/* Pronounce Horn */}
        <Pressable
          style={({ pressed }) => [
            styles.audioButton,
            {
              transform: [{ translateY: pressed ? 1 : 0 }],
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={() => onSpeak(item.term, item.language)}
        >
          <Volume2 size={16} color="#78350F" style={{ marginRight: 4 }} />
          <Text style={styles.audioText}>Listen</Text>
        </Pressable>

        {/* Learn Button */}
        <Pressable
          disabled={isQueued}
          style={({ pressed }) => [
            styles.queueButton,
            isQueued && styles.queueButtonDone,
            {
              transform: [{ translateY: pressed ? 2 : 0 }],
              opacity: isQueued ? 0.6 : pressed ? 0.88 : 1,
            },
          ]}
          onPress={() => onQueueWord(item.id)}
        >
          {isQueued ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Check size={14} color="#166534" style={{ marginRight: 4 }} />
              <Text style={[styles.queueButtonText, styles.queueButtonTextDone]}>
                Learned
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Plus size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.queueButtonText}>
                Learn Word
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </ParchmentCard>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  domainsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  domainTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  domainTabSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderBottomColor: '#D97706',
  },
  domainTabLocked: {
    opacity: 0.8,
  },
  domainEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  domainName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  domainNameSelected: {
    color: '#92400E',
  },
  domainNameLocked: {
    color: '#64748B',
  },
  lockBadge: {
    marginLeft: 6,
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cefrFilterRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  cefrScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  cefrChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
  },
  cefrChipSelected: {
    backgroundColor: '#1E293B',
    borderColor: '#0F172A',
  },
  cefrChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  cefrChipTextSelected: {
    color: '#FFFFFF',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 90,
  },
  lexemeCard: {
    marginBottom: 12,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordInfo: {
    flex: 1,
  },
  wordTerm: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  wordPos: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 10,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  audioIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  audioText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  queueButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderBottomWidth: 3,
    borderBottomColor: '#047857',
  },
  queueButtonDone: {
    backgroundColor: '#94A3B8',
    borderBottomColor: '#64748B',
  },
  queueButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  queueButtonTextDone: {
    color: '#F1F5F9',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 42,
    marginBottom: 8,
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
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 2,
    borderColor: '#E2E8F0',
  },
});
