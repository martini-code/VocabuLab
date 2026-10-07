import React from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { ArrowDown } from 'lucide-react-native';
import { DeckWithProgress } from '../../types';
import { DeckCardNode } from './DeckCardNode';

interface DifficultyProgressionMapProps {
  decks: DeckWithProgress[];
  loading: boolean;
  onSelectDeck: (deck: DeckWithProgress) => void;
}

type NodeAlignment = 'left' | 'center' | 'right';

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
          {idx === 1 && <ArrowDown size={10} color={isCompleted ? '#065F46' : '#64748B'} />}
        </View>
      ))}
    </View>
  );
};

interface TrailNodeItemProps {
  deck: DeckWithProgress;
  index: number;
  align: NodeAlignment;
  nextAlign: NodeAlignment;
  isLast: boolean;
  onSelectDeck: (deck: DeckWithProgress) => void;
}

const TrailNodeItem = React.memo<TrailNodeItemProps>(
  ({ deck, index, align, nextAlign, isLast, onSelectDeck }) => {
    const isDeckCompleted = deck.card_count > 0 && deck.mastered_count >= deck.card_count;

    return (
      <View style={styles.nodeWrapper}>
        <View
          style={[
            styles.nodePositioner,
            align === 'left' && styles.nodeAlignLeft,
            align === 'center' && styles.nodeAlignCenter,
            align === 'right' && styles.nodeAlignRight,
          ]}
        >
          <DeckCardNode deck={deck} index={index} onPress={() => onSelectDeck(deck)} />
        </View>

        {!isLast && (
          <PathConnector fromAlign={align} toAlign={nextAlign} isCompleted={isDeckCompleted} />
        )}
      </View>
    );
  }
);
TrailNodeItem.displayName = 'TrailNodeItem';

export const DifficultyProgressionMap: React.FC<DifficultyProgressionMapProps> = ({
  decks,
  loading,
  onSelectDeck,
}) => {
  // Alignments sequence for a meandering natural map trail
  const alignmentPattern: NodeAlignment[] = ['left', 'center', 'right', 'center'];

  const renderItem = React.useCallback(
    ({ item, index }: { item: DeckWithProgress; index: number }) => {
      const align = alignmentPattern[index % alignmentPattern.length];
      const nextIndex = index + 1;
      const nextAlign =
        nextIndex < decks.length ? alignmentPattern[nextIndex % alignmentPattern.length] : 'center';

      return (
        <TrailNodeItem
          deck={item}
          index={index}
          align={align}
          nextAlign={nextAlign}
          isLast={index === decks.length - 1}
          onSelectDeck={onSelectDeck}
        />
      );
    },
    [decks.length, onSelectDeck]
  );

  const keyExtractor = React.useCallback((item: DeckWithProgress) => item.id, []);

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#D97706" />
      </View>
    );
  }

  return (
    <FlatList
      data={decks}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={5}
      removeClippedSubviews={true}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  centerLoading: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTrailContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  nodeWrapper: {
    width: '100%',
    alignItems: 'center',
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
});
