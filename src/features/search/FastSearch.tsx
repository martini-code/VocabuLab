import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { searchLexemesFTS, garrisonCard } from '../../db/vault';
import { speakWord } from '../../utils/tts';
import { WizardOwlMascot } from '../../components/mascot/Mascots';
import { ShieldBadge } from '../../components/ui/ShieldBadge';
import { ParchmentCard } from '../../components/ui/ParchmentCard';

export const FastSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [garrisonedSet, setGarrisonedSet] = useState<Set<number>>(new Set());

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    const res = await searchLexemesFTS(text);
    setResults(res);
  };

  const handleGarrison = async (item: any) => {
    await garrisonCard(item.id, 1);
    setGarrisonedSet((prev) => new Set(prev).add(item.id));
  };

  return (
    <View style={styles.container}>
      {/* Scriptorium Header with Archmage Barnaby */}
      <View style={styles.headerBox}>
        <WizardOwlMascot size={75} />
        <View style={styles.headerTextBox}>
          <Text style={styles.title}>THE WIZARD'S SCRIPTORIUM</Text>
          <Text style={styles.subtitle}>
            FTS5 Full-Text Search into 10,000+ CILI concept anchors
          </Text>
        </View>
      </View>

      {/* Spell Scroll Search Input */}
      <View style={styles.searchBarContainer}>
        <Text style={styles.scrollIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleSearch}
          placeholder="Cast an inquiry (e.g. espada, banquete, truth)..."
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Results List */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.resultsList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔮</Text>
            <Text style={styles.emptyTitle}>
              {query ? 'No matching runes found' : 'The enchanted archives await thy query'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {query
                ? 'Try inquiring with another word stem or CEFR term.'
                : 'Search any word across Spanish, English, French, or German.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isGarrisoned = garrisonedSet.has(item.id);

          return (
            <ParchmentCard style={styles.resultCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.term}>{item.term}</Text>
                  <Text style={styles.langAndPos}>
                    {item.language.toUpperCase()} • {item.pos || 'noun'}
                  </Text>
                </View>
                <ShieldBadge level={item.cefr_level} size="sm" />
              </View>

              <Text style={styles.conceptDesc}>"{item.concept_desc}"</Text>

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.audioBtn}
                  onPress={() => speakWord(item.term, item.language)}
                >
                  <Text style={styles.audioEmoji}>📯</Text>
                  <Text style={styles.audioText}>Hear Sound</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isGarrisoned}
                  style={[styles.garrisonBtn, isGarrisoned && styles.garrisonBtnDone]}
                  onPress={() => handleGarrison(item)}
                >
                  <Text style={styles.garrisonBtnText}>
                    {isGarrisoned ? '✓ In Fortress Deck' : '+ Garrison Card'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ParchmentCard>
          );
        }}
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
  scrollIcon: {
    fontSize: 18,
    marginRight: 8,
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
  conceptDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
    lineHeight: 18,
    fontStyle: 'italic',
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
  garrisonBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderBottomWidth: 3,
    borderBottomColor: '#1D4ED8',
  },
  garrisonBtnDone: {
    backgroundColor: '#94A3B8',
    borderBottomColor: '#64748B',
  },
  garrisonBtnText: {
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
