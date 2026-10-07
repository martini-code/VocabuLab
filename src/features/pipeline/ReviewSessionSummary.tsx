import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Grade, Rating } from 'ts-fsrs';
import {
  Sparkles,
  TrendingUp,
  Brain,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  RotateCcw,
  Zap,
} from 'lucide-react-native';
import { ChunkyButton } from '../../components/ui/ChunkyButton';

import { colors } from '../../theme';

export interface ReviewSessionWordSummary {
  cardId: string;
  frontTerm: string;
  frontLang: string;
  backTerm: string;
  backLang: string;
  frontCefr?: string;
  pos?: string | null;
  rating: Grade;
  prevStability: number;
  newStability: number;
  prevDifficulty: number;
  newDifficulty: number;
  scheduledDays: number;
  state: number;
}

export interface ReviewSessionSummaryProps {
  items: ReviewSessionWordSummary[];
  deckName?: string;
  onDone: () => void;
  onExploreArchives?: () => void;
  onTrainAgain?: () => void;
}

function formatInterval(days: number): string {
  if (days <= 0) return 'Today';
  if (days < 1) return '< 1 day';
  if (days === 1) return '1 day';
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  if (days >= 30) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days)}d`;
}

function getRatingConfig(rating: Grade) {
  switch (rating) {
    case Rating.Again:
      return { label: 'AGAIN', color: colors.danger[500], bg: colors.danger[100], border: colors.danger[300] };
    case Rating.Hard:
      return { label: 'HARD', color: colors.warning[600], bg: colors.warning[100], border: colors.warning[200] };
    case Rating.Good:
      return { label: 'GOOD', color: colors.success[600], bg: colors.success[100], border: colors.success[200] };
    case Rating.Easy:
      return { label: 'EASY', color: colors.primary[700], bg: colors.primary[100], border: colors.primary[200] };
    default:
      return { label: 'GOOD', color: colors.success[600], bg: colors.success[100], border: colors.success[200] };
  }
}

function getStabilityColor(days: number): string {
  if (days >= 10) return colors.success[500]; // High stability (mastered)
  if (days >= 4) return colors.success[600];  // Good stability
  if (days >= 1) return colors.warning[500];  // Learning / short stability
  return colors.danger[500];                 // Low stability / needs review
}

function getDifficultyColor(diff: number): string {
  if (diff <= 4.0) return colors.success[500]; // Easy
  if (diff <= 6.5) return colors.warning[500]; // Medium
  return colors.danger[500];                  // Hard
}

export const ReviewSessionSummary: React.FC<ReviewSessionSummaryProps> = ({
  items,
  deckName,
  onDone,
  onExploreArchives,
  onTrainAgain,
}) => {
  const total = items.length;
  const againCount = items.filter((i) => i.rating === Rating.Again).length;
  const hardCount = items.filter((i) => i.rating === Rating.Hard).length;
  const goodCount = items.filter((i) => i.rating === Rating.Good).length;
  const easyCount = items.filter((i) => i.rating === Rating.Easy).length;

  const rememberedCount = goodCount + easyCount;
  const recallRate = total > 0 ? Math.round((rememberedCount / total) * 100) : 0;

  const totalGain = items.reduce((acc, curr) => acc + (curr.newStability - curr.prevStability), 0);
  const avgGain = total > 0 ? totalGain / total : 0;
  const masteredCount = items.filter((i) => i.newStability >= 10).length;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.iconCircle}>
          <Sparkles size={28} color={colors.primary[600]} />
        </View>

        <Text style={styles.title}>SESSION COMPLETE!</Text>
        <Text style={styles.subtitle}>
          Outstanding work! You reviewed{' '}
          <Text style={styles.subtitleBold}>{total} {total === 1 ? 'word' : 'words'}</Text>
          {deckName ? ` in "${deckName}"` : ''}.
        </Text>

        {/* Overall Recall Rate Progress Bar */}
        <View style={styles.recallBox}>
          <View style={styles.recallHeader}>
            <View style={styles.recallTitleRow}>
              <CheckCircle2 size={16} color={colors.success[600]} />
              <Text style={styles.recallTitle}>Session Retention Rate</Text>
            </View>
            <Text style={styles.recallPercent}>{recallRate}%</Text>
          </View>

          <View style={styles.overallProgressBarTrack}>
            <View
              style={[
                styles.overallProgressBarFill,
                {
                  width: `${Math.max(5, recallRate)}%`,
                  backgroundColor: recallRate >= 80 ? colors.success[500] : recallRate >= 60 ? colors.primary[500] : colors.danger[500],
                },
              ]}
            />
          </View>
          <Text style={styles.recallCaption}>
            {rememberedCount} of {total} words successfully recalled
          </Text>
        </View>

        {/* Multi-Segment Response Distribution Bar */}
        <View style={styles.distributionBox}>
          <Text style={styles.distributionTitle}>Response Breakdown</Text>
          <View style={styles.stackedBarTrack}>
            {againCount > 0 && (
              <View
                style={[
                  styles.stackedBarSegment,
                  { flex: againCount, backgroundColor: colors.danger[500] },
                ]}
              />
            )}
            {hardCount > 0 && (
              <View
                style={[
                  styles.stackedBarSegment,
                  { flex: hardCount, backgroundColor: colors.primary[500] },
                ]}
              />
            )}
            {goodCount > 0 && (
              <View
                style={[
                  styles.stackedBarSegment,
                  { flex: goodCount, backgroundColor: colors.success[500] },
                ]}
              />
            )}
            {easyCount > 0 && (
              <View
                style={[
                  styles.stackedBarSegment,
                  { flex: easyCount, backgroundColor: colors.primary[500] },
                ]}
              />
            )}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.danger[500] }]} />
              <Text style={styles.legendLabel}>Again: {againCount}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary[500] }]} />
              <Text style={styles.legendLabel}>Hard: {hardCount}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success[500] }]} />
              <Text style={styles.legendLabel}>Good: {goodCount}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary[500] }]} />
              <Text style={styles.legendLabel}>Easy: {easyCount}</Text>
            </View>
          </View>
        </View>

        {/* Session Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <TrendingUp size={16} color={colors.success[600]} />
            <Text style={styles.statNumber}>
              {avgGain >= 0 ? `+${avgGain.toFixed(1)}d` : `${avgGain.toFixed(1)}d`}
            </Text>
            <Text style={styles.statDesc}>Avg Stability Gain</Text>
          </View>

          <View style={styles.statCell}>
            <Brain size={16} color={colors.primary[700]} />
            <Text style={styles.statNumber}>{masteredCount}</Text>
            <Text style={styles.statDesc}>Mastered (S ≥ 10d)</Text>
          </View>

          <View style={styles.statCell}>
            <Zap size={16} color={colors.primary[600]} />
            <Text style={styles.statNumber}>FSRS v5</Text>
            <Text style={styles.statDesc}>SRS Algorithm</Text>
          </View>
        </View>
      </View>

      {/* Word-by-Word FSRS Metrics Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>WORD-BY-WORD FSRS STATS</Text>
        <Text style={styles.sectionSubtitle}>
          Memory stability and difficulty calibrated after your reviews
        </Text>
      </View>

      <View style={styles.wordsList}>
        {items.map((item, idx) => {
          const ratingCfg = getRatingConfig(item.rating);
          const diffGain = item.newStability - item.prevStability;
          // Benchmark stability scale: 30 days = 100%
          const stabilityPercent = Math.min(100, Math.max(5, Math.round((item.newStability / 30) * 100)));
          const stabilityColor = getStabilityColor(item.newStability);

          // FSRS difficulty scale: 1 to 10
          const difficultyPercent = Math.min(100, Math.max(10, Math.round((item.newDifficulty / 10) * 100)));
          const difficultyColor = getDifficultyColor(item.newDifficulty);

          return (
            <View key={`${item.cardId}_${idx}`} style={styles.wordCard}>
              {/* Word Header */}
              <View style={styles.wordCardHeader}>
                <View style={styles.wordTermsBox}>
                  <View style={styles.termRow}>
                    <Text style={styles.frontTermText}>{item.frontTerm}</Text>
                    {item.frontCefr && (
                      <View style={styles.cefrBadge}>
                        <Text style={styles.cefrText}>{item.frontCefr}</Text>
                      </View>
                    )}
                    {item.pos && (
                      <Text style={styles.posText}>({item.pos})</Text>
                    )}
                  </View>
                  <Text style={styles.backTermText}>{item.backTerm}</Text>
                </View>

                {/* Rating Badge */}
                <View
                  style={[
                    styles.ratingBadge,
                    { backgroundColor: ratingCfg.bg, borderColor: ratingCfg.border },
                  ]}
                >
                  <Text style={[styles.ratingBadgeText, { color: ratingCfg.color }]}>
                    {ratingCfg.label}
                  </Text>
                </View>
              </View>

              {/* FSRS Stats Row: Stability Progress Bar */}
              <View style={styles.metricRow}>
                <View style={styles.metricLabelRow}>
                  <Text style={styles.metricName}>Memory Stability</Text>
                  <View style={styles.metricValueWithGain}>
                    <Text style={[styles.metricValue, { color: stabilityColor }]}>
                      {item.newStability.toFixed(1)}d
                    </Text>
                    {diffGain !== 0 && (
                      <Text
                        style={[
                          styles.gainBadge,
                          { color: diffGain > 0 ? colors.success[600] : colors.danger[600] },
                        ]}
                      >
                        {diffGain > 0 ? `(+${diffGain.toFixed(1)}d)` : `(${diffGain.toFixed(1)}d)`}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${stabilityPercent}%`,
                        backgroundColor: stabilityColor,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* FSRS Stats Row: Difficulty Progress Bar */}
              <View style={styles.metricRow}>
                <View style={styles.metricLabelRow}>
                  <Text style={styles.metricName}>FSRS Difficulty</Text>
                  <Text style={[styles.metricValue, { color: difficultyColor }]}>
                    {item.newDifficulty.toFixed(1)} / 10
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${difficultyPercent}%`,
                        backgroundColor: difficultyColor,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Card Footer: Next Scheduled Interval & SRS Stage */}
              <View style={styles.wordFooter}>
                <View style={styles.intervalBox}>
                  <Clock size={12} color={colors.primary[900]} />
                  <Text style={styles.intervalText}>
                    Next review: <Text style={styles.intervalValue}>{formatInterval(item.scheduledDays)}</Text>
                  </Text>
                </View>

                <View style={styles.stageBox}>
                  <Text style={styles.stageText}>
                    {item.newStability >= 10 ? 'Mastered' : item.state === 1 ? 'Learning' : 'Review'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Action Controls */}
      <View style={styles.actionControls}>
        <ChunkyButton
          title="CONTINUE"
          subtitle="Return to study dashboard"
          color="primary"
          onPress={onDone}
          style={{ width: '100%', marginBottom: 12 }}
        />

        {onExploreArchives && (
          <ChunkyButton
            title="EXPLORE MORE DECKS"
            subtitle="Discover new progressive topics"
            color="secondary"
            onPress={onExploreArchives}
            style={{ width: '100%', marginBottom: 12 }}
          />
        )}

        {onTrainAgain && (
          <TouchableOpacity
            style={styles.trainAgainBtn}
            onPress={onTrainAgain}
            activeOpacity={0.8}
          >
            <RotateCcw size={16} color={colors.primary[900]} />
            <Text style={styles.trainAgainText}>REFRESH QUEUE</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary[200],
    padding: 20,
    alignItems: 'center',
    shadowColor: colors.primary[700],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[100],
    borderWidth: 2,
    borderColor: colors.primary[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary[900],
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.primary[800],
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  subtitleBold: {
    fontWeight: '800',
    color: colors.primary[900],
  },
  recallBox: {
    width: '100%',
    backgroundColor: colors.primary[50],
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    padding: 14,
    marginTop: 16,
  },
  recallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recallTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recallTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary[900],
  },
  recallPercent: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.success[600],
  },
  overallProgressBarTrack: {
    height: 10,
    backgroundColor: colors.neutral[200],
    borderRadius: 5,
    overflow: 'hidden',
  },
  overallProgressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  recallCaption: {
    fontSize: 11,
    color: colors.primary[800],
    marginTop: 6,
    textAlign: 'right',
  },
  distributionBox: {
    width: '100%',
    marginTop: 14,
  },
  distributionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary[900],
    marginBottom: 6,
  },
  stackedBarTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.neutral[200],
  },
  stackedBarSegment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    gap: 8,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.neutral[800],
    marginTop: 4,
  },
  statDesc: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 2,
    textAlign: 'center',
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary[900],
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.primary[800],
    marginTop: 2,
  },
  wordsList: {
    gap: 12,
  },
  wordCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    padding: 14,
    shadowColor: colors.neutral[500],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  wordCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  wordTermsBox: {
    flex: 1,
    marginRight: 8,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  frontTermText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  cefrBadge: {
    backgroundColor: colors.primary[50],
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  cefrText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary[700],
  },
  posText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.neutral[500],
  },
  backTermText: {
    fontSize: 13,
    color: colors.neutral[600],
    marginTop: 2,
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  ratingBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  metricRow: {
    marginTop: 8,
  },
  metricLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  metricValueWithGain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  gainBadge: {
    fontSize: 10,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.neutral[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  wordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[50],
  },
  intervalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  intervalText: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  intervalValue: {
    fontWeight: '800',
    color: colors.primary[900],
  },
  stageBox: {
    backgroundColor: colors.neutral[50],
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  stageText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  actionControls: {
    marginTop: 24,
    width: '100%',
  },
  trainAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary[100],
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    paddingVertical: 12,
    marginTop: 4,
  },
  trainAgainText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary[900],
    letterSpacing: 0.5,
  },
});
